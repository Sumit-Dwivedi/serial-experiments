// Client-side AES-256-GCM via Web Crypto. The key NEVER leaves this file's runtime except
// into the URL hash fragment, which browsers do not transmit to any server.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
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

export interface EncryptedBundle {
  cipherText: string;
  iv: string;
  salt: string | null;
  /** base64 raw AES key — belongs only in the URL fragment. Null when passphrase-derived. */
  fragmentKey: string | null;
}

export async function encryptText(
  plain: string,
  passphrase?: string,
): Promise<EncryptedBundle> {
  const iv = randomBytes(12);
  let key: CryptoKey;
  let salt: Uint8Array | null = null;
  let fragmentKey: string | null = null;

  if (passphrase && passphrase.length > 0) {
    salt = randomBytes(16);
    key = await deriveFromPassphrase(passphrase, salt);
  } else {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    fragmentKey = toB64(await crypto.subtle.exportKey("raw", key));
  }

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    enc.encode(plain),
  );

  return {
    cipherText: toB64(cipher),
    iv: toB64(iv),
    salt: salt ? toB64(salt) : null,
    fragmentKey,
  };
}

export async function decryptText(args: {
  cipherText: string;
  iv: string;
  salt: string | null;
  fragmentKey?: string | null;
  passphrase?: string;
}): Promise<string> {
  let key: CryptoKey;
  if (args.salt && args.passphrase !== undefined) {
    key = await deriveFromPassphrase(args.passphrase, fromB64(args.salt));
  } else if (args.fragmentKey) {
    key = await crypto.subtle.importKey(
      "raw",
      fromB64(args.fragmentKey) as unknown as BufferSource,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
  } else {
    throw new Error("No decryption key available.");
  }

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(args.iv) as unknown as BufferSource },
    key,
    fromB64(args.cipherText) as unknown as BufferSource,
  );
  return dec.decode(plain);
}

/** Reads `#key=...` from the current URL without ever putting it in a request. */
export function readFragmentKey(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("key");
}
