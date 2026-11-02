import { describe, expect, it } from "vitest";
import { mergeModels } from "@/lib/ai/models";
import { canEncrypt, decryptSecret, encryptSecret, keyHint } from "@/lib/crypto/secret";

describe("secret encryption", () => {
  const secret = "a-long-random-settings-secret";
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("sk-tx-abc123456789", secret);
    const b = encryptSecret("sk-tx-abc123456789", secret);
    expect(a).not.toBe(b);
    expect(a).not.toContain("abc123");
    expect(decryptSecret(a, secret)).toBe("sk-tx-abc123456789");
  });
  it("rejects tampering and the wrong secret", () => {
    const enc = encryptSecret("sk-tx-abc123456789", secret);
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), secret)).toThrow();
    expect(() => decryptSecret(enc, "another-secret-value-1234")).toThrow();
  });
  it("needs a real secret", () => {
    expect(canEncrypt("short")).toBe(false);
    expect(canEncrypt(secret)).toBe(true);
    expect(() => encryptSecret("x", "short")).toThrow(/SETTINGS_SECRET/);
  });
  it("shows only a hint of the key", () => {
    expect(keyHint("sk-tx-1234567890abcd")).toBe("sk-tx-…abcd");
  });
});

describe("model list", () => {
  it("keeps known models first, drops non-writing models, falls back when offline", () => {
    const merged = mergeModels(["zeta-model", "claude-opus-5-5", "llama-guard-4-12b", "deepseek-v4.1-flash"]);
    expect(merged.map((m) => m.id)).toEqual(["deepseek-v4.1-flash", "claude-opus-5-5", "zeta-model"]);
    expect(merged[0].label).toBe("DeepSeek V4.1 Flash");
    expect(mergeModels(null)[0].id).toBe("deepseek-v4.1-flash");
  });
});
