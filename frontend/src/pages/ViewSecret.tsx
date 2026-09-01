import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Download, Flame, Lock, Paperclip, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import { importReadKey, openBytes, openText, readFragmentKey } from "@/lib/crypto";
import type { BurnResult, SecretMeta, SecretPayload } from "@/lib/types";

interface RevealedFile {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

const prettySize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function ViewSecret() {
  const { id = "" } = useParams();
  const [passphrase, setPassphrase] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedFile[]>([]);
  const [burned, setBurned] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [burnToken, setBurnToken] = useState<string | null>(null);
  const [destroyed, setDestroyed] = useState(false);

  // Capture the key from the fragment ONCE, then scrub it from the address bar and
  // session history so it can't leak via screen-shares, history or a copied URL.
  // It's held in sessionStorage (this tab only, dies with the tab) so a refresh can
  // still decrypt — the secret survives a refresh, and so must the key.
  const stashKey = `vz:key:${id}`;
  const fragmentKey = useRef<string | null>(
    readFragmentKey() ?? sessionStorage.getItem(stashKey),
  );
  useEffect(() => {
    const fromHash = readFragmentKey();
    if (fromHash) {
      fragmentKey.current = fromHash;
      sessionStorage.setItem(stashKey, fromHash);
      window.history.replaceState(null, "", `/v/${id}`);
    }
  }, [id, stashKey]);

  const meta = useQuery({
    queryKey: ["secret-meta", id],
    queryFn: () => apiGet<SecretMeta>(`/secrets/${id}/meta`),
    retry: false,
    enabled: Boolean(id) && plain === null,
  });

  const open = useMutation({
    mutationFn: async () => {
      // GET claims the secret but does NOT delete it — a refresh or crash can no
      // longer destroy an unread note.
      const payload = await apiGet<SecretPayload>(`/secrets/${id}`);
      const key = await importReadKey({
        salt: payload.salt,
        fragmentKey: fragmentKey.current,
        passphrase: payload.has_passphrase ? passphrase : undefined,
      });
      const text = await openText(key, payload.cipher_text, payload.iv);
      const files: RevealedFile[] = [];
      for (const a of payload.attachments) {
        const metaJson = JSON.parse(await openText(key, a.cipher_name, a.name_iv)) as {
          name: string;
          type: string;
        };
        const bytes = await openBytes(key, a.cipher_data, a.data_iv);
        const blob = new Blob([bytes as unknown as BlobPart], {
          type: metaJson.type || "application/octet-stream",
        });
        files.push({
          id: a.id,
          name: metaJson.name,
          type: metaJson.type,
          url: URL.createObjectURL(blob),
          size: a.size,
        });
      }
      return { text, burned: payload.burned, files, burnToken: payload.burn_token };
    },
    onSuccess: (r) => {
      setPlain(r.text);
      setRevealed(r.files);
      setBurned(r.burned);
      setBurnToken(r.burnToken);
      setFailure(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        setFailure(
          typeof (e.body as { detail?: string })?.detail === "string"
            ? (e.body as { detail: string }).detail
            : "This secret is gone.",
        );
      } else {
        setFailure("Decryption failed — wrong passphrase or a broken link.");
      }
    },
  });

  const destroy = useMutation({
    mutationFn: () =>
      apiDelete<BurnResult>(`/secrets/${id}?burn_token=${encodeURIComponent(burnToken ?? "")}`),
    onSuccess: () => {
      setDestroyed(true);
      sessionStorage.removeItem(stashKey);
      toast.success("Record erased. No trace in the Wired.");
    },
    onError: () => toast.error("Connection failed."),
  });

  const missing = meta.isError && plain === null;

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#E8672E]">
          LAYER 07 // DECRYPT SEQUENCE
        </p>
        <h1
          className="type-reveal mt-4 font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl"
          data-testid="view-secret-heading"
        >
          {plain !== null ? "The seal is broken." : "You seem to have mail."}
        </h1>

        {missing && (
          <div
            className="mt-8 border border-[#7A2A2A]/30 bg-[#1A0F0F] p-6"
            data-testid="secret-unavailable-card"
          >
            <ShieldAlert className="size-6 text-[#7A2A2A]" />
            <p className="mt-3 text-[#D4A9A9]">
              This secret no longer exists. It was either already read, or it expired.
            </p>
          </div>
        )}

        {plain === null && !missing && (
          <div
            className="mt-8 border border-white/10 bg-[#17171A] p-6"
            data-testid="locked-payload-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center border border-[#E8672E]/30 bg-[#E8672E]/10">
                <Lock className="size-4 text-[#E8672E]" />
              </span>
              <div>
                <p className="font-mono text-xs tracking-wider text-[#B8B3AA]">
                  PAYLOAD TOKEN {id.slice(0, 8)}
                </p>
                <p className="text-xs text-[#555961]">
                  {meta.data?.burn_after_read
                    ? "Opening this destroys it permanently."
                    : "Readable until it expires."}
                  {meta.data && meta.data.attachment_count > 0 && (
                    <span data-testid="attachment-count-hint">
                      {" "}
                      · {meta.data.attachment_count} encrypted file
                      {meta.data.attachment_count > 1 ? "s" : ""} attached
                    </span>
                  )}
                </p>
              </div>
            </div>

            {meta.data?.has_passphrase && (
              <div className="mt-6">
                <Label htmlFor="unlock-pass" className="text-[#B8B3AA]">
                  Passphrase required
                </Label>
                <Input
                  id="unlock-pass"
                  data-testid="unlock-passphrase-input"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="mt-2 border-white/10 bg-[#0E0E10] font-mono text-sm"
                  placeholder="shared out-of-band"
                />
              </div>
            )}

            {failure && (
              <p className="mt-4 text-sm text-[#9A6B6B]" data-testid="decrypt-error-message">
                {failure}
              </p>
            )}

            <Button
              data-testid="decrypt-reveal-button"
              onClick={() => open.mutate()}
              disabled={open.isPending || meta.isLoading}
              className="glitch-hover mt-6 w-full bg-[#E8672E] font-mono text-xs tracking-[0.18em] text-black uppercase duration-200 hover:bg-[#F07A3F] "
            >
              <Unlock className="mr-2 size-3.5" />
              {open.isPending ? <span className="cursor-blink">Decrypting</span> : "Unseal"}
            </Button>
          </div>
        )}

        {plain !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "linear" }}
            className="mt-8"
            data-testid="decrypted-secret-card"
          >
            {burned && (
              <div
                className="mb-4 flex items-center gap-2 border border-[#7A2A2A]/30 bg-[#1A0F0F] px-4 py-3"
                data-testid="burn-notice"
              >
                <Flame className="size-4 text-[#7A2A2A]" />
                <p className="text-sm text-[#D4A9A9]">This secret has been destroyed.</p>
              </div>
            )}
            {plain.length > 0 && (
              <pre
                className="border border-[#E8672E]/25 bg-[#0E0E10] p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#ECE7DC]"
                data-testid="decrypted-secret-text"
              >
                {plain}
              </pre>
            )}

            {revealed.length > 0 && (
              <div className="mt-5" data-testid="decrypted-attachments">
                <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#6B6F76]">
                  <Paperclip className="size-3.5 text-[#E8672E]" /> DECRYPTED FILES
                </p>
                <ul className="mt-3 space-y-2">
                  {revealed.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-3 border border-white/10 bg-[#17171A] px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs text-[#D4CFC6]">
                          {f.name}
                        </span>
                        <span className="font-mono text-[11px] text-[#3D4048]">
                          {prettySize(f.size)}
                        </span>
                      </span>
                      <a
                        href={f.url}
                        download={f.name}
                        data-testid={`download-attachment-${f.id}`}
                        className="flex shrink-0 items-center gap-2 border border-[#E8672E]/40 px-3 py-1.5 font-mono text-[11px] text-[#E8672E] transition-colors duration-200 hover:bg-[#E8672E]/10"
                      >
                        <Download className="size-3.5" /> Download
                      </a>
                    </li>
                  ))}
                </ul>
                {revealed.some((f) => f.type.startsWith("image/")) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="image-previews">
                    {revealed
                      .filter((f) => f.type.startsWith("image/"))
                      .map((f) => (
                        <img
                          key={`img-${f.id}`}
                          src={f.url}
                          alt={f.name}
                          className="w-full border border-white/10"
                        />
                      ))}
                  </div>
                )}
              </div>
            )}
            {burnToken && !destroyed && (
              <div
                className="mt-6 border border-[#7A2A2A]/30 bg-[#1A0F0F] p-5"
                data-testid="destroy-gate"
              >
                <p className="flex items-center gap-2 text-sm font-medium text-[#D4A9A9]">
                  <Flame className="size-4 text-[#7A2A2A]" /> Still on the server
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#9A6B6B]/80">
                  Nothing was deleted yet, so a refresh won't lose it. Save what you need,
                  then destroy it. If you just close this tab, it self-deletes within 5
                  minutes anyway.
                </p>
                <Button
                  data-testid="destroy-now-button"
                  onClick={() => destroy.mutate()}
                  disabled={destroy.isPending}
                  className="glitch-hover mt-4 w-full bg-[#7A2A2A] font-mono text-xs tracking-[0.18em] text-white uppercase duration-200 hover:bg-[#8B3A3A] "
                >
                  <Flame className="mr-2 size-3.5" />
                  {destroy.isPending ? <span className="cursor-blink">Erasing</span> : "I've read it — erase from the Wired"}
                </Button>
              </div>
            )}

            {destroyed && (
              <div
                className="mt-6 flex items-center gap-2 border border-[#34D399]/30 bg-[#0C2A20] px-4 py-3"
                data-testid="destroyed-confirmation"
              >
                <ShieldCheck className="size-4 text-[#34D399]" />
                <p className="text-sm text-[#B8C9B8]">
                  Gone. No record of this exists anywhere.
                </p>
              </div>
            )}
          </motion.div>
        )}

        <p className="mt-12 text-center font-mono text-[11px] text-[#3D4048]">
          Encrypted end-to-end by{" "}
          <a
            href="/"
            className="text-[#E8672E]/50 transition-colors duration-200 hover:text-[#E8672E]"
            data-testid="viral-cta"
          >
            SERIAL://EXPERIMENTS
          </a>{" "}
          ·{" "}
          <a
            href="/"
            data-testid="viral-cta-secondary"
            className="text-[#555961] transition-colors duration-200 hover:text-[#B8B3AA]"
          >
            Send your own zero-trace message →
          </a>
        </p>
      </div>
    </PageShell>
  );
}
