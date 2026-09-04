import { Link, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { name: "Create Secret", short: "New", path: "/", testId: "nav-create-secret" },
  { name: "Anonymous Wall", short: "Wall", path: "/wall", testId: "nav-anon-wall" },
  { name: "Threads", short: "Threads", path: "/threads", testId: "nav-threads" },
  { name: "Architecture", short: "Docs", path: "/how-it-works", testId: "nav-how-it-works" },
  { name: "Terms", short: "Terms", path: "/terms", testId: "nav-terms" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#213A52]/30 bg-[#0A0A0C]/90 backdrop-blur-md"
      data-testid="site-header"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" data-testid="brand-logo-link">
          <span className="flex size-8 items-center justify-center border border-[#E8672E]/40 bg-[#E8672E]/10 text-[#E8672E] transition-colors duration-200 group-hover:bg-[#E8672E]/20">
            <ShieldOff className="size-4" />
          </span>
          <span className="hidden font-mono text-[11px] tracking-[0.16em] text-[#ECE7DC] sm:inline sm:text-sm sm:tracking-[0.2em]">
            SERIAL://EXPERIMENTS
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              data-testid={l.testId}
              className={cn(
                "glitch-hover px-2.5 py-2 font-mono text-[11px] tracking-wider uppercase transition-none sm:px-3 sm:text-xs",
                pathname === l.path
                  ? "text-[#E8672E]"
                  : "text-[#6B6F76] hover:text-[#ECE7DC]",
              )}
            >
              <span className="sm:hidden">{l.short}</span>
              <span className="hidden sm:inline">{l.name}</span>
            </Link>
          ))}
          <a
            href="https://github.com/Sumit-Dwivedi/serial-experiments"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="nav-github"
            title="View source on GitHub"
            aria-label="View source on GitHub"
            className="glitch-hover ml-1 text-[#555961] transition-none hover:text-[#E8672E]"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-5">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
