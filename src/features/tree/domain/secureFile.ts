/** Password-protected files: PBKDF2-SHA-256 -> AES-GCM 256 through Web Crypto. Shared by the backup file and the web link. */

export type EncryptedEnvelope = {
  format: "heritg-encrypted";
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  data: string;
};

export const DEFAULT_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export class WrongPasswordError extends Error {
  constructor() { super("Wrong password."); this.name = "WrongPasswordError"; }
}
export class MalformedEnvelopeError extends Error {
  constructor(message = "This protected file is damaged or not supported.") { super(message); this.name = "MalformedEnvelopeError"; }
}

const encoder = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
export function fromBase64(value: string): Uint8Array {
  if (!BASE64.test(value)) throw new MalformedEnvelopeError();
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await globalThis.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return globalThis.crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptText(plain: string, password: string, { iterations = DEFAULT_ITERATIONS }: { iterations?: number } = {}): Promise<EncryptedEnvelope> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations);
  const cipher = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, encoder.encode(plain));
  return {
    format: "heritg-encrypted", version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipher)),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Cheap check used to route an opened file: is this JSON an encrypted envelope (not necessarily a valid one)? */
export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  return isRecord(value) && value.format === "heritg-encrypted";
}

function validate(value: unknown, minIterations: number): { salt: Uint8Array; iv: Uint8Array; data: Uint8Array; iterations: number } {
  if (!isRecord(value) || value.format !== "heritg-encrypted" || value.version !== 1) throw new MalformedEnvelopeError();
  const { kdf, cipher, data } = value;
  if (!isRecord(kdf) || kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" || typeof kdf.salt !== "string") throw new MalformedEnvelopeError();
  if (!isRecord(cipher) || cipher.name !== "AES-GCM" || typeof cipher.iv !== "string" || typeof data !== "string") throw new MalformedEnvelopeError();
  const iterations = kdf.iterations;
  if (typeof iterations !== "number" || !Number.isInteger(iterations) || iterations < minIterations || iterations > MAX_ITERATIONS) throw new MalformedEnvelopeError();
  const salt = fromBase64(kdf.salt), iv = fromBase64(cipher.iv), bytes = fromBase64(data);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || bytes.length < 16) throw new MalformedEnvelopeError();
  return { salt, iv, data: bytes, iterations };
}

/** `minIterations` defaults to the production floor; tests pass a lower one. */
export async function decryptText(envelope: unknown, password: string, minIterations = MIN_ITERATIONS): Promise<string> {
  const { salt, iv, data, iterations } = validate(envelope, minIterations);
  const key = await deriveKey(password, salt, iterations);
  try {
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, data as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPasswordError();
  }
}
