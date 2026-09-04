# Session debrief — 2026-09-04

Purpose of this file: not a changelog (git already has that) — this is a learning
record. For each problem, the point isn't "what changed" but "what's the general
principle here that shows up again in any infra/SRE/networking job." Written for you
to re-read in a month and check whether it still makes sense; if it doesn't, you've
learned something new since.

Not committed to git on purpose — same reason `DEPLOYMENT_RUNBOOK.md` isn't: this repo
is now public, and a debrief full of "here's exactly what was wrong and where" is more
useful to an attacker than to a stranger reading your code.

---

## 1. What actually happened today (chronological)

### CORS was wide open (`allow_origins='*'`)
**Problem**: the FastAPI backend accepted cross-origin requests from *any* website's
JavaScript. The app itself never needed this — the frontend only ever calls same-origin
`/api/...` (proxied server-side by a Cloudflare Worker) — so the wildcard was pure
attack surface with zero upside.
**Fix**: default changed to the real frontend origin; production value set via the
`CORS_ORIGINS` env var on Render.
**Principle**: CORS is a *browser-enforced allowlist for who's permitted to read a
response cross-origin*. It protects nothing by itself if your own traffic never needed
the door open in the first place — the fix isn't "make CORS smarter," it's "stop
leaving a door open that nothing walks through." This generalizes hard in infra: any
config default of "allow everything" should be justified by an actual use case, not
left because narrowing it felt like unnecessary work.

### Dead `allow_credentials=True` + stale comment
**Problem**: `api.ts` had a comment claiming "auth rides the httpOnly session cookie" —
but a grep across the entire backend found zero cookie-setting code anywhere. The app
has no accounts, so the comment described a feature that never existed (template
leftover). `allow_credentials=True` was consequently a no-op.
**Fix**: removed both.
**Principle**: a stale comment is worse than no comment — it actively misleads the next
person (including a future you) into "preserving" behavior that isn't real, or skipping
work because they think something already exists. When you find one, the fix is always
"delete it," never "leave it, it's probably fine." This is the same instinct as
removing dead code: if nothing reads it and nothing depends on it, its only job left is
to lie to someone later.

### No rate limiting on `secrets.py`
**Problem**: `wall.py`/`threads.py` had per-IP rate limiting (a salted, rotating hash —
never the raw IP — feeding a sliding-window counter); `secrets.py` had none. An
unthrottled create endpoint is a storage-flood vector; an unthrottled claim endpoint
lets someone hammer IDs to burn a secret before its real recipient reads it.
**Fix**: reused the existing `lib/rate_limit.py` helper on both endpoints.
**Principle**: *defense in depth* — one gate (encryption) doesn't cover a different
threat (volume/abuse). Also: when a pattern already exists elsewhere in the codebase
and solves the exact problem, reuse it rather than inventing a second implementation.
Consistency has a security benefit too — one rate-limit bug to find and fix, not three.

### The content blocklist shouldn't ship in a public repo
**Problem**: a hardcoded Python `set()` of blocked slurs/CSAM terms would sit in git
history forever once the repo went public — legible to anyone who wants to build a
bypass.
**Fix**: moved to a `CONTENT_BLOCKLIST` env var, following the same pattern as
`CORS_ORIGINS`.
**Principle — nuanced, not absolute**: "security through obscurity is bad" is a
half-truth. It's true for anything whose security *depends* on secrecy of the mechanism
(Hashcash PoW is fine to publish — its cost doesn't depend on nobody knowing the
algorithm). It's false for anything that's a *literal enumerable bypass list* — a fixed
word list read by an attacker just saves them the five minutes of black-box probing
they'd do anyway. The generalizable rule: separate **config/secrets** from **code**
regardless of the security argument — a public repo and an application's tunable
knobs/blocklists are different lifecycles, and env vars are the standard way to keep
them apart. Also learned: **this doesn't retroactively scrub git history** — the old
list is still visible in earlier commits. Fixing forward stops new leakage; it doesn't
undo old commits without a destructive history rewrite, which is a different, much
riskier decision.

### Git branch divergence (`main` vs `prod`)
**Problem**: two long-lived branches (`main` for the dev-tool's own commits, `prod` for
what's actually deployed) had silently diverged — `prod` had 13 commits `main` didn't.
Assumed early in the session that they'd diverged in two different directions; checking
with `git merge-base --is-ancestor origin/main origin/prod` proved `main` was a strict
ancestor of `prod` — a much simpler, conflict-free case.
**Fix**: fast-forwarded `main` to `prod` (`git merge`, which resolves to a fast-forward
when one branch is a strict subset of the other's history) after every subsequent
`prod` push, keeping both in sync going forward.
**Principle**: **never assume the shape of a git divergence — check it.**
`git log A..B` / `git log B..A` (what's in each branch that the other lacks) and
`git merge-base --is-ancestor` (is one a strict ancestor of the other) turn "I think
they've diverged" into a yes/no fact in two commands. This is the single most useful
git habit for anyone maintaining multiple long-lived branches — which describes most
real deployment pipelines (staging vs prod, or a vendor branch vs your fork).

### Reviewing an unmerged branch before trusting it
**Problem**: a feature branch (`test-emergent`) came with a claim ("added thread
search, policies, alerts") that needed independent verification before merging into
production — not because the tool was untrusted, but because *trusting a
plain-English description of a diff instead of reading the diff* is how bugs and scope
creep get merged.
**Fix**: `git diff origin/prod...origin/test-emergent --stat` first (what files, how
much), then read the actual new files (`git show branch:path`) before merging.
**Principle**: review the diff, not the changelog. A commit message or PR description
is a claim; `git diff` is the evidence. This scales down to a solo project and up to
a team of 200 — the review step doesn't change, only who's doing it.

### Cloudflare build broke after the merge (yarn.lock vs npm)
**Problem**: the merge introduced a `frontend/yarn.lock` (from Emergent's own Yarn-based
dev environment). This project's documented, working build command was `npm run build`.
Cloudflare's build system **auto-detects the package manager from whichever lockfile is
present** — so the mere presence of `yarn.lock` switched the whole pipeline to Yarn 4 in
immutable-install mode, which then failed on one dependency resolved from a raw tarball
URL.
**Fix**: `git rm frontend/yarn.lock` — restored npm as the detected package manager, no
code change needed.
**Principle**: **build tool auto-detection is a real, sharp edge.** Many platforms
(Cloudflare, Vercel, Netlify, Heroku) infer your toolchain from *which files exist*, not
from an explicit declaration. That means a file that looks purely additive (a lockfile
from a different tool, committed by accident) can silently redirect your entire build
pipeline. The debugging lesson matters more than the fix: **read the build log
top-to-bottom before touching anything** — the log explicitly said
`Detected the following tools from environment: yarn@4.9.1`, which was the whole
diagnosis in one line, before the actual error even appeared.

### Non-production branch builds were noisy and one command was actually broken
**Problem**: pushing to `main` (just to keep it in sync) triggered its own Cloudflare
build — expected default behavior (most CI platforms build every connected branch by
default, not just production), but not something this project needed. Investigating it
surfaced a second, unrelated bug: the "non-production branch deploy command"
(`wrangler versions upload --autoconfig=false`) was invalid — `--autoconfig` isn't a
recognized flag for `wrangler versions upload`, only for `wrangler deploy` — confirmed
directly from the command's own `--help` output printed in the failed build log.
**Fix**: recommended restricting builds to the production branch only in Cloudflare's
settings, which sidesteps the broken command entirely (it never had to be run for
`prod`, which uses the correct `wrangler deploy` variant).
**Principle**: **read the tool's own `--help`/error output before guessing.** The CLI
had already printed its full valid option list in the failure log — the "is this flag
even valid for this subcommand" question was answerable directly from the artifact in
front of me, not from documentation or memory. Also: **you don't have to fix every
broken thing you find — scope the fix to what you actually need.** The correct call
here wasn't "repair the broken preview-deploy command," it was "turn off a feature
we don't use," which is strictly less work and less future-maintenance surface.

### DNS / email routing for the abuse contact
**Problem**: needed a real abuse-contact address without touching the root domain's
existing mail setup (which may already point somewhere important).
**Fix**: Cloudflare Email Routing scoped to a **subdomain**, not the root domain — a
custom address there gets its own MX/SPF records without touching the root zone's
existing ones.
**Principle**: **isolate blast radius by using a subdomain instead of modifying a
shared root resource.** This is a completely general infra pattern, not just an email
one — the same reasoning is why you'd give a new service its own subdomain rather than
a new path on an existing one, or its own database rather than a new table sharing
a `DELETE` blast radius with existing data.

### The admin/report moderation design
**Problem**: with zero-knowledge encrypted secrets, the operator can't read reported
content to judge it — but still needs *some* way to act on abuse reports.
**Fix**: a report is stored (never auto-acted-on) → an operator reviews it manually via
a token-gated admin API → a `DELETE .../{id}` removes the specific document by ID,
**without ever needing the decryption key**.
**Principle**: **you don't need to see something to be able to remove it by identifier.**
This is a genuinely useful pattern anywhere you have opaque/encrypted data plus a
legitimate need for operational control — content moderation, GDPR right-to-erasure
requests, PII scrubbing pipelines. Also: the admin auth is **fail-closed by design**
(`if not expected or not token or token != expected: reject`) — an unset env var
rejects everything rather than defaulting to "allow." Fail-closed vs fail-open is one of
the most consequential five-minute decisions in any system that gates access — always
ask "what happens if this config is simply missing?"

### Screenshot-blocking — a real platform limitation, not a code problem
**Problem**: wanted "block screenshots like banks/Netflix."
**Finding**: not achievable on the web, ever, by any code change. Native apps can set
OS-level flags (Android `FLAG_SECURE`) that a browser has no equivalent for. Netflix's
mechanism is DRM (Widevine/FairPlay via EME) protecting a `<video>` element specifically
via a hardware-enforced protected path — it doesn't extend to arbitrary DOM content, and
even Signal (a native app with far more OS access than any website) can only detect a
screenshot *after* it happens, not prevent it.
**Fix instead**: a traceability watermark (a faint tag derived from the per-view
`burn_token`, so a leaked screenshot can be matched back to the read that produced it).
**Principle**: **know the difference between a prevention control and a detection/
deterrence control**, and recognize when prevention is structurally impossible so you
stop trying to engineer around a platform limitation and switch strategies. This
"analog hole" problem (anything a human can see, a human can capture) shows up in DRM,
in screen-sharing security, in confidential-document handling — the honest answer is
usually "make leaks traceable and consequential," not "make leaks impossible."

### Pre-launch audit via parallel background agents
**Problem**: after several rounds of merges and quick fixes, needed confidence that
frontend/backend contracts (field names, endpoints, error handling) were still
consistent before a public launch — too much surface area to eyeball manually with
confidence.
**Fix**: three independent checks run in parallel (secrets flow; wall+threads;
reports/admin+config), each tracing actual field names and route paths across the
frontend/backend boundary rather than re-reading prose descriptions.
**Principle**: this is **contract testing**, done manually — the discipline of
verifying that two independently-changing sides of a boundary (frontend request shape
vs backend request model, in this case) still agree, by checking the actual field
names on both sides rather than trusting that they must still match. In a real
production system this is exactly what integration tests / schema validation / OpenAPI
contract tests exist to automate — worth learning next (see §4).

---

## 2. Concepts to actively study, mapped to your goal (infra / SRE / networking)

- **CORS, CSP, and the browser trust model** — you fixed a real CORS bug today; the
  next step is understanding *why* the browser enforces same-origin policy at all
  (it's the browser protecting the user from the site, not the site protecting itself)
  and how CSP headers (`server.py`'s `SECURITY_HEADERS`) form a second, independent
  layer against a completely different attack class (injected script), not the same
  layer as CORS.
- **DNS fundamentals** — MX/SPF/TXT records, subdomains vs root zones, propagation.
  You touched this today (Email Routing); the natural next step is understanding how
  the same "isolate with a subdomain" logic applies to your Cloudflare Worker's custom
  domain and to certificate issuance.
- **Git internals beyond the everyday commands** — `merge-base`, `--is-ancestor`,
  fast-forward vs three-way merge, why rewriting history (`filter-repo`, force-push) is
  categorically riskier than any forward-only fix. Anyone doing infra/SRE work
  eventually manages multiple long-lived branches (environments) — this muscle gets
  used constantly.
- **CI/CD build-detection and reproducible builds** — today's yarn.lock incident is a
  live example of *implicit* configuration (tool auto-detection from file presence)
  biting you. Worth reading how Nix, Docker multi-stage builds, and lockfile-pinning
  in general try to make builds *explicit and reproducible* instead of inferred —
  this is core SRE territory.
- **Rate limiting algorithms** — you saw a sliding-window counter today
  (`lib/rate_limit.py`). Worth knowing the other standard shapes (token bucket, leaky
  bucket, fixed window) and their tradeoffs — this comes up in literally every
  infra/networking role, from API gateways to load balancers.
- **Zero-downtime deployment patterns** — flagged but not yet implemented this
  session: rolling deploys, health-check-gated cutover, the expand-contract pattern for
  API/schema changes, cache-safe asset hashing. This is next session's topic and is
  squarely SRE-core material — read up on it before we pick it back up.
- **Fail-open vs fail-closed** — the admin token check today was fail-closed on
  purpose. Go looking for this distinction everywhere: firewalls, auth middleware,
  circuit breakers. It's one question ("what happens when this dependency/config is
  simply absent or broken?") that changes the security posture of a whole system.
- **Contract testing / schema validation** — today's audit was contract-checking done
  by hand. The production version of this is OpenAPI/JSON-schema validation, typed
  API clients generated from the backend's schema, or integration tests that fail loud
  the moment frontend and backend request/response shapes drift. Worth building this
  into the project eventually instead of re-auditing by hand each time.
- **Prevention vs detection controls** — the screenshot conversation is a specific
  case of a general security-engineering split: some threats you can only detect/deter,
  never prevent (screenshots, insider leaks, physical access). Recognizing which
  category a problem falls into early saves a lot of wasted engineering effort.

---

## 3. The genuinely hard calls made today, and why

- **Not scrubbing git history for the old blocklist.** Rewriting history is strictly
  more powerful but strictly more dangerous (breaks any existing clone, requires a
  force-push). The forward-fix (env var going forward) was chosen because the actual
  risk (a public bypass list) was addressed, and the residual risk (an old commit
  someone could dig up) is much smaller than the risk of a destructive rewrite.
- **Not redesigning the site's visual identity** over the "looks AI-generated" worry.
  The instinct to fix a trust problem by changing visuals was reasonable but likely
  wrong here — the actual lever (technical specificity on the landing page, an
  authentic launch post) is cheaper, reversible, and directly addresses *why* people
  bounce, rather than changing something that's actually a differentiator.
  (We're picking this back up next.)
- **Restricting builds instead of fixing the broken preview-deploy command.** Fixing
  it would have been "more correct" in the abstract, but the actual need was "stop
  wasted, failing, unused builds" — the lower-effort fix that fully satisfies the real
  requirement beats the more thorough fix that satisfies a requirement nobody has.

---

## 4. Open threads for next time

1. Zero-downtime / invisible-deploy patterns for this specific stack (Render + Cloudflare
   Worker + stateless Mongo) — discussion started, not yet implemented.
2. The Show HN / Reddit launch post, and the "will people think this is AI slop and
   bounce" question — up next.
3. `ADMIN_TOKEN` still needs to be confirmed set on Render (was generated and handed
   over this session — verify it's actually in the dashboard before relying on the
   admin API).
