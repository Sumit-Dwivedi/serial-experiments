// Serves the static SPA build and proxies /api/* to the FastAPI backend (Render),
// so the browser only ever talks to this Worker's origin — matching the frontend's
// "relative /api path, single origin" convention (see src/lib/api.ts).
interface Env {
  ASSETS: Fetcher;
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      const target = new URL(url.pathname + url.search, env.BACKEND_URL);
      return fetch(new Request(target, request));
    }

    return env.ASSETS.fetch(request);
  },
};
