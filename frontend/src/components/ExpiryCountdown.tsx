import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

function remaining(target: number) {
  const ms = target - Date.now();
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Live countdown to a server-issued expiry timestamp. */
export default function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const target = new Date(expiresAt).getTime();
  const [label, setLabel] = useState(() => remaining(target));

  useEffect(() => {
    setLabel(remaining(target));
    const t = setInterval(() => setLabel(remaining(target)), 1000);
    return () => clearInterval(t);
  }, [target]);

  const expired = label === null;

  return (
    <p
      className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] ${
        expired ? "text-[#FF3B30]" : "text-slate-400"
      }`}
      data-testid="expiry-countdown"
    >
      <Timer className={`size-3.5 ${expired ? "text-[#FF3B30]" : "text-[#00F5FF]"}`} />
      {expired ? "EXPIRED — THIS LINK IS DEAD" : `SELF-DESTRUCTS IN ${label}`}
    </p>
  );
}
