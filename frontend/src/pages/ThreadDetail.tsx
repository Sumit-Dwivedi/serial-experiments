import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, MessageSquare } from "lucide-react";

import PageShell from "@/components/PageShell";
import ReplyNode from "@/components/ReplyNode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { solveChallenge } from "@/lib/pow";
import { ago } from "@/lib/time";
import { participantToken } from "@/lib/identity";
import type { PowChallengeResponse, ThreadDetailData, ThreadReply } from "@/lib/types";

export default function ThreadDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);

  const thread = useQuery({
    queryKey: ["thread", id],
    queryFn: () => apiGet<ThreadDetailData>(`/threads/${id}`),
    retry: false,
  });

  const ownerToken = sessionStorage.getItem(`thread_owner_${id}`);
  const refresh = () => qc.invalidateQueries({ queryKey: ["thread", id] });

  const post = useMutation({
    mutationFn: async () => {
      setWorking(true);
      try {
        const challenge = await apiGet<PowChallengeResponse>("/threads/challenge?kind=reply");
        const nonce = await solveChallenge(challenge);
        return await apiPost<ThreadReply>(`/threads/${id}/replies`, {
          body: draft,
          participant_token: participantToken(id),
          challenge: challenge.challenge,
          nonce,
        });
      } finally {
        setWorking(false);
      }
    },
    onSuccess: () => {
      setDraft("");
      refresh();
      toast.success("Reply posted.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message.includes("429")
          ? "Too many replies. Slow down a moment."
          : "Could not post that reply.",
      ),
  });

  const close = useMutation({
    mutationFn: () => apiPatch(`/threads/${id}/close`, { owner_token: ownerToken }),
    onSuccess: () => {
      refresh();
      toast.success("Thread sealed.");
    },
    onError: () => toast.error("Could not close the thread."),
  });

  if (thread.isError) {
    return (
      <PageShell>
        <p className="font-mono text-sm text-[#9A6B6B]" data-testid="thread-missing">
          This thread no longer exists — it was closed out or expired.
        </p>
      </PageShell>
    );
  }

  const t = thread.data;
  const closed = t?.status === "closed";

  return (
    <PageShell>
      <Link
        to="/threads"
        data-testid="back-to-threads"
        className="font-mono text-[11px] text-[#555961] hover:text-[#E8672E]"
      >
        ‹ all threads
      </Link>

      {t && (
        <>
          <h1
            className="type-reveal mt-4 flex items-center gap-3 font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl"
            data-testid="thread-title"
          >
            {!closed && (
              <span
                data-testid="thread-live-dot"
                aria-hidden="true"
                className="inline-block size-[6px] shrink-0 animate-pulse rounded-full bg-[#6B8F71] shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]"
              />
            )}
            {t.title}
          </h1>
          <p className="mt-2 font-mono text-[11px] text-[#555961]" data-testid="thread-meta">
            <span className="text-[#E8672E]/70">OP-{t.owner_hash}</span> · {ago(t.created_at)} ·{" "}
            {t.reply_count} replies ·{" "}
            <span
              data-testid="thread-status-badge"
              className={closed ? "text-[#9A6B6B]" : "text-[#6B8F71]"}
            >
              {closed ? "[SEALED]" : "[open]"}
            </span>
          </p>
          {t.body && (
            <p
              className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap text-[#B8B3AA]"
              data-testid="thread-body"
            >
              {t.body}
            </p>
          )}

          {ownerToken && !closed && (
            <Button
              data-testid="close-thread-button"
              onClick={() => close.mutate()}
              disabled={close.isPending}
              variant="outline"
              className="glitch-hover mt-5 border-[#7A2A2A]/40 font-mono text-xs text-[#7A2A2A] hover:bg-[#7A2A2A]/10"
            >
              <Lock className="mr-2 size-3.5" />
              {close.isPending ? <span className="cursor-blink">Sealing</span> : "Seal this thread"}
            </Button>
          )}

          {closed && (
            <div
              className="mt-5 flex items-center gap-2 border border-[#7A2A2A]/30 bg-[#1A0F0F] px-4 py-3"
              data-testid="closed-banner"
            >
              <Lock className="size-4 text-[#7A2A2A]" />
              <p className="text-sm text-[#D4A9A9]">
                This thread has been closed by the creator.
              </p>
            </div>
          )}

          {!closed && (
            <div className="mt-8 border-t border-white/10 pt-6" data-testid="thread-composer">
              <Textarea
                data-testid="thread-reply-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add to the discussion…"
                className="min-h-24 resize-y border-white/10 bg-[#0E0E10] text-sm"
              />
              <Button
                data-testid="thread-reply-submit"
                disabled={!draft.trim() || post.isPending}
                onClick={() => post.mutate()}
                className="glitch-hover mt-3 bg-[#E8672E] font-mono text-xs tracking-[0.16em] text-black uppercase hover:bg-[#F07A3F]"
              >
                <MessageSquare className="mr-2 size-3.5" />
                {working ? <span className="cursor-blink">Solving proof of work</span> : post.isPending ? <span className="cursor-blink">Transmitting</span> : "Respond"}
              </Button>
            </div>
          )}

          <ul className="mt-8 space-y-1" data-testid="reply-tree">
            {t.replies.length === 0 && (
              <li className="font-mono text-xs text-[#3D4048]" data-testid="no-replies">
                No replies yet.
              </li>
            )}
            {t.replies.map((r) => (
              <ReplyNode
                key={r.id}
                reply={r}
                threadId={id}
                closed={closed}
                onReplied={refresh}
              />
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
