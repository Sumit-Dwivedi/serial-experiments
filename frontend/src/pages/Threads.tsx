import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Plus } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { solveChallenge } from "@/lib/pow";
import type { PowChallengeResponse, ThreadSummary } from "@/lib/types";
import { ago } from "@/lib/time";

export default function Threads() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [working, setWorking] = useState(false);
  const [savedToken, setSavedToken] = useState<{ id: string; token: string } | null>(null);

  const threads = useQuery({
    queryKey: ["threads", page],
    queryFn: () => apiGet<ThreadSummary[]>(`/threads?page=${page}&limit=30`),
    retry: false,
  });

  const create = useMutation({
    mutationFn: async () => {
      setWorking(true);
      try {
        const ownerToken = crypto.randomUUID();
        const challenge = await apiGet<PowChallengeResponse>("/threads/challenge?kind=thread");
        const nonce = await solveChallenge(challenge);
        const thread = await apiPost<ThreadSummary>("/threads", {
          title,
          body,
          owner_token: ownerToken,
          challenge: challenge.challenge,
          nonce,
        });
        sessionStorage.setItem(`thread_owner_${thread.id}`, ownerToken);
        return { thread, ownerToken };
      } finally {
        setWorking(false);
      }
    },
    onSuccess: ({ thread, ownerToken }) => {
      setTitle("");
      setBody("");
      setOpen(false);
      setSavedToken({ id: thread.id, token: ownerToken });
      qc.invalidateQueries({ queryKey: ["threads"] });
      toast.success("Thread dropped into the void.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message.includes("429")
          ? "Too many threads. Try again shortly."
          : "Could not post that thread.",
      ),
  });

  const downloadKey = () => {
    if (!savedToken) return;
    const blob = new Blob(
      [
        `SERIAL_EXPERIMENTS thread owner key\nthread: ${savedToken.id}\nowner_token: ${savedToken.token}\n\nKeep this to close your thread if you lose your browser session.\n`,
      ],
      { type: "text/plain" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `serial-experiments-thread-${savedToken.id.slice(0, 8)}.txt`;
    a.click();
  };

  const list = threads.isError ? [] : (threads.data ?? []);

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">
            DEAD DROP FORUM
          </p>
          <h1
            className="mt-3 max-w-xl font-heading text-3xl font-bold tracking-tight text-white"
            data-testid="threads-heading"
          >
            Start a conversation nobody can trace.
          </h1>
        </div>
        <Button
          data-testid="new-thread-button"
          onClick={() => setOpen((s) => !s)}
          className="bg-[#00F5FF] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#5CFBFF]"
        >
          <Plus className="mr-2 size-3.5" /> {open ? "Cancel" : "New thread"}
        </Button>
      </div>

      {open && (
        <div
          className="mt-6 border border-white/10 bg-[#11141E] p-5"
          data-testid="new-thread-form"
        >
          <Input
            data-testid="thread-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (5–300 characters)"
            className="border-white/10 bg-[#05070B] font-mono text-sm"
          />
          <Textarea
            data-testid="thread-body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Optional body…"
            className="mt-3 min-h-28 resize-y border-white/10 bg-[#05070B] font-mono text-sm"
          />
          <p className="mt-3 font-mono text-[11px] text-amber-400/80" data-testid="owner-warning">
            ⚠ Save this page — if you clear your browser data you lose the ability to close this
            thread.
          </p>
          <Button
            data-testid="submit-thread-button"
            disabled={title.trim().length < 5 || create.isPending}
            onClick={() => create.mutate()}
            className="mt-4 bg-[#00F5FF] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#5CFBFF]"
          >
            {working ? "Solving proof of work…" : create.isPending ? "Posting…" : "Drop the thread"}
          </Button>
        </div>
      )}

      {savedToken && (
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-[#00F5FF]/30 bg-[#05070B] p-4"
          data-testid="owner-key-card"
        >
          <p className="font-mono text-[11px] text-slate-400">
            Your owner key lives in this tab only. Download it to keep control of the thread.
          </p>
          <button
            type="button"
            data-testid="download-owner-key"
            onClick={downloadKey}
            className="flex items-center gap-2 border border-[#00F5FF]/40 px-3 py-1.5 font-mono text-[11px] text-[#00F5FF] transition-colors duration-200 hover:bg-[#00F5FF]/10"
          >
            <Download className="size-3.5" /> Download owner key
          </button>
        </div>
      )}

      <ol className="mt-8 space-y-1" data-testid="thread-list">
        {threads.isLoading && (
          <li className="font-mono text-xs text-slate-600" data-testid="threads-loading">
            Loading threads…
          </li>
        )}
        {!threads.isLoading && list.length === 0 && (
          <li className="font-mono text-xs text-slate-500" data-testid="threads-empty">
            Nothing here yet. Drop the first dead letter.
          </li>
        )}
        {list.map((t, i) => (
          <li
            key={t.id}
            data-testid={`thread-row-${t.id}`}
            className="flex gap-3 border-b border-white/5 py-2.5 font-mono text-sm"
          >
            <span className="w-6 shrink-0 text-right text-slate-600">
              {(page - 1) * 30 + i + 1}.
            </span>
            <span className="min-w-0">
              <Link
                to={`/threads/${t.id}`}
                data-testid={`thread-title-link-${t.id}`}
                className="text-slate-100 transition-colors duration-200 hover:text-[#00F5FF]"
              >
                {t.title}
              </Link>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                <span className="text-[#00F5FF]/70">OP-{t.owner_hash}</span>
                <span>·</span>
                <span>{ago(t.created_at)}</span>
                <span>·</span>
                <Link
                  to={`/threads/${t.id}`}
                  data-testid={`thread-replies-link-${t.id}`}
                  className="transition-colors duration-200 hover:text-[#00F5FF]"
                >
                  {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                </Link>
                <span>·</span>
                <span
                  data-testid={`thread-status-${t.id}`}
                  className={t.status === "open" ? "text-emerald-400/80" : "text-rose-400/80"}
                >
                  [{t.status}]
                </span>
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex gap-4 font-mono text-xs">
        {page > 1 && (
          <button
            type="button"
            data-testid="threads-prev-page"
            onClick={() => setPage((p) => p - 1)}
            className="text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
          >
            ‹ Back
          </button>
        )}
        {list.length === 30 && (
          <button
            type="button"
            data-testid="threads-next-page"
            onClick={() => setPage((p) => p + 1)}
            className="text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
          >
            More ›
          </button>
        )}
      </div>
    </PageShell>
  );
}
