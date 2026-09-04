import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { AbuseReport, ReportReason, ReportTargetType } from "@/lib/types";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "illegal", label: "Illegal content" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

/** Guesses the target kind from a pasted link so the reporter doesn't have to know ours. */
function inferType(raw: string): ReportTargetType | null {
  const v = raw.toLowerCase();
  if (v.includes("/v/")) return "secret";
  if (v.includes("/threads/")) return "thread";
  if (v.includes("/wall")) return "wall_post";
  return null;
}

export default function Report() {
  const [target, setTarget] = useState("");
  const [type, setType] = useState<ReportTargetType | "">("");
  const [reason, setReason] = useState<ReportReason>("illegal");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  const resolvedType: ReportTargetType = type || inferType(target) || "wall_post";

  const submit = useMutation({
    mutationFn: () =>
      apiPost<AbuseReport>("/reports", {
        target_type: resolvedType,
        target_id: target,
        reason,
        note,
      }),
    onSuccess: () => {
      setDone(true);
      setTarget("");
      setNote("");
      toast.success("Report logged. It will be reviewed.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message.includes("429")
          ? "Too many reports. Try again shortly."
          : "Connection failed.",
      ),
  });

  return (
    <PageShell>
      <p className="font-mono text-[11px] tracking-[0.4em] text-[#E8672E] uppercase">
        LAYER 07 // ABUSE CHANNEL
      </p>
      <h1
        className="type-reveal mt-4 font-mono text-3xl font-bold tracking-tight text-[#ECE7DC] sm:text-4xl"
        data-testid="report-heading"
      >
        Something here should not exist.
      </h1>
      <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-[#6B6F76]">
        Paste the link or id. No account, no name, nothing about you is recorded — only what
        you paste. Prohibited use is defined in the{" "}
        <Link
          to="/terms"
          data-testid="report-terms-link"
          className="glitch-hover text-[#E8672E] transition-none hover:text-[#F07A3F]"
        >
          acceptable use policy
        </Link>
        .
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <section
          className="border border-white/10 bg-[#17171A] p-5"
          data-testid="report-form"
        >
          <label className="block">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#555961] uppercase">
              LINK OR ID
            </span>
            <input
              data-testid="report-target-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://…/v/4632329c  ·  or a post / thread id"
              className="mt-2 w-full border border-white/10 bg-[#0E0E10] px-3 py-2 font-mono text-xs text-[#ECE7DC] outline-none transition-colors duration-200 placeholder:text-[#3D4048] focus-visible:border-[#E8672E]/50"
            />
            <span className="mt-2 block font-mono text-[11px] text-[#3D4048]">
              The key after # is ignored — never paste it, we can't use it.
            </span>
          </label>

          <label className="mt-5 block">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#555961] uppercase">
              TARGET TYPE
            </span>
            <select
              data-testid="report-type-select"
              value={type}
              onChange={(e) => setType(e.target.value as ReportTargetType | "")}
              className="mt-2 w-full border border-white/10 bg-[#0E0E10] px-3 py-2 font-mono text-xs text-[#ECE7DC] outline-none focus-visible:border-[#E8672E]/50"
            >
              <option value="">auto-detect from link</option>
              <option value="secret">secret link</option>
              <option value="wall_post">wall post</option>
              <option value="thread">thread</option>
              <option value="reply">reply</option>
            </select>
          </label>

          <fieldset className="mt-5" data-testid="report-reason-group">
            <legend className="font-mono text-[11px] tracking-[0.2em] text-[#555961] uppercase">
              REASON
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  data-testid={`report-reason-${r.value}`}
                  onClick={() => setReason(r.value)}
                  className={`glitch-hover border px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-none ${
                    reason === r.value
                      ? "border-[#E8672E]/60 bg-[#E8672E]/10 text-[#E8672E]"
                      : "border-white/10 text-[#6B6F76] hover:text-[#ECE7DC]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="font-mono text-[11px] tracking-[0.2em] text-[#555961] uppercase">
              NOTE (OPTIONAL)
            </span>
            <Textarea
              data-testid="report-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What is wrong with it. Do not include personal data."
              className="mt-2 min-h-24 resize-y border-white/10 bg-[#0E0E10] font-mono text-xs"
            />
          </label>

          <Button
            data-testid="report-submit-button"
            disabled={!target.trim() || submit.isPending}
            onClick={() => submit.mutate()}
            className="glitch-hover mt-5 w-full bg-[#E8672E] font-mono text-xs tracking-[0.16em] text-black uppercase hover:bg-[#F07A3F]"
          >
            <Flag className="mr-2 size-3.5" />
            {submit.isPending ? (
              <span className="cursor-blink">Transmitting</span>
            ) : (
              "File report"
            )}
          </Button>

          {done && (
            <div
              className="mt-5 border border-[#6B8F71]/40 bg-[#0F1A13] px-4 py-3"
              data-testid="report-confirmation"
            >
              <p className="font-mono text-sm text-[#B8C9B8]">
                Report received. It will be reviewed and the id removed if it breaches the
                policy. Nothing identifying you was stored.
              </p>
            </div>
          )}
        </section>

        <aside
          className="border border-white/10 bg-[#0E0E10] p-5 font-mono text-sm leading-relaxed text-[#B8B3AA]"
          data-testid="report-explainer"
        >
          <p className="font-mono text-[11px] tracking-[0.22em] text-[#555961] uppercase">
            HOW A REPORT IS HANDLED
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <span className="text-[#E8672E]">01</span> The report is stored with the id, the
              reason and your note. No IP, no user agent, no account.
            </li>
            <li>
              <span className="text-[#E8672E]">02</span> Reported content is never
              auto-deleted — a human reviews it first.
            </li>
            <li>
              <span className="text-[#E8672E]">03</span> Removal happens by id. Encrypted
              secrets are deleted without ever being decrypted, because they cannot be.
            </li>
            <li>
              <span className="text-[#E8672E]">04</span> Resolved reports are purged after 30
              days.
            </li>
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}
