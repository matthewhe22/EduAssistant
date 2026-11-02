import { bandForLevel, getSubject } from "@/lib/curriculum";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";

/** GET /api/curriculum?subject=mathematics&level=3 → the band's content descriptions (no elaborations). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("subject") ?? "";
  const level = searchParams.get("level") ?? "";
  if (!(PRIMARY_LEVELS as readonly string[]).includes(level)) return Response.json({ error: "Invalid level" }, { status: 400 });
  const subject = await getSubject(slug);
  const band = subject ? bandForLevel(subject, level as PrimaryLevel) : null;
  if (!subject || !band) return Response.json({ band: null, contentDescriptions: [] });
  return Response.json({
    band: band.band,
    contentDescriptions: band.contentDescriptions.map(({ code, strand, subStrand, text }) => ({ code, strand, subStrand, text })),
  });
}
