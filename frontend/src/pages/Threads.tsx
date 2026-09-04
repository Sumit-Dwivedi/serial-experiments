import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Plus, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [working, setWorking] = useState(false);
  const [savedToken, setSavedToken] = useState<{ id: string; token: string } | null>(null);

  // 200ms debounce keeps typing snappy without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const threads = useQuery({
    queryKey: ["threads", page, debounced],
    queryFn: () =>
      apiGet<ThreadSummary[]>(
        `/threads?page=${page}&limit=30&q=${encodeURIComponent(debounced)}`,
      ),
    placeholderData: (prev) => prev,
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
      toast.success("Thread dropped into the Wired.");
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
        `SERIAL://EXPERIMENTS thread owner key\nthread: ${savedToken.id}\nowner_token: ${savedToken.token}\n\nKeep this to close your thread if you lose your browser session.\n`,
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
          <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#E8672E]">
            LAYER 07 // DEAD LETTER PROTOCOL
          </p>
          <h1
            className="type-reveal mt-3 max-w-xl font-mono text-3xl font-bold tracking-tight text-white"
            data-testid="threads-heading"
          >
            If you're not remembered, you never existed.
          </h1>
        </div>
        <Button
          data-testid="new-thread-button"
          onClick={() => setOpen((s) => !s)}
          className="glitch-hover bg-[#E8672E] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#F07A3F]"
        >
          <Plus className="mr-2 size-3.5" /> {open ? "Cancel" : "New thread"}
        </Button>
      </div>

      <div className="relative mt-6 max-w-md" data-testid="thread-search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#555961]" />
        <input
          data-testid="thread-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title…"
          aria-label="Search threads by title"
          className="w-full border border-white/10 bg-[#0E0E10] py-2 pr-16 pl-9 font-mono text-xs text-[#ECE7DC] outline-none transition-colors duration-200 placeholder:text-[#3D4048] focus-visible:border-[#E8672E]/50"
        />
        {search && (
          <button
            type="button"
            data-testid="thread-search-clear"
            onClick={() => setSearch("")}
            className="glitch-hover absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11px] tracking-wider text-[#555961] uppercase transition-none hover:text-[#E8672E]"
          >
            clear
          </button>
        )}
      </div>

      {open && (
        <div
          className="mt-6 border border-white/10 bg-[#17171A] p-5"
          data-testid="new-thread-form"
        >
          <Input
            data-testid="thread-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (5–300 characters)"
            className="border-white/10 bg-[#0E0E10] font-mono text-sm"
          />
          <Textarea
            data-testid="thread-body-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Optional body…"
            className="mt-3 min-h-28 resize-y border-white/10 bg-[#0E0E10] font-mono text-sm"
          />
          <p className="mt-3 font-mono text-[11px] text-[#C4884D]/80" data-testid="owner-warning">
            ⚠ Save this page — if you clear your browser data you lose the ability to close this
            thread.
          </p>
          <Button
            data-testid="submit-thread-button"
            disabled={title.trim().length < 5 || create.isPending}
            onClick={() => create.mutate()}
            className="mt-4 bg-[#E8672E] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#F07A3F]"
          >
            {working ? <span className="cursor-blink">Solving proof of work</span> : create.isPending ? <span className="cursor-blink">Transmitting</span> : "Drop into the Wired"}
          </Button>
        </div>
      )}

      {savedToken && (
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-[#E8672E]/30 bg-[#0E0E10] p-4"
          data-testid="owner-key-card"
        >
          <p className="font-mono text-[11px] text-[#6B6F76]">
            Your owner key lives in this tab only. Download it to keep control of the thread.
          </p>
          <button
            type="button"
            data-testid="download-owner-key"
            onClick={downloadKey}
            className="glitch-hover glitch-hover flex items-center gap-2 border border-[#E8672E]/40 px-3 py-1.5 font-mono text-[11px] text-[#E8672E] transition-colors duration-200 hover:bg-[#E8672E]/10"
          >
            <Download className="size-3.5" /> Download owner key
          </button>
        </div>
      )}

      <ol className="mt-8 space-y-1" data-testid="thread-list">
        {threads.isLoading && (
          <li className="font-mono text-xs text-[#3D4048]" data-testid="threads-loading">
            Loading threads…
          </li>
        )}
        {!threads.isLoading && list.length === 0 && (
          <li className="font-mono text-xs text-[#555961]" data-testid="threads-empty">
            {debounced
              ? `No thread title matches "${debounced}".`
              : "The line is quiet. Nothing has been transmitted yet."}
          </li>
        )}
        {list.map((t, i) => (
          <li
            key={t.id}
            data-testid={`thread-row-${t.id}`}
            className="flex gap-3 border-b border-white/5 py-2.5 font-mono text-sm"
          >
            <span className="w-6 shrink-0 text-right text-[#3D4048]">
              {(page - 1) * 30 + i + 1}.
            </span>
            <span className="min-w-0">
              <Link
                to={`/threads/${t.id}`}
                data-testid={`thread-title-link-${t.id}`}
                className="text-[#ECE7DC] transition-colors duration-200 hover:text-[#E8672E]"
              >
                {t.title}
              </Link>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[#555961]">
                <span className="text-[#E8672E]/70">OP-{t.owner_hash}</span>
                <span>·</span>
                <span>{ago(t.created_at)}</span>
                <span>·</span>
                <Link
                  to={`/threads/${t.id}`}
                  data-testid={`thread-replies-link-${t.id}`}
                  className="transition-colors duration-200 hover:text-[#E8672E]"
                >
                  {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                </Link>
                <span>·</span>
                <span
                  data-testid={`thread-status-${t.id}`}
                  className={t.status === "open" ? "text-[#6B8F71]/80" : "text-[#9A6B6B]/80"}
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
            className="glitch-hover text-[#555961] transition-colors duration-200 hover:text-[#E8672E]"
          >
            ‹ Back
          </button>
        )}
        {list.length === 30 && (
          <button
            type="button"
            data-testid="threads-next-page"
            onClick={() => setPage((p) => p + 1)}
            className="glitch-hover text-[#555961] transition-colors duration-200 hover:text-[#E8672E]"
          >
            More ›
          </button>
        )}
      </div>
    </PageShell>
  );
}
