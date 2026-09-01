# Observability — SERIAL_EXPERIMENTS

No tracking code lives in the app. Analytics and uptime are entirely external, so the
zero-identity guarantee is untouched.

## Traffic analytics — Cloudflare Web Analytics (chosen)
Deploy the frontend behind Cloudflare Pages / Cloudflare proxy and enable **Web Analytics**
in the Cloudflare dashboard. Zero script tags, zero code changes, no cookies, no IP storage.
You get requests, unique visitors, page views per route, Core Web Vitals, top referrers and
country breakdowns.

If you later prefer self-hosted Umami instead:
1. Deploy https://github.com/umami-software/umami to Vercel/Railway with a free Neon or
   Supabase Postgres.
2. Add its script tag to `frontend/index.html`:
   `<script defer src="https://<your-umami>/script.js" data-website-id="<id>"></script>`
3. Add that host to `script-src` and `connect-src` in the CSP constant in
   `backend/server.py` — the current CSP is `'self'`-only and will block it otherwise.
4. Optional custom events: `umami.track('secret-created')` inside existing onSuccess callbacks.

## Uptime monitoring
`GET /api/health` → `{"status": "ok"}` (no auth, no DB call).
Point UptimeRobot or Better Stack at `https://<your-domain>/api/health` on a 5-minute
interval and wire email/Slack alerts.

## Deploy-time config
`VITE_APP_URL` (frontend/.env) sets the origin shown in the copyable CLI snippet on the
homepage; it falls back to `window.location.origin` when unset.
