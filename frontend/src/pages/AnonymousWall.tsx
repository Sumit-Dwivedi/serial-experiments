import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, Send, Ghost } from "lucide-react";

import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import type { WallPost } from "@/lib/types";

const TAGS: Record<string, string> = {
  thoughts: "thoughts",
  confessions: "confessions",
  leaks: "leaks",
  whistleblows: "whistleblows",
};

export default function AnonymousWall() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("thoughts");

  const posts = useQuery({
    queryKey: ["wall"],
    queryFn: () => apiGet<WallPost[]>("/wall"),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: () => apiPost<WallPost>("/wall", { body, tag }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["wall"] });
      toast.success("Posted anonymously. No identity was attached.");
    },
    onError: () => toast.error("Could not publish right now."),
  });

  const echo = useMutation({
    mutationFn: (id: string) => apiPost<WallPost>(`/wall/${id}/echo`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wall"] }),
  });

  const list = posts.isError ? [] : (posts.data ?? []);

  return (
    <PageShell>
      <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">
        ZERO-METADATA PUBLIC FEED
      </p>
      <h1
        className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
        data-testid="wall-heading"
      >
        The anonymous wall
      </h1>
      <p className="mt-4 max-w-xl text-[15px] text-slate-400">
        Posts carry a throwaway ghost tag and nothing else — no account, no IP, no fingerprint.
        Everything here evaporates after 7 days.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section
          className="h-fit border border-white/10 bg-[#11141E] p-5 lg:sticky lg:top-24"
          data-testid="wall-composer"
        >
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-slate-500">
            <Radio className="size-3.5 text-[#00F5FF]" /> BROADCAST ANONYMOUSLY
          </div>
          <Textarea
            data-testid="wall-post-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say the thing you cannot sign your name to…"
            className="min-h-36 resize-y border-white/10 bg-[#05070B] text-sm"
          />
          <Select value={tag} onValueChange={(v: string) => setTag(v)}>
            <SelectTrigger
              className="mt-4 w-full border-white/10 bg-[#05070B] font-mono text-xs"
              data-testid="wall-tag-select-trigger"
            >
              <SelectValue>{(v) => TAGS[v as string]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TAGS).map((t) => (
                <SelectItem key={t} value={t} data-testid={`wall-tag-option-${t}`}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            data-testid="wall-publish-button"
            disabled={!body.trim() || publish.isPending}
            onClick={() => publish.mutate()}
            className="mt-4 w-full bg-[#00F5FF] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#5CFBFF]"
          >
            <Send className="mr-2 size-3.5" />
            {publish.isPending ? "Posting…" : "Post to the wall"}
          </Button>
        </section>

        <section className="space-y-4" data-testid="wall-feed">
          {posts.isLoading && (
            <p className="font-mono text-xs text-slate-600" data-testid="wall-loading">
              Loading feed…
            </p>
          )}
          {!posts.isLoading && list.length === 0 && (
            <div
              className="border border-dashed border-white/10 p-10 text-center"
              data-testid="wall-empty-state"
            >
              <Ghost className="mx-auto size-6 text-slate-600" />
              <p className="mt-3 text-sm text-slate-500">
                The wall is silent. Be the first ghost to speak.
              </p>
            </div>
          )}
          {list.map((p, i) => (
            <article
              key={p.id}
              data-testid={`wall-post-${p.id}`}
              className={`border border-white/10 bg-[#11141E] p-5 transition-colors duration-200 hover:border-[#00F5FF]/30 ${
                i % 3 === 1 ? "lg:ml-8" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] tracking-wider text-[#00F5FF]">
                  {p.ghost}
                </span>
                <Badge variant="outline" className="font-mono text-[10px] text-slate-400">
                  {p.tag}
                </Badge>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">
                {p.body}
              </p>
              <button
                type="button"
                data-testid={`wall-echo-button-${p.id}`}
                onClick={() => echo.mutate(p.id)}
                className="mt-4 font-mono text-[11px] tracking-wider text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
              >
                ▲ ECHO {p.echoes}
              </button>
            </article>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
