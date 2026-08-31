import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100">
      <Navbar />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="relative z-10 border-t border-white/10 py-6" data-testid="site-footer">
        <p className="mx-auto max-w-7xl px-4 font-mono text-[11px] tracking-wider text-slate-500 sm:px-6 lg:px-8">
          NO ACCOUNTS · NO COOKIES · NO IP LOGS · KEYS NEVER LEAVE YOUR BROWSER
        </p>
      </footer>
    </div>
  );
}
