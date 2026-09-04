import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#ECE7DC]">
      <Navbar />
      {/* Noise grain — felt, not seen */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
        aria-hidden="true"
      />
      {/* Hairline wire grid — faint circuit-board feel */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(33,58,82,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(33,58,82,0.15) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
        aria-hidden="true"
      />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer
        className="relative z-10 border-t border-[#213A52]/30 py-6"
        data-testid="site-footer"
      >
        <p className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 font-mono text-[11px] tracking-wider text-[#555961] sm:px-6 lg:px-8">
          <span>
            LAYER 07 // NO ACCOUNTS · NO COOKIES · NO IP LOGS · KEYS NEVER LEAVE THIS MACHINE
          </span>
          <Link
            to="/how-it-works"
            data-testid="footer-how-it-works-link"
            className="glitch-hover uppercase transition-none hover:text-[#E8672E]"
          >
            Architecture
          </Link>
          <Link
            to="/terms"
            data-testid="footer-terms-link"
            className="glitch-hover uppercase transition-none hover:text-[#E8672E]"
          >
            Acceptable use
          </Link>
          <Link
            to="/report"
            data-testid="footer-report-link"
            className="glitch-hover uppercase transition-none hover:text-[#E8672E]"
          >
            Report abuse
          </Link>
        </p>
      </footer>
    </div>
  );
}
