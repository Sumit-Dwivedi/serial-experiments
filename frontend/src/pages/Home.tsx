import { useRef, useState } from "react";
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

const prettySize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export default function Home() {
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiry, setExpiry] = useState("24");
  const [burn, setBurn] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      toast.success("Encrypted locally. Only ciphertext was uploaded.");
    },
    onError: () => toast.error("Could not store the encrypted payload. Try again."),
  });

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.message("Copy manually — clipboard is blocked here.");
    }
  };

  return (
    <PageShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <section className="lg:pt-6">
          <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">
            ZERO-KNOWLEDGE · AES-256-GCM
          </p>
          <h1
            className="mt-5 font-heading text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-5xl"
            data-testid="home-heading"
          >
            Write anything.
            <br />
            Leave <span className="text-[#00F5FF]">no trace</span> behind.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-400">
            Your text and files are encrypted inside this browser tab before anything is sent.
            The decryption key rides in the link fragment — a part of the URL browsers never
            transmit. We store ciphertext and nothing else: no account, no IP, no user agent.
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
                className="flex items-center justify-between border border-white/10 bg-[#11141E] px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-sm text-slate-300">
                  <row.icon className="size-4 text-[#00F5FF]" />
                  {row.label}
                </span>
                <span className="font-mono text-[11px] tracking-wider text-slate-500">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="relative border border-white/10 bg-[#11141E] p-5 shadow-[0_0_60px_-25px_rgba(0,245,255,0.4)] sm:p-7"
          data-testid="secret-creator-panel"
        >
          <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-slate-500">
            <Lock className="size-3.5 text-[#00F5FF]" />
            NEW ENCRYPTED PAYLOAD
          </div>

          <Label htmlFor="secret-text" className="text-slate-300">
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
              dragging ? "ring-2 ring-[#00F5FF]/70" : ""
            }`}
          >
            <Textarea
              id="secret-text"
              data-testid="secret-text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type, paste text or a screenshot — or drop files right here. Nothing leaves this tab unencrypted…"
              className="min-h-40 resize-y border-white/10 bg-[#05070B] font-mono text-sm text-slate-200 focus-visible:ring-[#00F5FF]/50"
            />
            {dragging && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#05070B]/85"
                data-testid="dropzone-overlay"
              >
                <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-[#00F5FF]">
                  <Paperclip className="size-4" /> DROP TO ENCRYPT
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] text-slate-600" data-testid="char-counter">
            {text.length} chars · entropy source: crypto.getRandomValues
          </p>

          {/* attachments */}
          <div className="mt-5">
            <Label className="flex items-center gap-2 text-slate-300">
              <Paperclip className="size-3.5 text-[#00F5FF]" /> Attachments (max {MAX_FILES} × 2 MB
              · paste or drop welcome)
            </Label>
            <input
              ref={fileRef}
              type="file"
              multiple
              data-testid="attachment-file-input"
              onChange={(e) => addFiles(e.target.files)}
              className="mt-2 block w-full cursor-pointer border border-white/10 bg-[#05070B] p-2 font-mono text-xs text-slate-400 file:mr-3 file:border-0 file:bg-[#00F5FF]/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:text-[#00F5FF]"
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2" data-testid="attachment-list">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    data-testid={`attachment-item-${i}`}
                    className="flex items-center justify-between gap-3 border border-white/10 bg-[#05070B] px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-slate-300">{f.name}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[11px] text-slate-600">
                        {prettySize(f.size)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        data-testid={`attachment-remove-${i}`}
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="text-slate-500 transition-colors duration-200 hover:text-[#FF3B30]"
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
              <Label className="flex items-center gap-2 text-slate-300">
                <Timer className="size-3.5 text-[#00F5FF]" /> Self-destruct after
              </Label>
              <Select value={expiry} onValueChange={(v: string) => setExpiry(v)}>
                <SelectTrigger
                  className="mt-2 w-full border-white/10 bg-[#05070B] font-mono text-sm"
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
              <Label htmlFor="passphrase" className="flex items-center gap-2 text-slate-300">
                <KeyRound className="size-3.5 text-[#00F5FF]" /> Passphrase (optional)
              </Label>
              <div className="relative mt-2">
                <Input
                  id="passphrase"
                  data-testid="passphrase-input"
                  type={showPass ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="extra PBKDF2 layer"
                  className="border-white/10 bg-[#05070B] pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  data-testid="passphrase-visibility-toggle"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
                  aria-label="Toggle passphrase visibility"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <label
            className="mt-6 flex cursor-pointer items-start gap-3 border border-[#FF3B30]/25 bg-[#2A0E13]/50 p-4"
            data-testid="burn-toggle-row"
          >
            <Checkbox
              checked={burn}
              onCheckedChange={(c) => setBurn(Boolean(c))}
              data-testid="burn-after-read-checkbox"
              className="mt-0.5"
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-medium text-rose-200">
                <Flame className="size-4 text-[#FF3B30]" /> Burn after reading
              </span>
              <span className="mt-1 block text-xs text-rose-300/70">
                The ciphertext is deleted from the database the moment it is opened once.
              </span>
            </span>
          </label>

          <Button
            data-testid="create-secret-button"
            disabled={(!text.trim() && files.length === 0) || create.isPending}
            onClick={() => create.mutate()}
            className="mt-6 w-full bg-[#00F5FF] font-mono text-xs tracking-[0.18em] text-black uppercase transition-transform duration-200 hover:bg-[#5CFBFF] active:scale-[0.99]"
          >
            {create.isPending ? "Encrypting…" : "Encrypt & generate link"}
          </Button>

          {link && (
            <div
              className="mt-6 border border-[#00F5FF]/30 bg-[#05070B] p-4"
              data-testid="secret-link-card"
            >
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#00F5FF]">
                SHARE THIS LINK — IT CONTAINS THE ONLY KEY
              </p>
              <p
                className="mt-3 font-mono text-xs break-all text-slate-300"
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
                  className="border-[#00F5FF]/40 font-mono text-xs text-[#00F5FF] hover:bg-[#00F5FF]/10"
                >
                  <Copy className="mr-2 size-3.5" /> Copy link
                </Button>
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button
                        variant="outline"
                        data-testid="show-qr-button"
                        className="border-white/15 font-mono text-xs text-slate-200 hover:bg-white/5"
                      />
                    }
                  >
                    <QrCode className="mr-2 size-3.5" /> Show QR
                  </DialogTrigger>
                  <DialogContent data-testid="qr-dialog" className="bg-[#11141E]">
                    <DialogHeader>
                      <DialogTitle className="font-heading">Scan to open</DialogTitle>
                      <DialogDescription>
                        Drawn in this tab. The link — and its key — never reached a QR service.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center py-2">
                      <QrCanvas text={link} size={260} />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {receiptUrl && (
                <div className="mt-5 border-t border-white/10 pt-4" data-testid="receipt-block">
                  <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-slate-400">
                    <Receipt className="size-3.5 text-[#00F5FF]" /> YOUR PRIVATE READ RECEIPT
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Keep this for yourself. It shows only <em>when</em> the note was opened — never
                    by whom.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/r/${receiptUrl.split("/r/")[1]}`}
                      data-testid="open-receipt-link"
                      className="border border-white/15 px-3 py-1.5 font-mono text-[11px] text-slate-200 transition-colors duration-200 hover:border-[#00F5FF]/40 hover:text-[#00F5FF]"
                    >
                      Open status page
                    </Link>
                    <button
                      type="button"
                      data-testid="copy-receipt-link-button"
                      onClick={() => copy(receiptUrl, "Receipt link")}
                      className="border border-white/15 px-3 py-1.5 font-mono text-[11px] text-slate-400 transition-colors duration-200 hover:text-white"
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
    </PageShell>
  );
}
