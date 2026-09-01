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
1. **URL key leak**: ViewSecret captures `#key=` once, stashes it in `sessionStorage` (per-tab, dies with the tab) and calls `history.replaceState` to scrub the address bar/history. sessionStorage is required — without it a refresh would strip the key and make the note undecryptable. Cleared on destroy. index.html carries `robots: noindex,nofollow` + generic OpenGraph/Twitter cards ("Encrypted Message — VAULT_ZERO"). `Referrer-Policy: no-referrer` set by middleware.
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
