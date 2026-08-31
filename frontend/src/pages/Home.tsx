import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Flame, KeyRound, Lock, ShieldCheck, Timer, Eye, EyeOff } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiPost } from "@/lib/api";
import { encryptText } from "@/lib/crypto";
import type { SecretCreated } from "@/lib/types";

const EXPIRY_LABELS: Record<string, string> = {
  "1": "1 hour",
  "24": "24 hours",
  "168": "7 days",
};

export default function Home() {
  const [text, setText] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiry, setExpiry] = useState("24");
  const [burn, setBurn] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [cipherPreview, setCipherPreview] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const bundle = await encryptText(text, passphrase || undefined);
      const created = await apiPost<SecretCreated>("/secrets", {
        cipher_text: bundle.cipherText,
        iv: bundle.iv,
        salt: bundle.salt,
        has_passphrase: Boolean(passphrase),
        burn_after_read: burn,
        expires_in_hours: Number(expiry),
      });
      const frag = bundle.fragmentKey ? `#key=${bundle.fragmentKey}` : "";
      return {
        url: `${window.location.origin}/v/${created.id}${frag}`,
        preview: bundle.cipherText.slice(0, 220),
      };
    },
    onSuccess: (r) => {
      setLink(r.url);
      setCipherPreview(r.preview);
      setText("");
      setPassphrase("");
      toast.success("Encrypted locally. Only ciphertext was uploaded.");
    },
    onError: () => toast.error("Could not store the encrypted payload. Try again."),
  });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Secret link copied.");
    } catch {
      toast.message("Copy manually — clipboard is blocked here.");
    }
  };

  return (
    <PageShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        {/* Left: brand + telemetry */}
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
            Your text is encrypted inside this browser tab before anything is sent. The
            decryption key rides in the link fragment — a part of the URL browsers never
            transmit. We store ciphertext and nothing else: no account, no IP, no user agent.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, label: "Encrypted in-browser", value: "crypto.subtle" },
              { icon: KeyRound, label: "Key transport", value: "URL #fragment only" },
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

        {/* Right: creator */}
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
          <Textarea
            id="secret-text"
            data-testid="secret-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste anything. It never leaves this tab unencrypted…"
            className="mt-2 min-h-44 resize-y border-white/10 bg-[#05070B] font-mono text-sm text-slate-200 focus-visible:ring-[#00F5FF]/50"
          />
          <p className="mt-2 font-mono text-[11px] text-slate-600" data-testid="char-counter">
            {text.length} chars · entropy source: crypto.getRandomValues
          </p>

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
            disabled={!text.trim() || create.isPending}
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
              <Button
                onClick={copy}
                data-testid="copy-secret-link-button"
                variant="outline"
                className="mt-4 border-[#00F5FF]/40 font-mono text-xs text-[#00F5FF] hover:bg-[#00F5FF]/10"
              >
                <Copy className="mr-2 size-3.5" /> Copy link
              </Button>
              {cipherPreview && (
                <p
                  className="mt-4 font-mono text-[10px] leading-relaxed break-all text-slate-600"
                  data-testid="ciphertext-preview"
                >
                  stored payload: {cipherPreview}…
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
