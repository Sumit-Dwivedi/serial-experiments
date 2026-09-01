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
