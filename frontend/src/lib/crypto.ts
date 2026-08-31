// Client-side AES-256-GCM via Web Crypto. The key NEVER leaves this file's runtime except
// into the URL hash fragment, which browsers do not transmit to any server.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm.padEnd(Math.ceil(norm.length / 4) * 4, "="));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

async function deriveFromPassphrase(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface SecretKeyMaterial {
  key: CryptoKey;
  salt: string | null;
  /** base64 raw AES key — belongs only in the URL fragment. Null when passphrase-derived. */
  fragmentKey: string | null;
}

/** One key per secret: the note text and every attachment are sealed under it. */
export async function buildKey(passphrase?: string): Promise<SecretKeyMaterial> {
  if (passphrase && passphrase.length > 0) {
    const salt = randomBytes(16);
    return { key: await deriveFromPassphrase(passphrase, salt), salt: toB64(salt), fragmentKey: null };
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  return { key, salt: null, fragmentKey: toB64(await crypto.subtle.exportKey("raw", key)) };
}

export interface Sealed {
  cipher: string;
  iv: string;
}

export async function sealBytes(key: CryptoKey, data: Uint8Array): Promise<Sealed> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource,
  );
  return { cipher: toB64(cipher), iv: toB64(iv) };
}

export const sealText = (key: CryptoKey, text: string) => sealBytes(key, enc.encode(text));

export async function openBytes(key: CryptoKey, cipher: string, iv: string): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) as unknown as BufferSource },
    key,
    fromB64(cipher) as unknown as BufferSource,
  );
  return new Uint8Array(plain);
}

export async function openText(key: CryptoKey, cipher: string, iv: string): Promise<string> {
  return dec.decode(await openBytes(key, cipher, iv));
}

/** Rebuilds the reading key from the URL fragment or the passphrase + stored salt. */
export async function importReadKey(args: {
  salt: string | null;
  fragmentKey?: string | null;
  passphrase?: string;
}): Promise<CryptoKey> {
  if (args.salt && args.passphrase !== undefined) {
    return deriveFromPassphrase(args.passphrase, fromB64(args.salt));
  }
  if (args.fragmentKey) {
    return crypto.subtle.importKey(
      "raw",
      fromB64(args.fragmentKey) as unknown as BufferSource,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
  }
  throw new Error("No decryption key available.");
}

/** Reads `#key=...` from the current URL without ever putting it in a request. */
export function readFragmentKey(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("key");
}
