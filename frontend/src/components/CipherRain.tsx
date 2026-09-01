import { useMemo } from "react";

const GLYPHS = "0123456789abcdef";

/**
 * Falling-hex visualiser for the live cipher preview. Purely decorative: it renders the
 * real ciphertext hex in scrolling columns, padding with random glyphs when the payload
 * is short. Motion is disabled for users who ask for reduced motion (see index.css).
 */
export default function CipherRain({ hex }: { hex: string }) {
  const columns = useMemo(() => {
    const COLS = 28;
    const ROWS = 18;
    const source = hex.replace(/[^0-9a-f]/g, "");
    return Array.from({ length: COLS }, (_, c) => {
      let s = "";
      for (let r = 0; r < ROWS * 2; r++) {
        const i = c * ROWS + r;
        s += source.length > 0 && i < source.length
          ? source[i % source.length]
          : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      return {
        chars: s.split(""),
        duration: `${3 + ((c * 7) % 9) * 0.45}s`,
        delay: `-${(c * 0.37).toFixed(2)}s`,
        dim: c % 3 === 0,
      };
    });
  }, [hex]);

  if (!hex) {
    return (
      <div
        className="flex h-24 items-center justify-center border border-[#E8672E]/10 bg-[#0E0E10] font-mono text-[11px] text-[#3D4048]"
        data-testid="cipher-rain-idle"
      >
        Start typing to see the encrypted output…
      </div>
    );
  }

  return (
    <div
      className="relative h-24 overflow-hidden border border-[#E8672E]/10 bg-[#0E0E10]"
      data-testid="cipher-rain"
      aria-hidden="true"
    >
      <div className="flex h-full justify-between px-2">
        {columns.map((col, i) => (
          <span
            key={i}
            className="animate-cipher-fall flex flex-col font-mono text-[10px] leading-[1.15]"
            style={{ animationDuration: col.duration, animationDelay: col.delay }}
          >
            {col.chars.map((ch, j) => (
              <span
                key={j}
                className={col.dim ? "text-[#E8672E]/25" : "text-[#E8672E]/60"}
              >
                {ch}
              </span>
            ))}
          </span>
        ))}
      </div>
      {/* Top/bottom fade so the loop seam is invisible. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0E0E10] via-transparent to-[#0E0E10]" />
    </div>
  );
}
