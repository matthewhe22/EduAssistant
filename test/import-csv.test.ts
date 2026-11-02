import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndex, buildSubjects, parseCsv, splitParagraphs } from "../scripts/curriculum/import-csv";
import { levelsForBand } from "../lib/curriculum/learning-areas";

const csv = readFileSync(path.join(__dirname, "fixtures/vcaa-export.csv"), "utf8");
const subjects = buildSubjects(parseCsv(csv), "2026-11-02");
const bySlug = Object.fromEntries(subjects.map((s) => [s.slug, s]));

describe("levelsForBand", () => {
  it.each([
    ["Foundation", ["F"]],
    ["Level 3", ["3"]],
    ["Levels 5 and 6", ["5", "6"]],
    ["Levels 1 and 2", ["1", "2"]],
    ["Foundation to Level 2", ["F", "1", "2"]],
    ["Level 7", []],
    ["Levels 7 and 8", []],
    ["Foundation Level A", []],
  ])("%s", (band, expected) => {
    expect(levelsForBand(band)).toEqual(expected);
  });
});

describe("import", () => {
  it("skips the copyright lines and levels above 6", () => {
    expect(subjects.map((s) => s.slug).sort()).toEqual([
      "chinese-second-language-learner",
      "critical-and-creative-thinking",
      "english",
      "mathematics",
      "visual-arts",
    ]);
    expect(bySlug.mathematics.bands.map((b) => b.band)).toEqual(["Level 3"]);
  });

  it("groups elaborations under one content description", () => {
    const cd = bySlug.mathematics.bands[0].contentDescriptions;
    expect(cd).toHaveLength(1);
    expect(cd[0]).toEqual({
      code: "VC2M3N01",
      strand: "Number",
      text: "identify, explain and use the properties of odd and even numbers",
      elaborations: [
        "identifying even numbers using skip counting by twos",
        "using odd and even numbers to describe patterns, such as house numbers",
      ],
    });
  });

  it("maps learning areas, bands and sub-strands", () => {
    expect(bySlug["visual-arts"].learningArea).toBe("The Arts");
    expect(bySlug["visual-arts"].bands[0].levels).toEqual(["5", "6"]);
    expect(bySlug["visual-arts"].bands[0].contentDescriptions[0].elaborations).toEqual([]);
    expect(bySlug.english.bands[0].contentDescriptions[0].subStrand).toBe("Phonics and word knowledge");
    expect(bySlug["critical-and-creative-thinking"].learningArea).toBe("Capabilities");
    const chinese = bySlug["chinese-second-language-learner"];
    expect(chinese.learningArea).toBe("Languages");
    expect(chinese.sequence).toBe("Second Language Learner F–10 Sequence");
    expect(chinese.bands[0].levels).toEqual(["F", "1", "2"]);
  });

  it("splits run-together achievement standard paragraphs", () => {
    expect(bySlug.mathematics.bands[0].achievementStandard).toBe(
      "By the end of Level 3, students order numbers.\nStudents find unknown values.",
    );
    expect(splitParagraphs("e.g. this. And that")).toBe("e.g. this. And that");
  });

  it("builds an index", () => {
    const index = buildIndex(subjects, "2026-11-02");
    const maths = index.subjects.find((s) => s.slug === "mathematics")!;
    expect(maths).toMatchObject({ levels: ["3"], contentDescriptionCount: 1, elaborationCount: 2 });
  });
});
