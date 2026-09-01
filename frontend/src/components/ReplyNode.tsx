import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import ReplyChildren from "@/components/ReplyChildren";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { solveChallenge } from "@/lib/pow";
import { ago } from "@/lib/time";
import { participantToken } from "@/lib/identity";
import type { PowChallengeResponse, ThreadReply } from "@/lib/types";

const MAX_DEPTH = 5;

export default function ReplyNode({
  reply,
  threadId,
  closed,
  onReplied,
}: {
  reply: ThreadReply;
  threadId: string;
  closed: boolean;
  onReplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const send = useMutation({
    mutationFn: async () => {
      setWorking(true);
      try {
        const challenge = await apiGet<PowChallengeResponse>("/threads/challenge?kind=reply");
        const nonce = await solveChallenge(challenge);
        return await apiPost<ThreadReply>(`/threads/${threadId}/replies`, {
          body: draft,
          participant_token: participantToken(threadId),
          parent_reply_id: reply.id,
          challenge: challenge.challenge,
          nonce,
        });
      } finally {
        setWorking(false);
      }
    },
    onSuccess: () => {
      setDraft("");
      setOpen(false);
      onReplied();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message.includes("429")
          ? "Too many replies. Slow down a moment."
          : "Could not post that reply.",
      ),
  });

  // Deep nesting stays readable on phones: 8px per level under 640px, 24px above.
  const indent = reply.depth === 0 ? "" : "ml-2 sm:ml-6 border-l border-white/10 pl-3 sm:pl-4";
  const reRoot = reply.depth >= 3 && reply.children.length > 0;

  return (
    <li className={indent} data-testid={`reply-${reply.id}`}>
      <div className="py-2 font-mono text-[11px] text-slate-500">
        <button
          type="button"
          data-testid={`reply-collapse-${reply.id}`}
          onClick={() => setCollapsed((c) => !c)}
          className="mr-2 text-slate-600 transition-colors duration-200 hover:text-[#00F5FF]"
        >
          [{collapsed ? "+" : "-"}]
        </button>
        <span className={reply.is_op ? "text-[#00F5FF]" : "text-slate-400"}>
          {reply.is_op ? "OP" : "Anon"}-{reply.participant_hash}
        </span>
        <span className="mx-2">·</span>
        <span>{ago(reply.created_at)}</span>
      </div>
      {!collapsed && (
        <>
          <p className="pb-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
            {reply.body}
          </p>
          {!closed && reply.depth < MAX_DEPTH && (
            <button
              type="button"
              data-testid={`reply-link-${reply.id}`}
              onClick={() => setOpen((s) => !s)}
              className="pb-2 font-mono text-[11px] text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
            >
              reply
            </button>
          )}
          {open && (
            <div className="pb-3">
              <Textarea
                data-testid={`reply-input-${reply.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-20 resize-y border-white/10 bg-[#05070B] text-sm"
              />
              <Button
                data-testid={`reply-submit-${reply.id}`}
                size="sm"
                disabled={!draft.trim() || send.isPending}
                onClick={() => send.mutate()}
                className="mt-2 bg-[#00F5FF] font-mono text-[11px] text-black uppercase hover:bg-[#5CFBFF]"
              >
                {working ? "Solving PoW…" : send.isPending ? "Posting…" : "Reply"}
              </Button>
            </div>
          )}
          {reRoot ? (
            <Link
              to={`/threads/${threadId}?root=${reply.id}`}
              data-testid={`continue-thread-${reply.id}`}
              className="mb-2 block font-mono text-[11px] text-[#00F5FF]/80 hover:text-[#00F5FF]"
            >
              Continue thread →
            </Link>
          ) : (
            reply.children.length > 0 && (
              <ReplyChildren
                items={reply.children}
                threadId={threadId}
                closed={closed}
                onReplied={onReplied}
              />
            )
          )}
        </>
      )}
    </li>
  );
}
