import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy,
  Flame,
  KeyRound,
  Lock,
  Paperclip,
  QrCode,
  ShieldCheck,
  Timer,
  Trash2,
  Eye,
  EyeOff,
  Receipt,
} from "lucide-react";

import PageShell from "@/components/PageShell";
import CipherRain from "@/components/CipherRain";
import QrCanvas from "@/components/QrCanvas";
import ExpiryCountdown from "@/components/ExpiryCountdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiPost } from "@/lib/api";
import { buildKey, sealBytes, sealText } from "@/lib/crypto";
import type { Attachment, SecretCreated } from "@/lib/types";

const EXPIRY_LABELS: Record<string, string> = {
  "1": "1 hour",
  "24": "24 hours",
  "168": "7 days",
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 3;

/** Deploy-time override; falls back to whatever origin the app is served from. */
const APP_ORIGIN = import.meta.env.VITE_APP_URL || window.location.origin;

const CLI_SNIPPET = `# Generate a key, encrypt locally, post ciphertext
SECRET="my-api-key-abc123"
KEY=$(openssl rand -base64 32)
IV=$(openssl rand -base64 12)
CIPHER=$(echo -n "$SECRET" | openssl enc -aes-256-gcm \\
  -K $(echo -n "$KEY" | base64 -d | xxd -p) \\
  -iv $(echo -n "$IV" | base64 -d | xxd -p) \\
  -nosalt | base64)
# Post to SERIAL://EXPERIMENTS
ID=$(curl -s -X POST ${APP_ORIGIN}/api/secrets \\
  -H "Content-Type: application/json" \\
  -d "{\\"cipher_text\\": \\"$CIPHER\\", \\"iv\\": \\"$IV\\"}" \\
  | jq -r '.id')
echo "${APP_ORIGIN}/v/$ID#key=$KEY"`;

const prettySize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function Home() {
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiry, setExpiry] = useState("24");
  const [burn, setBurn] = useState(true);
  const [maxReads, setMaxReads] = useState("1");
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [cipherHex, setCipherHex] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewKey = useRef<CryptoKey | null>(null);

  /**
   * Live hex dump of the draft, encrypted a second time purely for display. Debounced at
   * 300ms and completely separate from the submission flow, which mints its own key.
   */
  useEffect(() => {
    if (!text) {
      setCipherHex("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!previewKey.current) {
          previewKey.current = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"],
          );
        }
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const buf = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          previewKey.current,
          new TextEncoder().encode(text),
        );
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (!cancelled) setCipherHex(hex.length > 256 ? `${hex.slice(0, 256)}…` : hex);
      } catch {
        if (!cancelled) setCipherHex("");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  const addFiles = (picked: FileList | File[] | null) => {
    if (!picked) return;
    const next = [...files];
    for (const f of Array.from(picked)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} is over the 2 MB limit.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`Up to ${MAX_FILES} files per secret.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Pasting a screenshot attaches it instead of dropping it on the floor. */
  const handlePaste = (e: ClipboardEvent) => {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    e.preventDefault();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const named = images.map((f, i) => {
      const ext = f.type.split("/")[1] || "png";
      return new File([f], `screenshot-${stamp}${images.length > 1 ? `-${i + 1}` : ""}.${ext}`, {
        type: f.type,
      });
    });
    addFiles(named);
    toast.success(named.length > 1 ? `${named.length} images attached.` : "Screenshot attached.");
  };

  const create = useMutation({
    mutationFn: async () => {
      const material = await buildKey(passphrase || undefined);
      const sealedText = await sealText(material.key, text);

      const attachments: Omit<Attachment, "id">[] = [];
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const data = await sealBytes(material.key, bytes);
        const name = await sealText(material.key, JSON.stringify({ name: f.name, type: f.type }));
        attachments.push({
          cipher_name: name.cipher,
          name_iv: name.iv,
          cipher_data: data.cipher,
          data_iv: data.iv,
          size: f.size,
        });
      }

      const created = await apiPost<SecretCreated>("/secrets", {
        cipher_text: sealedText.cipher,
        iv: sealedText.iv,
        salt: material.salt,
        has_passphrase: Boolean(passphrase),
        burn_after_read: burn,
        expires_in_hours: Number(expiry),
        max_reads: Number(maxReads),
        attachments,
      });

      const frag = material.fragmentKey ? `#key=${material.fragmentKey}` : "";
      return {
        url: `${window.location.origin}/v/${created.id}${frag}`,
        receipt: `${window.location.origin}/r/${created.receipt_token}`,
        expiresAt: created.expires_at,
      };
    },
    onSuccess: (r) => {
      setLink(r.url);
      setReceiptUrl(r.receipt);
      setExpiresAt(r.expiresAt);
      setText("");
      setPassphrase("");
      setFiles([]);
      toast.success("Link forged. Key embedded in fragment.");
    },
    onError: () => toast.error("Connection failed."),
  });

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.message("Copy manually — clipboard is blocked here.");
    }
  };

  return (
    <PageShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <section className="lg:pt-6">
          <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#E8672E]">
            LAYER 07 // ENCRYPTION ENGINE
          </p>
          <h1
            className="type-reveal mt-5 font-mono text-4xl leading-[1.05] font-extrabold tracking-tighter text-white sm:text-5xl"
            data-testid="home-heading"
          >
            Present day. Present time.
            <br />
            And you don't even have to <span className="text-[#E8672E]">log in</span>.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#6B6F76]">
            256-bit AES-GCM. The key exists only in the link fragment — a part of the URL the
            server never receives. We store ciphertext and nothing else.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, label: "Encrypted in-browser", value: "crypto.subtle" },
              { icon: KeyRound, label: "Key transport", value: "URL #fragment only" },
              { icon: Paperclip, label: "Attachments", value: "sealed under same key" },
              { icon: Flame, label: "Destruction", value: "atomic on first read" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border border-white/10 bg-[#17171A] px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-sm text-[#B8B3AA]">
                  <row.icon className="size-4 text-[#E8672E]" />
                  {row.label}
                </span>
                <span className="font-mono text-[11px] tracking-wider text-[#555961]">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="relative border border-white/10 bg-[#17171A] p-5 shadow-[0_0_50px_-20px_rgba(33,58,82,0.4)] sm:p-7"
          data-testid="secret-creator-panel"
        >
          <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-[#555961]">
            <Lock className="size-3.5 text-[#E8672E]" />
            INITIALIZE PAYLOAD
          </div>

          <Label htmlFor="secret-text" className="text-[#B8B3AA]">
            Your secret
          </Label>
          <div
            data-testid="editor-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`relative mt-2 transition-colors duration-200 ${
              dragging ? "ring-2 ring-[#E8672E]/70" : ""
            }`}
          >
            <Textarea
              id="secret-text"
              data-testid="secret-text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type, paste text or a screenshot — or drop files right here. Nothing leaves this tab unencrypted…"
              className="min-h-40 resize-y border-white/10 bg-[#0E0E10] font-mono text-sm text-[#D4CFC6] focus-visible:ring-[#E8672E]/50"
            />
            {dragging && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0E0E10]/85"
                data-testid="dropzone-overlay"
              >
                <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-[#E8672E]">
                  <Paperclip className="size-4" /> DROP TO ENCRYPT
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] text-[#3D4048]" data-testid="char-counter">
            {text.length} chars · entropy source: crypto.getRandomValues
          </p>

          {/* Cosmetic only: encrypts a copy of the draft purely to show the ciphertext. */}
          <details className="mt-3" data-testid="cipher-preview-toggle">
            <summary className="cursor-pointer font-mono text-[11px] tracking-wider text-[#555961] transition-colors duration-200 hover:text-[#E8672E]">
              ▸ Cipher preview
            </summary>
            <div className="mt-2">
              <CipherRain hex={cipherHex} />
            </div>
            <pre
              className="mt-2 max-h-16 overflow-hidden border border-[#E8672E]/10 bg-[#0E0E10] p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[#E8672E]/60"
              data-testid="cipher-preview-hex"
            >
              {cipherHex || "Start typing to see the encrypted output…"}
            </pre>
          </details>

          {/* attachments */}
          <div className="mt-5">
            <Label className="flex items-center gap-2 text-[#B8B3AA]">
              <Paperclip className="size-3.5 text-[#E8672E]" /> Attachments (max {MAX_FILES} × 2 MB
              · paste or drop welcome)
            </Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              data-testid="attachment-file-input"
              onChange={(e) => addFiles(e.target.files)}
              className="mt-2 block w-full cursor-pointer border border-white/10 bg-[#0E0E10] p-2 font-mono text-xs text-[#6B6F76] file:mr-3 file:border-0 file:bg-[#E8672E]/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:text-[#E8672E]"
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2" data-testid="attachment-list">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    data-testid={`attachment-item-${i}`}
                    className="flex items-center justify-between gap-3 border border-white/10 bg-[#0E0E10] px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-[#B8B3AA]">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[11px] text-[#3D4048]">
                        {prettySize(f.size)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        data-testid={`attachment-remove-${i}`}
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="glitch-hover text-[#555961] transition-colors duration-200 hover:text-[#7A2A2A]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="flex items-center gap-2 text-[#B8B3AA]">
                <Timer className="size-3.5 text-[#E8672E]" /> Self-destruct after
              </Label>
              <Select value={expiry} onValueChange={(v: string) => setExpiry(v)}>
                <SelectTrigger
                  className="mt-2 w-full border-white/10 bg-[#0E0E10] font-mono text-sm"
                  data-testid="expiry-select-trigger"
                >
                  <SelectValue>{(v) => EXPIRY_LABELS[v as string]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" data-testid="expiry-option-1h">
                    1 hour
                  </SelectItem>
                  <SelectItem value="24" data-testid="expiry-option-24h">
                    24 hours
                  </SelectItem>
                  <SelectItem value="168" data-testid="expiry-option-7d">
                    7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="passphrase" className="flex items-center gap-2 text-[#B8B3AA]">
                <KeyRound className="size-3.5 text-[#E8672E]" /> Passphrase (optional)
              </Label>
              <div className="relative mt-2">
                <Input
                  id="passphrase"
                  data-testid="passphrase-input"
                  type={showPass ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="extra PBKDF2 layer"
                  className="border-white/10 bg-[#0E0E10] pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  data-testid="passphrase-visibility-toggle"
                  onClick={() => setShowPass((s) => !s)}
                  className="glitch-hover absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#555961] transition-colors duration-200 hover:text-[#E8672E]"
                  aria-label="Toggle passphrase visibility"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Label className="flex items-center gap-2 text-[#B8B3AA]">
              <Eye className="size-3.5 text-[#E8672E]" /> Allowed reads
            </Label>
            <Select value={maxReads} onValueChange={(v: string) => setMaxReads(v)}>
              <SelectTrigger
                className="mt-2 w-full border-white/10 bg-[#0E0E10] font-mono text-sm"
                data-testid="max-reads-select-trigger"
              >
                <SelectValue>{(v) => `${v as string} read${v === "1" ? "" : "s"}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <SelectItem key={n} value={n} data-testid={`max-reads-option-${n}`}>
                    {n} read{n === "1" ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label
            className="mt-6 flex cursor-pointer items-start gap-3 border border-[#7A2A2A]/25 bg-[#1A0F0F]/50 p-4"
            data-testid="burn-toggle-row"
          >
            <Checkbox
              checked={burn}
              onCheckedChange={(c) => setBurn(Boolean(c))}
              data-testid="burn-after-read-checkbox"
              className="mt-0.5"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-[#B88A8A]">
                <Flame className="size-4 text-[#7A2A2A]" /> Burn after reading
              </span>
              <span className="mt-1 block text-xs text-[#9A6B6B]/70">
                The ciphertext is deleted from the database the moment it is opened once.
              </span>
            </span>
          </label>

          <Button
            data-testid="create-secret-button"
            disabled={(!text.trim() && files.length === 0) || create.isPending}
            onClick={() => create.mutate()}
            className="glitch-hover mt-6 w-full bg-[#E8672E] font-mono text-xs tracking-[0.18em] text-black uppercase duration-200 hover:bg-[#F07A3F] "
          >
            {create.isPending ? <span className="cursor-blink">Encrypting</span> : "Seal and generate link"}
          </Button>

          {link && (
            <div
              className="mt-6 border border-[#E8672E]/30 bg-[#0E0E10] p-4"
              data-testid="secret-link-card"
            >
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#E8672E]">
                LINK FORGED // KEY IN FRAGMENT
              </p>
              <p
                className="mt-3 font-mono text-xs break-all text-[#B8B3AA]"
                data-testid="secret-link-value"
              >
                {link}
              </p>
              {expiresAt && (
                <div className="mt-3">
                  <ExpiryCountdown expiresAt={expiresAt} />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => copy(link, "Secret link")}
                  data-testid="copy-secret-link-button"
                  variant="outline"
                  className="glitch-hover border-[#E8672E]/40 font-mono text-xs text-[#E8672E] hover:bg-[#E8672E]/10"
                >
                  <Copy className="mr-2 size-3.5" /> Copy link
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        data-testid="show-qr-button"
                        className="glitch-hover glitch-hover border-white/15 font-mono text-xs text-[#D4CFC6] hover:bg-white/5"
                      />
                    }
                  >
                    <QrCode className="mr-2 size-3.5" /> Show QR
                  </DialogTrigger>
                  <DialogContent data-testid="qr-dialog" className="bg-[#17171A]">
                    <DialogHeader>
                      <DialogTitle className="font-mono">Scan to open</DialogTitle>
                      <DialogDescription>
                        Drawn in this tab. The link — and its key — never reached a QR service.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center py-2">
                      <QrCanvas text={link} size={260} />
                    </div>
                  </DialogContent>
                </Dialog>
                <Link
                  to="/share-preview"
                  data-testid="share-preview-link"
                  className="flex items-center border border-white/15 px-3 py-1.5 font-mono text-xs text-[#6B6F76] transition-colors duration-200 hover:border-[#E8672E]/40 hover:text-[#E8672E]"
                >
                  Preview the unfurl
                </Link>
              </div>

              {receiptUrl && (
                <div className="mt-5 border-t border-white/10 pt-4" data-testid="receipt-block">
                  <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-[#6B6F76]">
                    <Receipt className="size-3.5 text-[#E8672E]" /> YOUR PRIVATE READ RECEIPT
                  </p>
                  <p className="mt-2 text-xs text-[#555961]">
                    Keep this for yourself. It shows only <em>when</em> the note was opened — never
                    by whom.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/r/${receiptUrl.split("/r/")[1]}`}
                      data-testid="open-receipt-link"
                      className="border border-white/15 px-3 py-1.5 font-mono text-[11px] text-[#D4CFC6] transition-colors duration-200 hover:border-[#E8672E]/40 hover:text-[#E8672E]"
                    >
                      Open status page
                    </Link>
                    <button
                      type="button"
                      data-testid="copy-receipt-link-button"
                      onClick={() => copy(receiptUrl, "Receipt link")}
                      className="glitch-hover border border-white/15 px-3 py-1.5 font-mono text-[11px] text-[#6B6F76] transition-colors duration-200 hover:text-white"
                    >
                      Copy receipt link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <section
        className="mt-12 border border-white/10 bg-[#17171A] p-5"
        data-testid="cli-section"
      >
        <p className="font-mono text-[11px] tracking-[0.22em] text-[#555961]">COMMAND LINE</p>
        <h3 className="mt-2 font-mono text-lg font-semibold text-white">
          Send from your terminal
        </h3>
        <p className="mt-2 text-sm text-[#6B6F76]">
          Pipe any secret through curl. The key never leaves your machine.
        </p>
        <pre
          className="mt-4 overflow-x-auto border border-[#E8672E]/10 bg-[#0E0E10] p-4 font-mono text-xs leading-relaxed text-[#ECE7DC]"
          data-testid="cli-snippet"
        >
          {CLI_SNIPPET}
        </pre>
        <button
          type="button"
          data-testid="copy-cli-snippet"
          onClick={() => copy(CLI_SNIPPET, "Terminal snippet")}
          className="glitch-hover mt-3 border border-[#E8672E]/30 px-3 py-1.5 font-mono text-[11px] text-[#E8672E] transition-colors duration-200 hover:bg-[#E8672E]/10"
        >
          Copy to clipboard
        </button>
      </section>
    </PageShell>
  );
}
