/**
 * Parses VCAA "level" pages from victoriancurriculum.vcaa.vic.edu.au, e.g.
 *   https://victoriancurriculum.vcaa.vic.edu.au/level3?layout=1&d=M2
 * into structured content descriptions and achievement standards.
 *
 * Pure functions only (no network) so they can be unit tested against fixtures.
 */
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { ContentDescription } from "../../lib/curriculum/types";

export interface ParsedLearningAreaBlock {
  /** Heading as shown, e.g. "Mathematics Version 2.0". */
  title: string;
  /** Subject without the version suffix, e.g. "Mathematics". */
  subject: string;
  isVersion2: boolean;
  levelDescription: string;
  achievementStandard: string;
  contentDescriptions: ContentDescription[];
}

const VERSION_2_SUFFIX = /\s*Version\s*2(\.0)?\s*$/i;

export function cleanText(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\s+([,;:.)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

/** Turns TeX fragments such as \(\frac{1}{2}\) into "1/2". */
export function texToText(s: string): string {
  return s
    .replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\(\(|\)|\[|\])/g, "")
    .replace(/\$/g, "");
}

type Cheerio$ = cheerio.CheerioAPI;

/** Converts a MathML element into readable plain text (fractions become a/b). */
function mathmlToText($: Cheerio$, el: AnyNode): string {
  if (el.type === "text") return (el as unknown as { data: string }).data;
  if (el.type !== "tag") return "";
  const tag = (el as Element).tagName.toLowerCase().replace(/^mml:/, "");
  const kids = ((el as Element).children ?? []).filter((c) => c.type === "tag" || c.type === "text");
  const tagKids = kids.filter((c) => c.type === "tag");
  const inner = (nodes: AnyNode[]) => nodes.map((c) => mathmlToText($, c)).join("");
  if (tag === "mfrac" && tagKids.length === 2) {
    return `${inner([tagKids[0]]).trim()}/${inner([tagKids[1]]).trim()}`;
  }
  if (tag === "msup" && tagKids.length === 2) {
    return `${inner([tagKids[0]]).trim()}^${inner([tagKids[1]]).trim()}`;
  }
  if (tag === "msub" && tagKids.length === 2) {
    return `${inner([tagKids[0]]).trim()}_${inner([tagKids[1]]).trim()}`;
  }
  return inner(kids);
}

/** Replaces rendered MathJax / MathML / TeX in a fragment with plain text, in place. */
function flattenMath($: Cheerio$, root: cheerio.Cheerio<Element>) {
  // MathJax v3 rendered output: keep only the assistive MathML copy.
  root.find("mjx-container").each((_, c) => {
    const math = $(c).find("math").first();
    const text = math.length ? mathmlToText($, math.get(0)!) : $(c).text();
    $(c).replaceWith(` ${text} `);
  });
  // MathJax v2 rendered output.
  root.find(".MathJax_Preview, .MathJax, .MJX_Assistive_MathML").remove();
  root.find("script[type^='math/tex']").each((_, s) => {
    $(s).replaceWith(` ${texToText($(s).text())} `);
  });
  // Raw MathML.
  root.find("math").each((_, m) => {
    $(m).replaceWith(` ${mathmlToText($, m)} `);
  });
}

function blockText($: Cheerio$, el: cheerio.Cheerio<Element>): string {
  const clone = el.clone();
  flattenMath($, clone);
  clone.find(".readmore, .readless, a.code, script, style").remove();
  // Keep paragraph / list item boundaries as new lines.
  clone.find("p, li, h1, h2, h3, h4, h5, h6, br").each((_, n) => {
    $(n).append("\n");
  });
  return texToText(clone.text())
    .split("\n")
    .map(cleanText)
    .filter(Boolean)
    .join("\n");
}

export function parseLevelPage(html: string): ParsedLearningAreaBlock[] {
  const $ = cheerio.load(html);
  const blocks: ParsedLearningAreaBlock[] = [];

  $(".learningarea").each((_, la) => {
    const area = $(la);
    const titleEl = area.find("h2.btitle .pre").first();
    const title = cleanText((titleEl.length ? titleEl : area.find("h2").first()).text());
    const subject = cleanText(title.replace(VERSION_2_SUFFIX, ""));

    // Level description: prefer the expanded ("Show more") copy.
    const desc = area.find(".description").first();
    const fullDesc = desc.find(".rfd2").first();
    const levelDescription = blockText($, fullDesc.length ? fullDesc : desc.find(".desc").first());

    // Achievement standard: may also have short/expanded copies.
    const ach = area.find(".achvstd").first();
    const fullAch = ach.find(".rfd2").first();
    const achievementStandard = blockText($, fullAch.length ? fullAch : ach.find(".desc").first());

    // Content descriptions, tracking strand (h4) and sub-strand (h5/h6) headings in document order.
    const contentDescriptions: ContentDescription[] = [];
    let strand = "";
    let subStrand: string | undefined;
    const scope = area.find(".strands").length ? area.find(".strands") : area;
    scope.find("h4, h5, h6, li.cd").each((_, node) => {
      const n = $(node);
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === "h4") {
        strand = cleanText(n.text());
        subStrand = undefined;
        return;
      }
      if (tag === "h5" || tag === "h6") {
        subStrand = cleanText(n.text());
        return;
      }
      const codeEl = n.find("a.code").first();
      const code = cleanText(codeEl.attr("data-code") ?? codeEl.text().replace(/[()]/g, ""));
      if (!code) return;
      const textRoot = n.find(".inner > div").first();
      const text = blockText($, textRoot.length ? textRoot : n).replace(/\n/g, " ");
      contentDescriptions.push({ code, strand, ...(subStrand ? { subStrand } : {}), text: cleanText(text) });
    });

    blocks.push({
      title,
      subject,
      isVersion2: VERSION_2_SUFFIX.test(title),
      levelDescription,
      achievementStandard,
      contentDescriptions,
    });
  });

  return blocks;
}

export interface DomainCandidate {
  code: string;
  label: string;
}

/**
 * Finds the domain filter codes (the `d=` query value, e.g. "M2") offered on a level page.
 * Looks at links, <option>s and checkbox inputs, since the filter markup is not documented.
 */
export function discoverDomainCodes(html: string): DomainCandidate[] {
  const $ = cheerio.load(html);
  const found = new Map<string, string>();
  const add = (code: string | undefined, label: string) => {
    const c = (code ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(c)) return;
    if (!found.has(c) || !found.get(c)) found.set(c, cleanText(label));
  };

  $("a[href*='d=']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const m = href.match(/[?&]d=([^&#]+)/);
    if (m) decodeURIComponent(m[1]).split(",").forEach((c) => add(c, $(a).text()));
  });
  $("option").each((_, o) => add($(o).attr("value"), $(o).text()));
  $("input[type='checkbox']").each((_, i) => {
    const id = $(i).attr("id");
    const label = (id ? $(`label[for='${id}']`).text() : "") || $(i).parent().text() || $(i).attr("data-name") || "";
    add($(i).attr("value") ?? $(i).attr("data-code") ?? $(i).attr("data-value"), label);
  });
  $("[data-code], [data-domain]").each((_, e) => {
    if ($(e).is("a.code")) return; // content description links, not domains
    add($(e).attr("data-domain") ?? $(e).attr("data-code"), $(e).text());
  });

  return [...found.entries()].map(([code, label]) => ({ code, label }));
}
