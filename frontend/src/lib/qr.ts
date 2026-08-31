// Minimal byte-mode QR encoder (versions 1–10, EC level M) rendered entirely in the browser.
// The secret link — which contains the decryption key — is never sent anywhere to make a code.

// --- GF(256) ---------------------------------------------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let d = 0; d < degree; d++) {
    const next = new Uint8Array(poly.length + 1);
    for (let i = 0; i < poly.length; i++) {
      next[i] ^= poly[i];
      next[i + 1] ^= mul(poly[i], EXP[d]);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, degree: number): Uint8Array {
  const gen = rsGenerator(degree);
  const res = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.copyWithin(0, 1);
    res[degree - 1] = 0;
    for (let i = 0; i < degree; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

// --- version tables (EC level M) -------------------------------------------
// [ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw]
const VERSIONS: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const dataCapacity = (v: number) => {
  const [, b1, d1, b2, d2] = VERSIONS[v];
  return b1 * d1 + b2 * d2;
};

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v++) {
    const header = 4 + (v < 10 ? 8 : 16);
    if (dataCapacity(v) * 8 >= header + byteLen * 8) return v;
  }
  throw new Error("Payload too long for a version-10 QR code.");
}

// --- bit stream -------------------------------------------------------------
function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const cap = dataCapacity(version);
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capBits = cap * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const out = new Uint8Array(cap);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    out[i] = byte;
  }
  const PAD = [0xec, 0x11];
  for (let i = bits.length / 8, k = 0; i < cap; i++, k++) out[i] = PAD[k % 2];
  return out;
}

function interleave(data: Uint8Array, version: number): Uint8Array {
  const [ecLen, b1, d1, b2, d2] = VERSIONS[version];
  const blocks: Uint8Array[] = [];
  const ecs: Uint8Array[] = [];
  let off = 0;
  for (let i = 0; i < b1; i++) {
    const blk = data.slice(off, off + d1);
    off += d1;
    blocks.push(blk);
    ecs.push(rsRemainder(blk, ecLen));
  }
  for (let i = 0; i < b2; i++) {
    const blk = data.slice(off, off + d2);
    off += d2;
    blocks.push(blk);
    ecs.push(rsRemainder(blk, ecLen));
  }
  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i++) {
    for (const blk of blocks) if (i < blk.length) out.push(blk[i]);
  }
  for (let i = 0; i < ecLen; i++) {
    for (const ec of ecs) out.push(ec[i]);
  }
  return new Uint8Array(out);
}

// --- matrix -----------------------------------------------------------------
type Grid = { m: Int8Array; fn: Uint8Array; size: number };

function place(grid: Grid, r: number, c: number, dark: boolean, isFn: boolean) {
  grid.m[r * grid.size + c] = dark ? 1 : 0;
  if (isFn) grid.fn[r * grid.size + c] = 1;
}

function drawFunctionPatterns(grid: Grid, version: number) {
  const n = grid.size;
  const finder = (row: number, col: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const d = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        place(grid, r, c, d !== 2 && d !== 4, true);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    const dark = i % 2 === 0;
    place(grid, 6, i, dark, true);
    place(grid, i, 6, dark, true);
  }

  const centers = ALIGN[version];
  for (const r of centers) {
    for (const c of centers) {
      const nearFinder =
        (r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          place(grid, r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1, true);
        }
      }
    }
  }

  // reserve format areas (skip index 6 — that belongs to the timing patterns)
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      place(grid, 8, i, false, true);
      place(grid, i, 8, false, true);
    }
  }
  for (let i = 0; i < 8; i++) {
    place(grid, 8, n - 1 - i, false, true);
    place(grid, n - 1 - i, 8, false, true);
  }
  place(grid, n - 8, 8, true, true); // dark module

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + n - 11;
      place(grid, a, b, bit, true);
      place(grid, b, a, bit, true);
    }
  }
}

function drawFormat(grid: Grid, mask: number) {
  const n = grid.size;
  const ecBits = 0b00; // level M
  const data = (ecBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  // bits 0..14, coordinates are (row, col) — the top-left strip
  for (let i = 0; i <= 5; i++) place(grid, i, 8, ((bits >> i) & 1) === 1, true);
  place(grid, 7, 8, ((bits >> 6) & 1) === 1, true);
  place(grid, 8, 8, ((bits >> 7) & 1) === 1, true);
  place(grid, 8, 7, ((bits >> 8) & 1) === 1, true);
  for (let i = 9; i < 15; i++) place(grid, 8, 14 - i, ((bits >> i) & 1) === 1, true);

  // the duplicated copy: bits 0..7 along row 8 from the right, 8..14 up the bottom-left
  for (let i = 0; i < 8; i++) place(grid, 8, n - 1 - i, ((bits >> i) & 1) === 1, true);
  for (let i = 8; i < 15; i++) place(grid, n - 15 + i, 8, ((bits >> i) & 1) === 1, true);
  place(grid, n - 8, 8, true, true);
}

function maskAt(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function drawData(grid: Grid, codewords: Uint8Array, mask: number) {
  const n = grid.size;
  let bitIndex = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? n - 1 - vert : vert;
        if (grid.fn[r * n + c]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) {
          dark = ((codewords[bitIndex >>> 3] >> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
        if (maskAt(mask, r, c)) dark = !dark;
        grid.m[r * n + c] = dark ? 1 : 0;
      }
    }
  }
}

function penalty(grid: Grid): number {
  const n = grid.size;
  const at = (r: number, c: number) => grid.m[r * n + c] === 1;
  let score = 0;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // rule 1 (runs) — counted from run starts
      for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
        const pr = r - dr;
        const pc = c - dc;
        if (pr >= 0 && pc >= 0 && at(pr, pc) === at(r, c)) continue;
        let run = 0;
        let rr = r;
        let cc = c;
        while (rr < n && cc < n && at(rr, cc) === at(r, c)) {
          run++;
          rr += dr;
          cc += dc;
        }
        if (run >= 5) score += 3 + (run - 5);
      }
      // rule 2 (2x2 blocks)
      if (r + 1 < n && c + 1 < n) {
        const v = at(r, c);
        if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) score += 3;
      }
    }
  }

  // rule 3 (finder-like patterns)
  const pat = [true, false, true, true, true, false, true, false, false, false, false];
  const rev = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get: (i: number) => boolean, start: number, p: boolean[]) =>
    p.every((v, i) => get(start + i) === v);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c + 11 <= n; c++) {
      if (matches((i) => at(r, i), c, pat) || matches((i) => at(r, i), c, rev)) score += 40;
    }
  }
  for (let c = 0; c < n; c++) {
    for (let r = 0; r + 11 <= n; r++) {
      if (matches((i) => at(i, c), r, pat) || matches((i) => at(i, c), r, rev)) score += 40;
    }
  }

  // rule 4 (dark ratio)
  let dark = 0;
  for (let i = 0; i < n * n; i++) if (grid.m[i] === 1) dark++;
  const ratio = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/** Returns a size×size boolean matrix; true = dark module. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const codewords = interleave(buildCodewords(bytes, version), version);
  const size = version * 4 + 17;

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid: Grid = { m: new Int8Array(size * size), fn: new Uint8Array(size * size), size };
    drawFunctionPatterns(grid, version);
    drawData(grid, codewords, mask);
    drawFormat(grid, mask);
    const s = penalty(grid);
    if (s < bestScore) {
      bestScore = s;
      best = grid;
    }
  }

  const g = best!;
  const out: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(g.m[r * size + c] === 1);
    out.push(row);
  }
  return out;
}
