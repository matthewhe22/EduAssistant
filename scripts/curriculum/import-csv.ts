/**
 * Converts VCAA's "Download curriculum" CSV export into data/curriculum/vc2/*.json.
 *
 *   npm run curriculum:import -- data/curriculum/raw/VC2_AS-CD-Elab_<date>.csv
 *
 * Keeps Foundation to Level 6 only. One JSON file per subject plus index.json.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { learningAreaFor, levelsForBand, slugify } from "../../lib/curriculum/learning-areas";
import type { CurriculumBand, CurriculumIndex, PrimaryLevel, SubjectCurriculum } from "../../lib/curriculum/types";

export const SOURCE = "https://f10.vcaa.vic.edu.au/download-curriculum";
const OUT_DIR = path.resolve(__dirname, "../../data/curriculum/vc2");
const ORDER: PrimaryLevel[] = ["F", "1", "2", "3", "4", "5", "6"];

interface Row {
  "Learning area/Capability": string;
  "Discipline/Language": string;
  "Level/Band": string;
  Sequence: string;
  Pathway: string;
  "Achievement standard": string;
  Strand: string;
  "Sub-strand": string;
  "Content description code": string;
  "Content description": string;
  Elaboration: string;
}

/**
 * The CSV is plain text but keeps maths as inline TeX, e.g. "$\frac{1}{2}$" or "$3^{2}$".
 * Convert those spans to readable text. "$" is also used for money ("$375 = $"), so only spans
 * with no whitespace at either edge that contain TeX or arithmetic are treated as maths.
 */
export function texToPlain(s: string): string {
  return s.replace(/\$([^\s$](?:[^$]*[^\s$])?)\$/g, (match, inner: string) => {
    if (!/[\\^=+]/.test(inner)) return match;
    return inner
      .replace(/(\d)\\frac/g, "$1 \\frac")
      .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\^\{([^{}]*)\}/g, "^$1")
      .replace(/\\times/g, "×")
      .replace(/\\div/g, "÷")
      .replace(/\\(left|right)/g, "")
      .replace(/\\,/g, " ");
  });
}

const clean = (s: string | undefined) =>
  texToPlain((s ?? "").replace(/ /g, " ")).replace(/[ \t]+/g, " ").trim();

/** The export joins achievement standard paragraphs with no space ("…calculations.Students…"). */
export function splitParagraphs(s: string): string {
  return clean(s).replace(/([.!?])(?=[A-Z‘“'"])/g, "$1\n");
}

export function subjectName(row: Row): string {
  const area = clean(row["Learning area/Capability"]);
  const discipline = clean(row["Discipline/Language"]);
  const sequence = clean(row.Sequence);
  const base = discipline || area;
  // Chinese has both a first-language-style and a second-language-learner sequence.
  if (/second language learner/i.test(sequence)) return `${base} (Second Language Learner)`;
  return base;
}

export function parseCsv(text: string): Row[] {
  // The export starts with a copyright line and ends with one; find the real header.
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("Learning area/Capability,"));
  if (start < 0) throw new Error("CSV header not found — has the VCAA export format changed?");
  const rows = parse(lines.slice(start).join("\n"), {
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as Row[];
  return rows.filter((r) => clean(r["Content description code"]));
}

export function buildSubjects(rows: Row[], retrievedAt: string): SubjectCurriculum[] {
  const subjects = new Map<string, SubjectCurriculum>();
  for (const row of rows) {
    const learningArea = learningAreaFor(row["Learning area/Capability"]);
    if (!learningArea) continue;
    const bandLabel = clean(row["Level/Band"]);
    const levels = levelsForBand(bandLabel);
    if (levels.length === 0) continue; // above Level 6 or Foundation Levels A–D

    const name = subjectName(row);
    const slug = slugify(name);
    let subject = subjects.get(slug);
    if (!subject) {
      subject = {
        subject: name,
        slug,
        learningArea,
        ...(clean(row.Sequence) ? { sequence: clean(row.Sequence) } : {}),
        source: SOURCE,
        retrievedAt,
        bands: [],
      };
      subjects.set(slug, subject);
    }

    let band = subject.bands.find((b) => b.band === bandLabel);
    if (!band) {
      band = { band: bandLabel, levels, achievementStandard: splitParagraphs(row["Achievement standard"]), contentDescriptions: [] };
      subject.bands.push(band);
    }

    const code = clean(row["Content description code"]);
    let cd = band.contentDescriptions.find((c) => c.code === code);
    if (!cd) {
      const subStrand = clean(row["Sub-strand"]);
      cd = {
        code,
        strand: clean(row.Strand),
        ...(subStrand ? { subStrand } : {}),
        text: clean(row["Content description"]),
        elaborations: [],
      };
      band.contentDescriptions.push(cd);
    }
    const elab = clean(row.Elaboration);
    if (elab && !cd.elaborations.includes(elab)) cd.elaborations.push(elab);
  }

  const result = [...subjects.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  for (const s of result) {
    s.bands.sort((a: CurriculumBand, b: CurriculumBand) => ORDER.indexOf(a.levels[0]) - ORDER.indexOf(b.levels[0]));
  }
  return result;
}

export function buildIndex(subjects: SubjectCurriculum[], retrievedAt: string): CurriculumIndex {
  return {
    version: "Victorian Curriculum F–10 Version 2.0",
    source: SOURCE,
    retrievedAt,
    subjects: subjects.map((s) => {
      const cds = s.bands.flatMap((b) => b.contentDescriptions);
      return {
        subject: s.subject,
        slug: s.slug,
        learningArea: s.learningArea,
        levels: ORDER.filter((l) => s.bands.some((b) => b.levels.includes(l))),
        bands: s.bands.map((b) => b.band),
        contentDescriptionCount: cds.length,
        elaborationCount: cds.reduce((n, c) => n + c.elaborations.length, 0),
      };
    }),
  };
}

async function main() {
  let file = process.argv[2];
  if (!file) {
    const rawDir = path.resolve(__dirname, "../../data/curriculum/raw");
    const csv = (await readdir(rawDir)).filter((f) => f.endsWith(".csv")).sort().pop();
    if (!csv) throw new Error(`No CSV in ${rawDir}; pass a path`);
    file = path.join(rawDir, csv);
  }
  const dateMatch = path.basename(file).match(/(\d{1,2})-(\d{1,2})-(\d{4})/); // VCAA uses M-D-YYYY
  const retrievedAt = dateMatch
    ? `${dateMatch[3]}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`
    : new Date().toISOString().slice(0, 10);

  const subjects = buildSubjects(parseCsv(await readFile(file, "utf8")), retrievedAt);
  if (subjects.length === 0) throw new Error("No F–6 subjects found in the CSV");

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  for (const s of subjects) await writeFile(path.join(OUT_DIR, `${s.slug}.json`), JSON.stringify(s, null, 2) + "\n");
  const index = buildIndex(subjects, retrievedAt);
  await writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");

  for (const s of index.subjects) {
    console.log(`${s.learningArea.padEnd(30)} ${s.subject.padEnd(40)} ${s.bands.join(" | ").padEnd(70)} ${s.contentDescriptionCount} CDs, ${s.elaborationCount} elaborations`);
  }
  const total = index.subjects.reduce((n, s) => n + s.contentDescriptionCount, 0);
  console.log(`Wrote ${index.subjects.length} subjects, ${total} content descriptions to ${OUT_DIR}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
