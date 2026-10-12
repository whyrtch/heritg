import { describe, expect, it } from "vitest";
import { decryptText, encryptText, fromBase64, isEncryptedEnvelope, toBase64, WrongPasswordError } from "./secureFile";

const LOW = 1000;
const secret = JSON.stringify({ version: 2, tree: { name: "Keluarga Ünïcode ✓" } });

describe("secureFile", () => {
  it("round-trips text with the documented envelope shape", async () => {
    const envelope = await encryptText(secret, "Sandi#1234", { iterations: LOW });
    expect(envelope).toMatchObject({ format: "heritg-encrypted", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations: LOW }, cipher: { name: "AES-GCM" } });
    expect(fromBase64(envelope.kdf.salt)).toHaveLength(16);
    expect(fromBase64(envelope.cipher.iv)).toHaveLength(12);
    expect(envelope.data).not.toContain("Keluarga");
    expect(isEncryptedEnvelope(envelope)).toBe(true);
    expect(await decryptText(envelope, "Sandi#1234", LOW)).toBe(secret);
  });

  it("uses a fresh salt and iv every time", async () => {
    const a = await encryptText("x", "pw", { iterations: LOW }), b = await encryptText("x", "pw", { iterations: LOW });
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
  });

  it("throws WrongPasswordError for a wrong password", async () => {
    const envelope = await encryptText(secret, "Sandi#1234", { iterations: LOW });
    await expect(decryptText(envelope, "salah", LOW)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("fails when a ciphertext byte is tampered with", async () => {
    const envelope = await encryptText(secret, "Sandi#1234", { iterations: LOW });
    const bytes = fromBase64(envelope.data);
    bytes[0] ^= 1;
    await expect(decryptText({ ...envelope, data: toBase64(bytes) }, "Sandi#1234", LOW)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it("enforces the iteration floor by default", async () => {
    const envelope = await encryptText("x", "pw", { iterations: LOW });
    await expect(decryptText(envelope, "pw")).rejects.toThrow(/damaged|not supported/);
  });

  it("rejects malformed envelopes", async () => {
    const good = await encryptText("x", "pw", { iterations: LOW });
    const cases: unknown[] = [
      null, "text", {}, { ...good, format: "other" }, { ...good, version: 2 },
      { ...good, kdf: { ...good.kdf, iterations: 10_000_000 } }, { ...good, kdf: { ...good.kdf, iterations: 1.5 } },
      { ...good, kdf: { ...good.kdf, hash: "SHA-1" } }, { ...good, kdf: { ...good.kdf, salt: "AAAA" } },
      { ...good, cipher: { ...good.cipher, iv: "AAAA" } }, { ...good, cipher: { name: "AES-CBC", iv: good.cipher.iv } },
      { ...good, data: "not base64!" }, { ...good, data: "" },
    ];
    for (const value of cases) await expect(decryptText(value, "pw", LOW)).rejects.toThrow(/damaged|not supported/);
  });

  it("recognises only encrypted envelopes", () => {
    expect(isEncryptedEnvelope({ version: 2, tree: {} })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
    expect(isEncryptedEnvelope([])).toBe(false);
  });
});
