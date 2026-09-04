import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, Send, Ghost } from "lucide-react";

import PageShell from "@/components/PageShell";
import WallPostCard from "@/components/WallPostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { solveChallenge } from "@/lib/pow";
import type { PowChallengeResponse, WallPost } from "@/lib/types";

const TAGS: Record<string, string> = {
  thoughts: "thoughts",
  confessions: "confessions",
  leaks: "leaks",
  whistleblows: "whistleblows",
};

const LIFE_LABELS: Record<string, string> = {
  "24": "vanishes in 24 hours",
  "48": "vanishes in 48 hours",
  "168": "vanishes in 7 days",
};

export default function AnonymousWall() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("thoughts");
  const [filter, setFilter] = useState("all");
  const [life, setLife] = useState("48");
  const [powing, setPowing] = useState(false);

  const posts = useQuery({
    queryKey: ["wall"],
    queryFn: () => apiGet<WallPost[]>("/wall"),
    retry: false,
  });

  const publish = useMutation({
    mutationFn: async () => {
      // Proof of work: a few seconds of CPU per post makes flooding expensive without
      // identifying anyone.
      setPowing(true);
      try {
        const challenge = await apiGet<PowChallengeResponse>("/wall/challenge");
        const nonce = await solveChallenge(challenge);
        return await apiPost<WallPost>("/wall", {
          body,
          tag,
          expires_in_hours: Number(life),
          challenge: challenge.challenge,
          nonce,
        });
      } finally {
        setPowing(false);
      }
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["wall"] });
      toast.success("Transmitted. No identity attached.");
    },
    onError: (e) =>
      toast.error(
        e instanceof Error && e.message.includes("400")
          ? "Post rejected."
          : e instanceof Error && e.message.includes("429")
            ? "Too many posts. Try again shortly."
            : "Could not publish right now.",
      ),
  });

  const all = posts.isError ? [] : (posts.data ?? []);
  const counts = all.reduce<Record<string, number>>((acc, p) => {
    acc[p.tag] = (acc[p.tag] ?? 0) + 1;
    return acc;
  }, {});
  const list = filter === "all" ? all : all.filter((p) => p.tag === filter);

  return (
    <PageShell>
      <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[#E8672E]">
        LAYER 07 // OPEN LINE
      </p>
      <h1
        className="type-reveal mt-4 font-mono text-3xl font-bold tracking-tight text-white sm:text-4xl"
        data-testid="wall-heading"
      >
        No matter where you go, everyone's connected.
      </h1>
      <p className="mt-4 max-w-xl text-[15px] text-[#6B6F76]">
        No account. No IP. No fingerprint. Everything here dissolves.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section
          className="h-fit border border-white/10 bg-[#17171A] p-5 lg:sticky lg:top-24"
          data-testid="wall-composer"
        >
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.22em] text-[#555961]">
            <Radio className="size-3.5 text-[#E8672E]" /> BROADCAST // ANONYMOUS
          </div>
          <Textarea
            data-testid="wall-composer-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say the thing you cannot sign your name to…"
            className="min-h-36 resize-y border-white/10 bg-[#0E0E10] text-sm"
          />
          <Select value={tag} onValueChange={(v: string) => setTag(v)}>
            <SelectTrigger
              className="mt-4 w-full border-white/10 bg-[#0E0E10] font-mono text-xs"
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
          <Select value={life} onValueChange={(v: string) => setLife(v)}>
            <SelectTrigger
              className="mt-3 w-full border-white/10 bg-[#0E0E10] font-mono text-xs"
              data-testid="wall-life-select-trigger"
            >
              <SelectValue>{(v) => LIFE_LABELS[v as string]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LIFE_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v} data-testid={`wall-life-option-${v}`}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            data-testid="wall-publish-button"
            disabled={!body.trim() || publish.isPending}
            onClick={() => publish.mutate()}
            className="glitch-hover mt-4 w-full bg-[#E8672E] font-mono text-xs tracking-[0.18em] text-black uppercase hover:bg-[#F07A3F]"
          >
            <Send className="mr-2 size-3.5" />
            {powing ? <span className="cursor-blink">Solving proof of work</span> : publish.isPending ? <span className="cursor-blink">Transmitting</span> : "Transmit"}
          </Button>
        </section>

        <section className="space-y-4" data-testid="wall-feed">
          <div
            className="flex flex-wrap gap-2 border-b border-white/10 pb-4"
            data-testid="wall-filter-bar"
          >
            {["all", ...Object.keys(TAGS)].map((t) => {
              const active = filter === t;
              const count = t === "all" ? all.length : (counts[t] ?? 0);
              return (
                <button
                  key={t}
                  type="button"
                  data-testid={`wall-filter-${t}`}
                  onClick={() => setFilter(t)}
                  className={`border px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors duration-200 ${
                    active
                      ? "border-[#E8672E]/50 bg-[#E8672E]/10 text-[#E8672E]"
                      : "border-white/10 text-[#555961] hover:border-white/25 hover:text-[#D4CFC6]"
                  }`}
                >
                  {t} <span className="text-[#3D4048]">{count}</span>
                </button>
              );
            })}
          </div>
          {posts.isLoading && (
            <p className="font-mono text-xs text-[#3D4048]" data-testid="wall-loading">
              Loading feed…
            </p>
          )}
          {!posts.isLoading && list.length === 0 && (
            <div
              className="border border-dashed border-white/10 p-10 text-center"
              data-testid="wall-empty-state"
            >
              <Ghost className="mx-auto size-6 text-[#3D4048]" />
              <p className="mt-3 text-sm text-[#555961]">
                {filter === "all"
                  ? "The wall is silent. Be the first ghost to speak."
                  : `No ${filter} yet. Be the first ghost to post one.`}
              </p>
            </div>
          )}
          {list.map((p, i) => (
            <WallPostCard key={p.id} post={p} offset={i % 3 === 1} />
          ))}
        </section>
      </div>
    </PageShell>
  );
}
