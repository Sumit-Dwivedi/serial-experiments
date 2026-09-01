// Hashcash-style proof of work solved with Web Crypto. Costs the poster a few seconds
// of CPU so spam floods are expensive, while collecting nothing about who they are.

const enc = new TextEncoder();

function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    for (let shift = 7; shift >= 0; shift--) {
      if (b >> shift) return bits + (7 - shift);
    }
  }
  return bits;
}

export interface PowChallenge {
  challenge: string;
  difficulty: number;
}

/**
 * Finds a nonce where SHA-256(challenge + nonce) has `difficulty` leading zero bits.
 * Yields to the event loop periodically so the UI stays responsive while it grinds.
 */
export async function solveChallenge(
  { challenge, difficulty }: PowChallenge,
  onProgress?: (attempts: number) => void,
): Promise<string> {
  for (let nonce = 0; ; nonce++) {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", enc.encode(`${challenge}${nonce}`)),
    );
    if (leadingZeroBits(digest) >= difficulty) return String(nonce);
    if (nonce % 2000 === 1999) {
      onProgress?.(nonce + 1);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}
