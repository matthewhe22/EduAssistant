import { describe, expect, it } from "vitest";
import { isAllowedModel, mergeModels, usableModel } from "@/lib/ai/models";
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
    const merged = mergeModels(["zeta-model", "claude-opus-5-5", "llama-guard-4-12b", "glm-5.3-flash"]);
    expect(merged.map((m) => m.id)).toEqual(["glm-5.3-flash", "claude-opus-5-5", "zeta-model"]);
    expect(merged[0].label).toBe("GLM 5.3 Flash");
    expect(mergeModels(null)[0].id).toBe("glm-5.3-flash");
  });

  it("never offers DeepSeek models, which aren't allowed in Australian schools", () => {
    const merged = mergeModels(["deepseek-v4.1-flash", "deepseek-v4-pro-0813", "DeepSeek-R2", "glm-5.3-flash"]);
    expect(merged.map((m) => m.id)).toEqual(["glm-5.3-flash"]);
    expect(mergeModels(null).some((m) => /deepseek/i.test(m.id))).toBe(false);
  });

  it("swaps a saved DeepSeek choice for the default", () => {
    expect(isAllowedModel("deepseek-v4.1-flash")).toBe(false);
    expect(isAllowedModel("claude-sonnet-5-5")).toBe(true);
    expect(usableModel("deepseek-v4.1-flash")).toBe("glm-5.3-flash");
    expect(usableModel(null)).toBe("glm-5.3-flash");
    expect(usableModel("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
  });
});
