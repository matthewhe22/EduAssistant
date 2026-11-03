import { describe, expect, it } from "vitest";
import { emptyValue, fieldLabel } from "@/lib/ui/editor-schema";
import { OUTPUT_TYPES, OUTPUTS } from "@/lib/generator/outputs";
import { refreshWarnings } from "@/lib/generator/validate";
import { samplePlan } from "./fixtures/sample-plan";
import { SAMPLES } from "./fixtures/samples";

describe("hand editing", () => {
  it.each(OUTPUT_TYPES)("builds empty list items that still match the %s schema", (type) => {
    const def = OUTPUTS[type];
    const content = structuredClone(SAMPLES[type]) as Record<string, unknown>;
    // Add an empty item to every top-level list, like pressing "Add".
    for (const [key, schema] of Object.entries(def.schema.shape)) {
      const d = (schema as unknown as { _zod: { def: { type: string; element?: never } } })._zod.def;
      if (d.type === "array" && d.element) (content[key] as unknown[]).push(emptyValue(d.element));
    }
    expect(def.schema.safeParse(content).success).toBe(true);
  });

  it("makes an empty object with every field", () => {
    const phase = emptyValue(OUTPUTS.lesson_plan.schema.shape.phases.element) as Record<string, unknown>;
    expect(phase).toEqual({ phase: "Daily review", minutes: 0, teacher: [], students: [], checkForUnderstanding: "" });
  });

  it("labels fields in plain English", () => {
    expect(fieldLabel("checkForUnderstanding")).toBe("Check for understanding");
    expect(fieldLabel("ealD")).toBe("Learning English");
    expect(fieldLabel("learningIntention")).toBe("Learning intention");
  });

  it("re-checks timings after an edit, keeping other warnings", () => {
    const other = "Removed curriculum code \"X\" because it is not in the Victorian Curriculum data for this level.";
    const total = samplePlan.phases.reduce((n, p) => n + p.minutes, 0);
    const before = refreshWarnings("lesson_plan", samplePlan, total + 5, [other]);
    expect(before).toHaveLength(2);
    const edited = { ...samplePlan, phases: samplePlan.phases.map((p, i) => (i === 0 ? { ...p, minutes: p.minutes + 5 } : p)) };
    expect(refreshWarnings("lesson_plan", edited, total + 5, before)).toEqual([other]);
  });
});
