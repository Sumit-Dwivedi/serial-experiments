import { useState } from "react";
import { Link } from "react-router-dom";

import PageShell from "@/components/PageShell";

const meta = (selector: string, fallback: string) =>
  document.querySelector<HTMLMetaElement>(selector)?.content ?? fallback;

/**
 * Renders the OG tags from index.html exactly as Slack and Discord unfurl them, so you can
 * confirm no content ever leaks into a link preview. Nothing here talks to the network.
 */
export default function SharePreview() {
  const [url, setUrl] = useState(`${window.location.origin}/v/2f9c41ab#key=…`);

  const title = meta('meta[property="og:title"]', "SERIAL_EXPERIMENTS");
  const description = meta('meta[property="og:description"]', "");
  const image = meta('meta[property="og:image"]', "/og-card.png");
  const site = meta('meta[property="og:site_name"]', "SERIAL_EXPERIMENTS");
  const host = window.location.host;
  const shown = url.split("#")[0];

  return (
    <PageShell>
      <p className="font-mono text-[11px] tracking-[0.32em] text-[#00F5FF]">UNFURL INSPECTOR</p>
      <h1
        className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl"
        data-testid="share-preview-heading"
      >
        See exactly what leaks in a link preview.
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
        Chat apps fetch the page — never the fragment after <code className="text-[#00F5FF]">#</code>.
        These cards are rendered from this app's real OpenGraph tags. Notice that neither the
        key nor a single byte of your content appears.
      </p>

      <label className="mt-8 block max-w-2xl">
        <span className="font-mono text-[11px] tracking-[0.2em] text-slate-500">
          PASTE A SECRET LINK
        </span>
        <input
          data-testid="share-preview-url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="mt-2 w-full border border-white/10 bg-[#05070B] px-3 py-2 font-mono text-xs text-slate-200 outline-none transition-colors duration-200 focus:border-[#00F5FF]/50"
        />
      </label>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {/* Slack */}
        <div className="border border-white/10 bg-[#11141E] p-5" data-testid="slack-preview">
          <p className="font-mono text-[11px] tracking-[0.22em] text-slate-500">SLACK</p>
          <div className="mt-4 bg-white p-4">
            <p className="text-[13px] text-[#1264A3] break-all">{shown}</p>
            <div className="mt-2 border-l-4 border-[#DDDDDD] pl-3">
              <p className="text-[12px] font-semibold text-[#616061]">{site}</p>
              <p className="mt-1 text-[14px] leading-snug font-bold text-[#1264A3]">{title}</p>
              <p className="mt-1 text-[13px] leading-snug text-[#1D1C1D]">{description}</p>
              <img
                src={image}
                alt="Link preview card"
                data-testid="slack-preview-image"
                className="mt-2 w-40 border border-[#E8E8E8]"
              />
            </div>
          </div>
        </div>

        {/* Discord */}
        <div className="border border-white/10 bg-[#11141E] p-5" data-testid="discord-preview">
          <p className="font-mono text-[11px] tracking-[0.22em] text-slate-500">DISCORD</p>
          <div className="mt-4 bg-[#313338] p-4">
            <p className="text-[13px] break-all text-[#00A8FC]">{shown}</p>
            <div className="mt-2 max-w-md border-l-4 border-[#00F5FF] bg-[#2B2D31] p-3">
              <p className="text-[12px] text-[#B5BAC1]">{host}</p>
              <p className="mt-1 text-[15px] font-semibold text-[#00A8FC]">{title}</p>
              <p className="mt-1 text-[13px] leading-snug text-[#DBDEE1]">{description}</p>
              <img
                src={image}
                alt="Link preview card"
                data-testid="discord-preview-image"
                className="mt-2 w-full rounded-[4px]"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className="mt-8 max-w-2xl border border-[#34D399]/30 bg-[#0C2A20] px-4 py-3"
        data-testid="fragment-safety-note"
      >
        <p className="text-sm text-emerald-100">
          Fragment stripped from the preview:{" "}
          <span className="font-mono text-xs text-emerald-300">
            {url.includes("#") ? `#${url.split("#")[1]}` : "— none in this link —"}
          </span>{" "}
          never reaches Slack, Discord, or our server.
        </p>
      </div>

      <Link
        to="/"
        data-testid="share-preview-back"
        className="mt-8 inline-block font-mono text-[11px] text-slate-500 transition-colors duration-200 hover:text-[#00F5FF]"
      >
        ‹ back to the vault
      </Link>
    </PageShell>
  );
}
