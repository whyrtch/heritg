const PUBLIC_ID_BYTES = 16;

function cryptoSource(): Crypto {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random ID generation is unavailable in this browser.");
  }
  return globalThis.crypto;
}

/** Generates 128 bits of Web Crypto randomness encoded as URL-safe base64. */
export function generatePublicId(): string {
  const bytes = cryptoSource().getRandomValues(new Uint8Array(PUBLIC_ID_BYTES));
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export { PUBLIC_ID_BYTES };
