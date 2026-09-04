# Vault Zero — living spec

Zero-knowledge encrypted note sharing + anonymous public wall. No accounts, no login, no PIN.

## Pages
- `/` — create secret: textarea with drag-and-drop file dropping and clipboard image paste (auto-named `screenshot-<timestamp>.png`), up to 3 attachments (≤2 MB each), expiry select (1h/24h/7d), optional passphrase, burn-after-read checkbox → generates `/v/<id>#key=<b64>` link + live expiry countdown + QR dialog + private receipt link `/r/<token>`.
- `/v/:id` — locked payload card → "Decrypt & reveal" → plaintext, decrypted file downloads, image previews, burn notice.
- `/r/:token` — sender-only read receipt: Opened / Not opened yet + timestamps, polls every 10s.
- `/wall` — anonymous feed: composer (body + tag), one-tap tag filter bar with live counts (all / thoughts / confessions / leaks / whistleblows, filtered client-side over the fetched list), and posts with ghost tag, echo counter and anonymous threaded replies (each reply gets its own fresh ghost tag).
- `/how-it-works` — architecture explainer (static).

## Crypto (frontend/src/lib/crypto.ts)
AES-256-GCM via Web Crypto. `buildKey()` makes one key per secret; the note text, each file's bytes and each file's name/type are sealed under it with separate IVs. Without passphrase: key exported to URL fragment. With passphrase: PBKDF2-SHA256 100k iterations + random salt, no key in link.

## QR (frontend/src/lib/qr.ts)
Self-contained byte-mode QR encoder (versions 1–10, EC level M), drawn to a canvas in the browser — the link never reaches a QR service. Verified module-for-module against the python `qrcode` reference.

## API (all on api_router, /api)
- POST /secrets (accepts `attachments[]` of sealed blobs) → 201 {id, expires_at, burn_after_read, receipt_token}
- GET /secrets/{id}/meta → non-destructive {id, has_passphrase, burn_after_read, expires_at, attachment_count}
- POST /secrets/{id}/open → {cipher_text, iv, salt, has_passphrase, burned, expires_at, attachments[]}; deletes atomically when burn_after_read, stamps the receipt
- GET /receipts/{token} → {opened, opened_at, created_at, expires_at}
- GET /wall → WallPost[] (each with `replies[]`); POST /wall {body, tag} → 201; POST /wall/{id}/echo; POST /wall/{id}/replies {body} → 201 (returns the updated post)

## Collections
`wall_posts` also stores an embedded `replies[]` array (id, body, ghost, created_at).

## Collections
`secrets` (id, cipher_text, iv, salt, has_passphrase, burn_after_read, attachments[], created_at, expires_at),
`receipts` (token, secret_id, created_at, opened_at, expires_at — survives the burn so the sender can still see status),
`wall_posts` (id, body, tag, ghost, created_at, expires_at +7d, echoes). No IP/user-agent stored anywhere.

## Auth
None — anonymous by design. No credentials exist.

## Security hardening (4 pitfall fixes)
1. **URL key leak**: ViewSecret captures `#key=` once, stashes it in `sessionStorage` (per-tab, dies with the tab) and calls `history.replaceState` to scrub the address bar/history. sessionStorage is required — without it a refresh would strip the key and make the note undecryptable. Cleared on destroy. index.html carries `robots: noindex,nofollow` + generic OpenGraph/Twitter cards ("Encrypted Message — SERIAL_EXPERIMENTS"). `Referrer-Policy: no-referrer` set by middleware.
2. **Confirmation gate**: `GET /api/secrets/{id}` claims (does NOT delete), decrements `reads_left`, sets `claimed_at` and returns a single-use `burn_token`. `DELETE /api/secrets/{id}?burn_token=` hard-deletes via `find_one_and_delete` (403 on a wrong token). `max_reads` 1–5 at creation; at 0 the secret locks (404) and `purge_at` pulls in to claimed_at + 5 min, reaped by the TTL index. Frontend shows "I've saved this — Destroy it now".
3. **Wall abuse**: `GET /api/wall/challenge` issues a Hashcash puzzle (SHA-256 leading zero bits, DIFFICULTY=16 ≈ 3-4s avg in-browser via Web Crypto, high variance is inherent). Single-use, atomically consumed, replay → 400. `backend/lib/content_filter.py` blocklist rejects with a generic "Post rejected" (400) and logs nothing. Posts carry `expires_at` (default 48h, max 7d, poster-configurable) with a countdown badge.
4. **Delivery trust**: `vite-plugin-sri` emits `integrity="sha384-..."` on production script/link tags. FastAPI middleware sets CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, HSTS, Permissions-Policy on every response.

TTL indexes (created in the server.py lifespan): `secrets.purge_at`, `wall_posts.expires_at`, `receipts.expires_at`, `pow_challenges.expires_at` — all `expireAfterSeconds=0`.

Note: CSP/security headers are served on backend responses; the Vite dev server serves the HTML in dev, so SRI attributes appear only in `yarn build` output.

## Anonymous Threads (HN-style) — verified
- Endpoints: GET/POST /api/threads, GET /api/threads/{id}, POST /api/threads/{id}/replies, PATCH /api/threads/{id}/close, GET /api/threads/challenge?kind=thread|reply
- Identity: deterministic pseudonym = hash(thread_id + client UUID token); owner token kept in sessionStorage only.
- Guards: PoW (16 bits thread / 15 bits reply, single-use challenges), max nesting depth 5, content blocklist, TTL auto-expiry with reply cascade.
- Rate limits (salted rotating IP hash, in-memory): threads 3/10min, thread replies 10/5min, wall posts 5/10min, wall replies 15/5min.
- Note: recursive reply rendering is split across components/ReplyNode.tsx + components/ReplyChildren.tsx — a self-recursive JSX component in one file crashes the dev-server source transform.
- Live API smoke test: `python backend/tests/test_threads_api.py [base_url]` (9/9 passing).

## Launch polish (this session)
- Navbar: GitHub source link (placeholder repo URL — swap in `Navbar.tsx`).
- Home: "ENCRYPTION ENGINE" eyebrow + new headline, live debounced "Cipher preview" hex dump (cosmetic, separate throwaway key), copyable CLI snippet section using `VITE_APP_URL` (falls back to window.location.origin).
- ViewSecret: headings "Someone left you a secret." / "The seal is broken." + viral watermark CTA at page bottom.
- Wall / Threads / HowItWorks: new eyebrows, headings, subheads; verb button labels; atmospheric empty states; cyberpunk-terse toasts.
- ThreadDetail: pulsing emerald dot when open, `[SEALED]` badge when closed.
- index.html: OG/Twitter cards + /og-card.png (1200x630).
- Backend: `GET /api/health` → {"status":"ok"} for uptime probes. Analytics = Cloudflare Web Analytics (no code); see memory/OBSERVABILITY.md.

## Cipher rain + unfurl inspector
- `components/CipherRain.tsx`: decorative falling-hex columns fed by the live cipher preview hex; keyframes `cipher-fall` live in `src/index.css` and are disabled under prefers-reduced-motion.
- `/share-preview` (`pages/SharePreview.tsx`): renders the app's real OG tags as Slack and Discord unfurl mockups, with a paste-a-link box proving the `#key=` fragment is stripped. Reachable from the "Preview the unfurl" button on a generated secret link card.

## Rebrand
- App renamed VAULT_ZERO → SERIAL_EXPERIMENTS across UI copy, page title, OG/Twitter tags and og-card.png (regenerated).
- Navbar GitHub link now points at https://github.com/Sumit-Dwivedi/serial-experiments; wordmark hides below sm and nav uses short labels (New/Wall/Threads/Docs) so the longer name still fits on mobile.

## Lain visual redesign
- Palette: void black #0A0A0C, panels #17171A/#1E1E22, terminal #0E0E10, wired amber accent #E8672E (hover #F07A3F), signal blue #213A52 for borders/glow, bone text #ECE7DC → #D4CFC6 → #B8B3AA, muted greys #6B6F76/#555961/#3D4048, muted destructive #7A2A2A, muted success #6B8F71.
- Typography: JetBrains Mono everywhere (Space Grotesk + DM Sans imports removed), --radius: 0.
- Texture: PageShell layers SVG fractal-noise grain (0.04) under a signal-blue 80px wire grid (0.15).
- Motion utilities in index.css: `glitch-hover`, `type-reveal` (h1 entrances), `cursor-blink` (pending states); all disabled under prefers-reduced-motion.
- Copy: system-log voice, "LAYER 07 //" eyebrows; brand reads SERIAL://EXPERIMENTS.

## Boot sequence
- `components/BootSequence.tsx`, mounted in App.tsx: one-time terminal boot log (8 lines, ~1.6s) with scanlines and a blinking cursor. Flag `boot_sequence_seen` in localStorage; skipped entirely under prefers-reduced-motion; dismissible via click, any key, or the SKIP button; auto-dismisses when finished.

## Terms + abuse reporting
- `/terms` (Acceptable Use) and `/report` (public report form), linked from the navbar and footer. Contact address: `abuse@sumitdwivedi.com`.
- `POST /api/reports`: no auth, rate-limited 5/10min via lib/rate_limit.py client_hash; strips URL/`#key` down to the bare id; stores {id, target_type, target_id, reason, note, created_at, status, resolved_at}. Never auto-deletes content.
- TTL index on `reports.resolved_at` (30 days) — pending reports (null) never expire.
- Admin API (no UI), gated by `X-Admin-Token` vs Render env var `ADMIN_TOKEN` (blank ⇒ everything 403): GET /api/admin/reports, POST /api/admin/reports/{id}/resolve, DELETE /api/admin/wall/{post_id}, DELETE /api/admin/threads/{thread_id} (cascades replies), DELETE /api/admin/secrets/{secret_id} (removes by id, no decryption needed).

## Thread search
- `GET /api/threads?q=` — title-only, case-insensitive, regex-escaped substring match (page/limit unchanged).
- Threads page has a debounced (200ms) filter box with a clear button; results keep the previous list while refetching, and the empty state names the term when nothing matches.

## Reveal watermark
- `ViewSecret.tsx`: revealed text/attachments are overlaid with a faint, tiled SVG watermark (an inline `background-image` data URI, `pointer-events-none`) stamped with the first 12 chars of that claim's `burn_token`.
- Not a screenshot blocker — no website can be one; there is no browser API to prevent screen capture, and Netflix-style DRM only protects a `<video>` element via hardware-backed EME, not arbitrary DOM content. This exists purely for after-the-fact traceability: a leaked screenshot carries a tag unique to the read that produced it.
