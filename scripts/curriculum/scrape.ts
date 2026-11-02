/**
 * Builds the Victorian Curriculum F–10 Version 2.0 dataset for Foundation to Level 6.
 *
 *   npm run curriculum:discover   # print the domain codes the VCAA site offers
 *   npm run curriculum:scrape     # write data/curriculum/vc2/*.json
 *
 * Options:
 *   --domains=M2,E2   only scrape these domain codes
 *   --delay=600       ms between requests (be polite to VCAA)
 *
 * Content © Victorian Curriculum and Assessment Authority (VCAA). This dataset is for
 * personal, non-commercial educational use. See docs/research/00-sources-and-licensing.md.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverDomainCodes, parseLevelPage, type ParsedLearningAreaBlock } from "./parse";
import { learningAreaFor, slugify } from "../../lib/curriculum/learning-areas";
import {
  PRIMARY_LEVELS,
  type CurriculumIndex,
  type PrimaryLevel,
  type SubjectCurriculum,
} from "../../lib/curriculum/types";

const BASE = "https://victoriancurriculum.vcaa.vic.edu.au";
const LEVEL_PATH: Record<PrimaryLevel, string> = {
  F: "foundationlevel",
  "1": "level1",
  "2": "level2",
  "3": "level3",
  "4": "level4",
  "5": "level5",
  "6": "level6",
};
const OUT_DIR = path.resolve(__dirname, "../../data/curriculum/vc2");
const UA = "EdAssistant-curriculum-builder/0.1 (personal teacher planning tool)";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const DELAY = Number(args.delay ?? 600);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, attempt = 1): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt >= 4) throw new Error(`GET ${url} failed: ${(err as Error).message}`);
    await sleep(1000 * 2 ** attempt);
    return get(url, attempt + 1);
  } finally {
    await sleep(DELAY);
  }
}

function levelUrl(level: PrimaryLevel, domain?: string) {
  return `${BASE}/${LEVEL_PATH[level]}?layout=1${domain ? `&d=${encodeURIComponent(domain)}` : ""}`;
}

async function discover(): Promise<string[]> {
  const codes = new Set<string>();
  for (const level of ["3", "F"] as PrimaryLevel[]) {
    const html = await get(levelUrl(level, "M2"));
    for (const c of discoverDomainCodes(html)) {
      if (!codes.has(c.code)) console.log(`candidate domain ${c.code.padEnd(8)} ${c.label}`);
      codes.add(c.code);
    }
  }
  if (codes.size === 0) {
    throw new Error("No domain codes found on the level page — the VCAA markup may have changed.");
  }
  // The filter lists VC1 codes (M, E, S…). Only Mathematics has a Version 2.0 domain (M2) on this
  // site; other subjects come from the f10 CSV export (download-f10.ts).
  const v2 = new Set([...codes].map((c) => (c.endsWith("2") ? c : `${c}2`)));
  console.log(`Version 2.0 domain codes to probe: ${[...v2].join(", ")}`);
  return [...v2];
}

async function main() {
  const domains = args.domains ? String(args.domains).split(",") : await discover();
  if (args.discover) return;

  console.log(`Probing ${domains.length} domains × ${PRIMARY_LEVELS.length} levels…`);
  const retrievedAt = new Date().toISOString();
  const subjects = new Map<string, SubjectCurriculum>();

  for (const domain of domains) {
    for (const level of PRIMARY_LEVELS) {
      const url = levelUrl(level, domain);
      let blocks: ParsedLearningAreaBlock[];
      try {
        blocks = parseLevelPage(await get(url));
      } catch (err) {
        console.warn(`skip ${domain} ${level}: ${(err as Error).message}`);
        continue;
      }
      for (const b of blocks) {
        if (!b.isVersion2 || b.contentDescriptions.length === 0) continue;
        const slug = slugify(b.subject);
        const subj =
          subjects.get(slug) ??
          ({
            subject: b.subject,
            slug,
            learningArea: learningAreaFor(b.subject),
            domainCode: domain,
            source: `${BASE}/${LEVEL_PATH.F}?layout=1&d=${domain}`,
            retrievedAt,
            levels: [],
          } satisfies SubjectCurriculum);
        if (!subj.levels.some((l) => l.level === level)) {
          subj.levels.push({
            level,
            levelDescription: b.levelDescription,
            achievementStandard: b.achievementStandard,
            contentDescriptions: b.contentDescriptions,
          });
          console.log(`${b.subject} ${level}: ${b.contentDescriptions.length} content descriptions`);
        }
        subjects.set(slug, subj);
      }
    }
  }

  if (subjects.size === 0) throw new Error("Nothing scraped — check domain codes and markup.");

  await mkdir(OUT_DIR, { recursive: true });
  const index: CurriculumIndex = { version: "Victorian Curriculum F–10 Version 2.0", retrievedAt, subjects: [] };
  for (const s of [...subjects.values()].sort((a, b) => a.subject.localeCompare(b.subject))) {
    s.levels.sort((a, b) => PRIMARY_LEVELS.indexOf(a.level) - PRIMARY_LEVELS.indexOf(b.level));
    await writeFile(path.join(OUT_DIR, `${s.slug}.json`), JSON.stringify(s, null, 2) + "\n");
    index.subjects.push({
      subject: s.subject,
      slug: s.slug,
      learningArea: s.learningArea,
      levels: s.levels.map((l) => l.level),
      contentDescriptionCount: s.levels.reduce((n, l) => n + l.contentDescriptions.length, 0),
    });
  }
  await writeFile(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
  const total = index.subjects.reduce((n, s) => n + s.contentDescriptionCount, 0);
  console.log(`Wrote ${index.subjects.length} subjects, ${total} content descriptions to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
