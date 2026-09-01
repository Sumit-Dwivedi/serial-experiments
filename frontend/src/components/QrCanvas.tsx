import { useEffect, useRef } from "react";
import { qrMatrix } from "@/lib/qr";

/** Draws the QR on a canvas in this tab — the link never reaches a QR service. */
export default function QrCanvas({ text, size = 240 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let matrix: boolean[][];
    try {
      matrix = qrMatrix(text);
    } catch {
      ctx.clearRect(0, 0, size, size);
      return;
    }
    const quiet = 4;
    const modules = matrix.length + quiet * 2;
    const scale = Math.floor(size / modules) || 1;
    const px = modules * scale;
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = `${px}px`;
    canvas.style.height = `${px}px`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#0E0E10";
    matrix.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }),
    );
  }, [text, size]);

  return <canvas ref={ref} data-testid="secret-qr-canvas" aria-label="QR code for the secret link" />;
}
