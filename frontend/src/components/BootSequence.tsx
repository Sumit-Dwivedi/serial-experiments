import { useEffect, useState } from "react";

const LINES = [
  "[ 0.000 ] wired interface: initializing…",
  "[ 0.014 ] protocol layer 07 … online",
  "[ 0.031 ] crypto.subtle … AES-256-GCM available",
  "[ 0.052 ] key store … none (keys never persist here)",
  "[ 0.068 ] identity module … not installed",
  "[ 0.081 ] cookies: 0   ip log: none   analytics: none",
  "[ 0.097 ] you are not being recorded.",
  "[ 0.100 ] present day. present time.",
];

const SEEN_KEY = "boot_sequence_seen";

/**
 * One-time terminal boot log. Shown on a visitor's first landing only (flag in
 * localStorage), skippable with a click or any key, and skipped entirely for users who
 * ask for reduced motion.
 */
export default function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, "1");
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || shown >= LINES.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 120 : 180);
    return () => clearTimeout(t);
  }, [visible, shown]);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setClosing(true);
      setTimeout(() => setVisible(false), 220);
    };
    if (shown >= LINES.length) {
      const t = setTimeout(dismiss, 700);
      return () => clearTimeout(t);
    }
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [visible, shown]);

  if (!visible) return null;

  return (
    <div
      data-testid="boot-sequence"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0C] transition-opacity duration-200"
      style={{ opacity: closing ? 0 : 1 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(232,103,46,0.5) 0px, rgba(232,103,46,0.5) 1px, transparent 1px, transparent 3px)",
        }}
        aria-hidden="true"
      />
      <pre
        data-testid="boot-sequence-log"
        className="relative w-full max-w-xl px-6 font-mono text-[11px] leading-[1.9] text-[#ECE7DC] sm:text-xs"
      >
        {LINES.slice(0, shown).map((l, i) => (
          <div key={i} className={i === shown - 1 ? "cursor-blink" : undefined}>
            <span className="text-[#E8672E]">{l.slice(0, 10)}</span>
            <span className="text-[#B8B3AA]">{l.slice(10)}</span>
          </div>
        ))}
      </pre>
      <button
        type="button"
        data-testid="boot-sequence-skip"
        onClick={() => setVisible(false)}
        className="glitch-hover absolute right-6 bottom-6 font-mono text-[11px] tracking-[0.2em] text-[#555961] uppercase transition-none hover:text-[#E8672E]"
      >
        skip
      </button>
    </div>
  );
}
