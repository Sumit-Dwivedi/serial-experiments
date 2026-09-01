import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CornerDownRight, MessageSquare, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import type { WallPost } from "@/lib/types";

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h left` : `${Math.floor(hrs / 24)}d ${hrs % 24}h left`;
}

export default function WallPostCard({ post, offset }: { post: WallPost; offset: boolean }) {
  const qc = useQueryClient();
  const [, forceTick] = useState(0);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");

  // Keep the countdown badge honest without refetching.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const echo = useMutation({
    mutationFn: () => apiPost<WallPost>(`/wall/${post.id}/echo`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wall"] }),
  });

  const reply = useMutation({
    mutationFn: () => apiPost<WallPost>(`/wall/${post.id}/replies`, { body: draft }),
    onSuccess: () => {
      setDraft("");
      setReplying(false);
      qc.invalidateQueries({ queryKey: ["wall"] });
      toast.success("Replied anonymously.");
    },
    onError: () => toast.error("Could not post that reply."),
  });

  return (
    <article
      data-testid={`wall-post-${post.id}`}
      className={`border border-white/10 bg-[#11141E] p-5 transition-colors duration-200 hover:border-[#00F5FF]/30 ${
        offset ? "lg:ml-8" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wider text-[#00F5FF]">{post.ghost}</span>
        <span className="flex items-center gap-2">
          <span
            className="font-mono text-[10px] tracking-wider text-slate-500"
            data-testid={`wall-post-countdown-${post.id}`}
          >
            ⏳ {timeLeft(post.expires_at)}
          </span>
          <Badge variant="outline" className="font-mono text-[10px] text-slate-400">
            {post.tag}
          </Badge>
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">
        {post.body}
      </p>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          data-testid={`wall-echo-button-${post.id}`}
          onClick={() => echo.mutate()}
          className="font-mono text-[11px] tracking-wider text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
        >
          ▲ ECHO {post.echoes}
        </button>
        <button
          type="button"
          data-testid={`wall-reply-toggle-${post.id}`}
          onClick={() => setReplying((s) => !s)}
          className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
        >
          <MessageSquare className="size-3" /> REPLY {post.replies.length || ""}
        </button>
      </div>

      {post.replies.length > 0 && (
        <ul
          className="mt-4 space-y-3 border-l border-white/10 pl-4"
          data-testid={`wall-replies-${post.id}`}
        >
          {post.replies.map((r) => (
            <li key={r.id} data-testid={`wall-reply-${r.id}`}>
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-slate-500">
                <CornerDownRight className="size-3" /> {r.ghost}
              </span>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
                {r.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <Textarea
            data-testid={`wall-reply-input-${post.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Reply as a new ghost…"
            className="min-h-20 resize-y border-white/10 bg-[#05070B] text-sm"
          />
          <Button
            data-testid={`wall-reply-submit-${post.id}`}
            disabled={!draft.trim() || reply.isPending}
            onClick={() => reply.mutate()}
            size="sm"
            className="mt-3 bg-[#00F5FF] font-mono text-[11px] tracking-[0.14em] text-black uppercase hover:bg-[#5CFBFF]"
          >
            <Send className="mr-2 size-3" />
            {reply.isPending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      )}
    </article>
  );
}
