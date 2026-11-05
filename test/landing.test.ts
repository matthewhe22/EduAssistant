import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import { CHECK_TEXTS, LESSON_PHASES, STILL_TICK, TICKS, frame } from "@/lib/ui/landing-anim";
import { CONTACT_EMAIL, FAQ, HOME_DESCRIPTION, HOME_TITLE, SITE_URL } from "@/lib/ui/landing-content";

describe("home page animation", () => {
  it("shows the finished state at the still tick (server render, reduced motion)", () => {
    const f = frame(STILL_TICK);
    expect(f.fade).toBe(1);
    expect(f.hero.typed1).toBe("Equivalent fractions with paper strips.");
    expect(f.hero.typed2.length).toBeGreaterThan(60);
    expect(f.hero.chipOpacity).toBe(1);
    expect(f.hero.sheetOpacity).toBe(1);
    expect(f.hero.sheetOffset).toBe(0);
    expect(f.hero.phases.every((p) => p.grow === 1)).toBe(true);
    expect(f.hero.totalOpacity).toBe(1);
    expect(f.hero.matches.every((m) => m.opacity === 1)).toBe(true);
    expect(f.fan.every((c) => c.opacity === 1 && c.offset === 0)).toBe(true);
    expect(f.docHighlight).toEqual([0.75, 0.75, 0.75]);
    expect(f.checks).toEqual(CHECK_TEXTS.map(() => 1));
    expect(f.edit).toEqual({ edited: true, undone: false });
    expect([f.yearSelected, f.pickSelected, f.phaseSelected]).toEqual([3, 0, 2]);
  });

  it("starts empty, so the loop begins on a blank page", () => {
    const f = frame(0);
    expect(f.hero.typed1).toBe("");
    expect(f.hero.sheetOpacity).toBe(0);
    expect(f.hero.phases.every((p) => p.grow === 0)).toBe(true);
    expect(f.checks.every((c) => c === 0)).toBe(true);
  });

  it("stays within range on every tick of the loop", () => {
    for (let t = 0; t < TICKS; t++) {
      const f = frame(t);
      const all = [f.fade, f.hero.chipOpacity, f.hero.sheetOpacity, f.hero.totalOpacity, ...f.hero.phases.map((p) => p.grow), ...f.fan.map((c) => c.opacity), ...f.checks];
      for (const n of all) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
      expect(f.yearSelected).toBeGreaterThanOrEqual(3);
      expect(f.yearSelected).toBeLessThanOrEqual(5);
      expect(f.phaseSelected).toBeGreaterThanOrEqual(0);
      expect(f.phaseSelected).toBeLessThan(LESSON_PHASES.length);
    }
    expect(frame(TICKS - 1).fade).toBe(0); // fades out before it loops
  });

  it("the demo lesson adds up to the 60 minutes it claims", () => {
    expect(LESSON_PHASES.reduce((n, p) => n + p.minutes, 0)).toBe(60);
  });
});

describe("search engine files", () => {
  it("lets crawlers in on the public pages only", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/plan", "/plans", "/admin", "/api/", "/login"]));
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("lists the public pages in the sitemap", () => {
    expect(sitemap().map((s) => s.url)).toEqual([`${SITE_URL}/`, `${SITE_URL}/curriculum`]);
  });

  it("publishes an llms.txt with the summary, the questions and the contact", async () => {
    const res = llms();
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("# Lessonroo");
    expect(text).toContain(HOME_DESCRIPTION);
    expect(text).toContain(CONTACT_EMAIL);
    for (const f of FAQ) expect(text).toContain(f.q);
  });

  it("has a title and description of a sensible length, and no VCAA wording", () => {
    expect(HOME_TITLE.length).toBeLessThanOrEqual(90);
    expect(HOME_DESCRIPTION.length).toBeGreaterThan(80);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify([FAQ, HOME_TITLE, HOME_DESCRIPTION])).not.toMatch(/VCAA|Victorian Curriculum and Assessment Authority/);
    expect(FAQ.find((f) => f.q === "How do I get an account?")!.a).toContain(CONTACT_EMAIL);
  });
});
