import { Link, useLocation } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { name: "Create Secret", path: "/", testId: "nav-create-secret" },
  { name: "Anonymous Wall", path: "/wall", testId: "nav-anon-wall" },
  { name: "Architecture", path: "/how-it-works", testId: "nav-how-it-works" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/10 bg-[#090A0F]/80 backdrop-blur-xl"
      data-testid="site-header"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" data-testid="brand-logo-link">
          <span className="flex size-8 items-center justify-center border border-[#00F5FF]/40 bg-[#00F5FF]/10 text-[#00F5FF] transition-colors duration-200 group-hover:bg-[#00F5FF]/20">
            <ShieldOff className="size-4" />
          </span>
          <span className="font-mono text-sm tracking-[0.24em] text-white">VAULT_ZERO</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              data-testid={l.testId}
              className={cn(
                "px-2.5 py-2 font-mono text-[11px] tracking-wider uppercase transition-colors duration-200 sm:px-3 sm:text-xs",
                pathname === l.path
                  ? "text-[#00F5FF]"
                  : "text-slate-400 hover:text-white",
              )}
            >
              {l.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
