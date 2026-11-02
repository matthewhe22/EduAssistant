import { describe, expect, it } from "vitest";
import { costUsd, formatUsd, priceFor } from "@/lib/pricing";
import { FormSettingsSchema, isOverBudget, settingsFrom } from "@/lib/library/settings";
import { dailySpend, feedbackByType, summariseUsage, type UsageRow } from "@/lib/library/stats";

describe("pricing", () => {
  it("prices DeepSeek V4.1 Flash on Tenon, with cached input", () => {
    // 1M uncached in ($0.24) + 1M cached ($0.0072) + 1M out ($0.72)
    expect(costUsd("deepseek-v4.1-flash", { inputTokens: 1e6, cacheWriteTokens: 0, cacheReadTokens: 1e6, outputTokens: 1e6 })).toBe(0.9672);
    // A typical lesson plan: 8k input, 3k output
    expect(costUsd("deepseek-v4.1-flash", { inputTokens: 8000, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 3000 })).toBe(0.00408);
  });
  it("bills cached input at the input rate when no cache price exists", () => {
    expect(costUsd("claude-sonnet-5-5", { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 1e6, outputTokens: 0 })).toBe(2.4);
  });
  it("matches dated ids by prefix; unknown models cost 0", () => {
    expect(priceFor("deepseek-v4.1-flash-1017")?.input).toBe(0.24);
    expect(priceFor("glm-5.3-20261101")?.input).toBe(1.08);
    expect(priceFor("mystery-model")).toBeNull();
    expect(costUsd("mystery-model", { inputTokens: 1e6, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1e6 })).toBe(0);
  });
  it("formats small and large amounts", () => {
    expect(formatUsd(0.00408)).toBe("US$0.0041");
    expect(formatUsd(0.0423)).toBe("US$0.042");
    expect(formatUsd(12.5)).toBe("US$12.50");
    expect(formatUsd(0)).toBe("US$0");
  });
});

describe("settings", () => {
  it("keeps only valid reusable settings from stored teacher input", () => {
    const s = settingsFrom({
      outputType: "worksheet",
      level: "4",
      subjectSlug: "science",
      lessonMinutes: 50,
      itemCount: 12,
      difficulty: "nope",
      attachmentName: "x.pdf",
      idea: "Heat",
    });
    expect(s).toEqual({ outputType: "worksheet", level: "4", subjectSlug: "science", lessonMinutes: 50, itemCount: 12, idea: "Heat" });
    expect(FormSettingsSchema.safeParse(s).success).toBe(true);
    expect(settingsFrom(null)).toEqual({});
  });

  it("checks the budget", () => {
    expect(isOverBudget(5, null)).toBe(false);
    expect(isOverBudget(4.99, 5)).toBe(false);
    expect(isOverBudget(5, 5)).toBe(true);
    expect(isOverBudget(0, 0)).toBe(true);
  });
});

describe("stats", () => {
  const row = (over: Partial<UsageRow>): UsageRow => ({
    kind: "generate",
    output_type: "lesson_plan",
    cost_usd: "0.10",
    input_tokens: 100,
    cache_write_tokens: 0,
    cache_read_tokens: 900,
    output_tokens: 500,
    created_at: "2026-11-02T01:00:00Z",
    ...over,
  });

  it("summarises usage by type", () => {
    const s = summariseUsage([row({}), row({ kind: "refine", cost_usd: 0.05 }), row({ output_type: "worksheet", cost_usd: "0.30" })]);
    expect(s).toMatchObject({ calls: 3, generations: 2, refinements: 1, cachedShare: 0.9 });
    expect(s.costUsd).toBeCloseTo(0.45);
    expect(s.byType[0]).toEqual({ outputType: "worksheet", count: 1, costUsd: 0.3 });
  });

  it("buckets daily spend by Melbourne date, including empty days", () => {
    const now = new Date("2026-11-03T02:00:00Z"); // 3 Nov in Melbourne
    const days = dailySpend([row({ created_at: "2026-11-02T14:30:00Z" }), row({ created_at: "2026-11-01T10:00:00Z" })], 3, now);
    expect(days).toEqual([
      { date: "2026-11-01", costUsd: 0.1 },
      { date: "2026-11-02", costUsd: 0 },
      { date: "2026-11-03", costUsd: 0.1 }, // 14:30 UTC on 2 Nov is 3 Nov in Melbourne
    ]);
  });

  it("computes approval per output type", () => {
    const f = feedbackByType([
      { output_type: "rubric", rating: 1 },
      { output_type: "rubric", rating: -1 },
      { output_type: "rubric", rating: 1 },
      { output_type: "quiz", rating: null },
    ]);
    expect(f.find((x) => x.outputType === "rubric")).toMatchObject({ up: 2, down: 1, approval: 2 / 3 });
    expect(f.find((x) => x.outputType === "quiz")?.approval).toBeNull();
  });
});
