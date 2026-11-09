/**
 * Real photos for slides from Openverse (openverse.org), a free search of openly licensed
 * images run by WordPress. No API key is needed. Only Openverse's own thumbnail URLs are
 * fetched (never arbitrary hosts from search results), mature results are excluded, and every
 * photo comes with the credit its Creative Commons licence asks for.
 */

export const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const THUMB_HOST = "api.openverse.org";
/** Upper bound per deck: keeps downloads quick and within Openverse's anonymous rate limit. */
export const MAX_PHOTOS_PER_DECK = 15;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export interface SlideImage {
  /** "image/jpeg;base64,…" as pptxgenjs expects. */
  data: string;
  width: number;
  height: number;
  /** Short credit shown under the photo, e.g. 'Photo: "Koala" by Jo Smith, CC BY 2.0'. */
  credit: string;
  /** Page where the photo and its licence can be checked. */
  sourceUrl: string;
}

type Fetch = typeof fetch;

interface OpenverseResult {
  id?: string;
  title?: string | null;
  creator?: string | null;
  license?: string | null;
  license_version?: string | null;
  foreign_landing_url?: string | null;
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  mature?: boolean;
}

function licenceName(code: string | null | undefined, version: string | null | undefined) {
  const c = (code ?? "").toLowerCase();
  if (c === "cc0") return "CC0";
  if (c === "pdm") return "public domain";
  if (!c) return "openly licensed";
  return `CC ${c.toUpperCase()}${version ? ` ${version}` : ""}`;
}

export function creditFor(r: Pick<OpenverseResult, "title" | "creator" | "license" | "license_version">) {
  const title = (r.title ?? "").trim().slice(0, 80);
  const by = (r.creator ?? "").trim().slice(0, 60);
  return `Photo${title ? `: "${title}"` : ""}${by ? ` by ${by}` : ""}, ${licenceName(r.license, r.license_version)}`;
}

/** Width and height from a JPEG, PNG or GIF header; null if it isn't one of those. */
export function imageInfo(buf: Uint8Array): { mime: string; width: number; height: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { mime: "image/png", width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { mime: "image/gif", width: buf[6] | (buf[7] << 8), height: buf[8] | (buf[9] << 8) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const len = (buf[i + 2] << 8) | buf[i + 3];
      // Start-of-frame markers carry the size (C0–CF except C4, C8 and CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: "image/jpeg", height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Remembers results for the life of the server process, so re-downloading a deck is fast. */
const cache = new Map<string, SlideImage | null>();
const CACHE_LIMIT = 500;

/** The first suitable photo for a search, or null if there is none or Openverse can't be reached. */
export async function findImage(query: string, fetchImpl: Fetch = fetch): Promise<SlideImage | null> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!q) return null;
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  let found: SlideImage | null = null;
  try {
    const url = `${OPENVERSE_API}?${new URLSearchParams({ q, page_size: "10", mature: "false" })}`;
    const res = await withTimeout((signal) => fetchImpl(url, { signal, headers: { Accept: "application/json" } }));
    if (!res.ok) return null; // Not cached: a rate limit or outage shouldn't stick.
    const data = (await res.json()) as { results?: OpenverseResult[] };
    for (const r of data.results ?? []) {
      if (r.mature || !r.thumbnail) continue;
      let thumb: URL;
      try {
        thumb = new URL(r.thumbnail);
      } catch {
        continue;
      }
      if (thumb.protocol !== "https:" || thumb.hostname !== THUMB_HOST) continue;
      const img = await withTimeout((signal) => fetchImpl(thumb.toString(), { signal })).catch(() => null);
      if (!img?.ok) continue;
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) continue;
      const info = imageInfo(bytes);
      if (!info || !info.width || !info.height) continue;
      found = {
        data: `${info.mime};base64,${Buffer.from(bytes).toString("base64")}`,
        width: info.width,
        height: info.height,
        credit: creditFor(r),
        sourceUrl: r.foreign_landing_url ?? `https://openverse.org/image/${r.id ?? ""}`,
      };
      break;
    }
  } catch {
    return null;
  }
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, found);
  return found;
}

/** Looks up several searches, a few at a time, in the same order. Empty searches give null. */
export async function findImages(queries: string[], fetchImpl: Fetch = fetch, concurrency = 4): Promise<(SlideImage | null)[]> {
  const out: (SlideImage | null)[] = queries.map(() => null);
  const todo = queries.map((q, i) => ({ q: q.trim(), i })).filter((x) => x.q).slice(0, MAX_PHOTOS_PER_DECK);
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const { q, i } = todo[next++];
      out[i] = await findImage(q, fetchImpl);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  return out;
}

/** For tests. */
export function clearImageCache() {
  cache.clear();
}
