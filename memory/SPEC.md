# Vault Zero — living spec

Zero-knowledge encrypted note sharing + anonymous public wall. No accounts, no login, no PIN.

## Pages
- `/` — create secret: textarea, expiry select (1h/24h/7d), optional passphrase, burn-after-read checkbox → generates `/v/<id>#key=<b64>` link.
- `/v/:id` — locked payload card → "Decrypt & reveal" → plaintext + burn notice.
- `/wall` — anonymous feed: composer (body + tag) + posts with ghost tag and echo counter.
- `/how-it-works` — architecture explainer (static).

## Crypto (frontend/src/lib/crypto.ts)
AES-256-GCM via Web Crypto. Without passphrase: random key exported to URL fragment. With passphrase: PBKDF2-SHA256 100k iterations + random salt, no key in link.

## API (all on api_router, /api)
- POST /secrets → 201 {id, expires_at, burn_after_read}
- GET /secrets/{id}/meta → non-destructive {id, has_passphrase, burn_after_read, expires_at}
- POST /secrets/{id}/open → {cipher_text, iv, salt, has_passphrase, burned, expires_at}; deletes atomically when burn_after_read
- GET /wall → WallPost[]; POST /wall {body, tag} → 201; POST /wall/{id}/echo

## Collections
`secrets` (id, cipher_text, iv, salt, has_passphrase, burn_after_read, created_at, expires_at),
`wall_posts` (id, body, tag, ghost, created_at, expires_at +7d, echoes). No IP/user-agent stored anywhere.

## Auth
None — anonymous by design. No credentials exist.
