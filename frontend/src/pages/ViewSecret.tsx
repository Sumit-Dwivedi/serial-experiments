import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Flame, Lock, ShieldAlert, Unlock } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { decryptText, readFragmentKey } from "@/lib/crypto";
import type { SecretMeta, SecretPayload } from "@/lib/types";

export default function ViewSecret() {
  const { id = "" } = useParams();
  const [passphrase, setPassphrase] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [burned, setBurned] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const meta = useQuery({
    queryKey: ["secret-meta", id],
    queryFn: () => apiGet<SecretMeta>(`/secrets/${id}/meta`),
    retry: false,
    enabled: Boolean(id) && plain === null,
  });

  const open = useMutation({
    mutationFn: async () => {
      const payload = await apiPost<SecretPayload>(`/secrets/${id}/open`);
      const text = await decryptText({
        cipherText: payload.cipher_text,
        iv: payload.iv,
        salt: payload.salt,
        fragmentKey: readFragmentKey(),
        passphrase: payload.has_passphrase ? passphrase : undefined,
      });
      return { text, burned: payload.burned };
    },
    onSuccess: (r) => {
      setPlain(r.text);
      setBurned(r.burned);
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

  const missing = meta.isError && plain === null;

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">
          ZERO-KNOWLEDGE DECRYPT CHAMBER
        </p>
        <h1
          className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
          data-testid="view-secret-heading"
        >
          {plain !== null ? "Payload decrypted" : "Locked payload detected"}
        </h1>

        {missing && (
          <div
            className="mt-8 border border-[#FF3B30]/30 bg-[#2A0E13] p-6"
            data-testid="secret-unavailable-card"
          >
            <ShieldAlert className="size-6 text-[#FF3B30]" />
            <p className="mt-3 text-rose-100">
              This secret no longer exists. It was either already read, or it expired.
            </p>
          </div>
        )}

        {plain === null && !missing && (
          <div
            className="mt-8 border border-white/10 bg-[#11141E] p-6"
            data-testid="locked-payload-card"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center border border-[#00F5FF]/30 bg-[#00F5FF]/10">
                <Lock className="size-4 text-[#00F5FF]" />
              </span>
              <div>
                <p className="font-mono text-xs tracking-wider text-slate-300">
                  VAULT TOKEN {id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-500">
                  {meta.data?.burn_after_read
                    ? "Opening this destroys it permanently."
                    : "Readable until it expires."}
                </p>
              </div>
            </div>

            {meta.data?.has_passphrase && (
              <div className="mt-6">
                <Label htmlFor="unlock-pass" className="text-slate-300">
                  Passphrase required
                </Label>
                <Input
                  id="unlock-pass"
                  data-testid="unlock-passphrase-input"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="mt-2 border-white/10 bg-[#05070B] font-mono text-sm"
                  placeholder="shared out-of-band"
                />
              </div>
            )}

            {failure && (
              <p className="mt-4 text-sm text-rose-400" data-testid="decrypt-error-message">
                {failure}
              </p>
            )}

            <Button
              data-testid="decrypt-reveal-button"
              onClick={() => open.mutate()}
              disabled={open.isPending || meta.isLoading}
              className="mt-6 w-full bg-[#00F5FF] font-mono text-xs tracking-[0.18em] text-black uppercase transition-transform duration-200 hover:bg-[#5CFBFF] active:scale-[0.99]"
            >
              <Unlock className="mr-2 size-3.5" />
              {open.isPending ? "Decrypting…" : "Decrypt & reveal"}
            </Button>
          </div>
        )}

        {plain !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-8"
            data-testid="decrypted-secret-card"
          >
            {burned && (
              <div
                className="mb-4 flex items-center gap-2 border border-[#FF3B30]/30 bg-[#2A0E13] px-4 py-3"
                data-testid="burn-notice"
              >
                <Flame className="size-4 text-[#FF3B30]" />
                <p className="text-sm text-rose-100">
                  Destroyed. This link is now dead — copy the text before you leave.
                </p>
              </div>
            )}
            <pre
              className="border border-[#00F5FF]/25 bg-[#05070B] p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap text-[#C8FDFF]"
              data-testid="decrypted-secret-text"
            >
              {plain}
            </pre>
          </motion.div>
        )}
      </div>
    </PageShell>
  );
}
