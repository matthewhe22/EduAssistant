import { bandForLevel, getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";

const isLevel = (v: string): v is PrimaryLevel => (PRIMARY_LEVELS as readonly string[]).includes(v);

/**
 * GET /api/curriculum?subject=mathematics&level=3[&level2=4] → the band's content descriptions
 * (no elaborations). With level2 (a composite class), both bands are merged.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("subject") ?? "";
  const level = searchParams.get("level") ?? "";
  const level2 = searchParams.get("level2") ?? "";
  if (!isLevel(level) || (level2 && !isLevel(level2))) return Response.json({ error: "Invalid level" }, { status: 400 });
  const subject = await getSubject(slug);
  const bands = subject ? [bandForLevel(subject, level), level2 ? bandForLevel(subject, level2 as PrimaryLevel) : null] : [];
  const found = bands.filter((b, i, all): b is NonNullable<typeof b> => !!b && all.findIndex((x) => x?.band === b.band) === i);
  if (!subject || !found.length) return Response.json({ band: null, contentDescriptions: [] });
  return Response.json({
    band: found.map((b) => b.band).join(" + "),
    contentDescriptions: found.flatMap((b) => b.contentDescriptions.map(({ code, strand, subStrand, text }) => ({ code, strand, subStrand, text }))),
  });
}
