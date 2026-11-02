import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanText, discoverDomainCodes, parseLevelPage, texToText } from "../scripts/curriculum/parse";

const html = readFileSync(path.join(__dirname, "fixtures/level3-maths.html"), "utf8");

describe("parseLevelPage", () => {
  const blocks = parseLevelPage(html);
  const maths = blocks.find((b) => b.subject === "Mathematics")!;
  const english = blocks.find((b) => b.subject === "English")!;

  it("finds each learning area block and flags Version 2.0", () => {
    expect(blocks.map((b) => [b.subject, b.isVersion2])).toEqual([
      ["Mathematics", true],
      ["English", true],
      ["History", false],
    ]);
  });

  it("extracts codes, strands and verbatim text", () => {
    expect(maths.contentDescriptions[0]).toEqual({
      code: "VC2M3N01",
      strand: "Number",
      text: "identify, explain and use the properties of odd and even numbers",
    });
    expect(maths.contentDescriptions.map((c) => [c.code, c.strand])).toEqual([
      ["VC2M3N01", "Number"],
      ["VC2M3N03", "Number"],
      ["VC2M3A03", "Algebra"],
    ]);
  });

  it("renders MathJax, MathML and TeX fractions as a/b", () => {
    expect(maths.contentDescriptions[1].text).toBe(
      "recognise and represent unit fractions including 1/2, 1/10 and 1/4 and their multiples in different ways",
    );
  });

  it("uses the expanded level description and keeps line breaks", () => {
    expect(maths.levelDescription).not.toContain("Show more");
    expect(maths.levelDescription).not.toContain("...");
    expect(maths.levelDescription.split("\n")).toContain("use metric units to measure and compare objects and events");
  });

  it("extracts the achievement standard", () => {
    expect(maths.achievementStandard).toBe(
      "By the end of Level 3, students order and represent natural numbers beyond 10 000.\nStudents conduct repeated chance experiments and discuss variation in results.",
    );
  });

  it("tracks sub-strands", () => {
    expect(english.contentDescriptions).toEqual([
      { code: "VC2E3LA04", strand: "Language", subStrand: "Text structure and organisation", text: "describe how texts are organised" },
      { code: "VC2E3LA09", strand: "Language", subStrand: "Phonics and word knowledge", text: "use phoneme–grapheme knowledge" },
    ]);
  });
});

describe("discoverDomainCodes", () => {
  it("collects codes from checkboxes, options and links but not content description codes", () => {
    const codes = discoverDomainCodes(html).map((c) => c.code).sort();
    expect(codes).toEqual(["E2", "M2", "S2"]);
  });
});

describe("text helpers", () => {
  it("cleans whitespace and nbsp", () => {
    expect(cleanText("  a  b ,  c ")).toBe("a b, c");
  });
  it("converts TeX", () => {
    expect(texToText("\\(\\frac{3}{4}\\) and 2 \\times 3")).toBe("3/4 and 2 × 3");
  });
});
