"use client";

import { useEffect, useState } from "react";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import { DEFAULT_THEME, THEMES, themeById, type ThemeId } from "@/lib/export/themes";
import type { OutputType } from "@/lib/generator/outputs";
import { Icon, ICONS } from "./Icon";

const PREFS_KEY = "lessonroo.pptx";

/** The PowerPoint theme and photo choice last used on this device. */
function storedPrefs(): { theme: ThemeId; photos: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
    return { theme: themeById(raw.theme).id as ThemeId, photos: raw.photos !== false };
  } catch {
    return { theme: DEFAULT_THEME, photos: true };
  }
}

export function PlanActions(props: {
  outputType: OutputType;
  content: Record<string, unknown>;
  subjectSlug: string;
  level: PrimaryLevel;
  secondLevel?: PrimaryLevel;
  lessonMinutes: number;
  /** Print and download the student copy (no answers). */
  studentOnly?: boolean;
}) {
  const [busy, setBusy] = useState<"docx" | "pptx" | null>(null);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [photos, setPhotos] = useState(true);
  const isSlides = props.outputType === "slides";
  // Older decks were made before photo search words existed, so there's nothing to look up.
  const canPhoto =
    isSlides && Array.isArray(props.content.slides) && (props.content.slides as { imageSearch?: string }[]).some((s) => s.imageSearch?.trim());

  useEffect(() => {
    const p = storedPrefs();
    setTheme(p.theme);
    setPhotos(p.photos);
  }, []);

  function remember(next: { theme: ThemeId; photos: boolean }) {
    setTheme(next.theme);
    setPhotos(next.photos);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: the choice still applies to this visit */
    }
  }

  async function download(format: "docx" | "pptx") {
    setBusy(format);
    try {
      const body = format === "pptx" ? { ...props, theme, photos: canPhoto && photos } : props;
      const res = await fetch(`/api/export/${format}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `lessonroo.${format}`;
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Sorry, the ${format === "pptx" ? "PowerPoint" : "Word"} download failed. Please try again.`);
    } finally {
      setBusy(null);
    }
  }
  const current = themeById(theme);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button type="button" onClick={() => window.print()} className="btn-outline">
        <Icon d={ICONS.print} size={18} />
        {props.studentOnly ? "Print student copy" : "Print"}
      </button>
      <button type="button" onClick={() => download("docx")} disabled={busy !== null} className={isSlides ? "btn-outline" : "btn-primary"}>
        <Icon d={ICONS.download} size={18} />
        {busy === "docx" ? "Preparing…" : props.studentOnly ? "Word: student copy" : isSlides ? "Word outline" : "Download Word"}
      </button>
      <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper py-1 pl-2.5 pr-1">
        <label className="inline-flex items-center gap-1.5 text-sm">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border border-line-strong"
            style={{ background: `linear-gradient(135deg, #${current.accentDark} 50%, #${current.highlight} 50%)` }}
          />
          <span className="sr-only">PowerPoint theme</span>
          <select
            value={theme}
            onChange={(e) => remember({ theme: e.target.value as ThemeId, photos })}
            className="min-h-[36px] rounded-lg border border-line-strong bg-white px-1.5 text-sm"
            title={current.hint}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        {canPhoto && (
          <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 text-sm" title="Free, openly licensed photos from Openverse, credited on each slide">
            <input type="checkbox" className="h-4 w-4 accent-euc" checked={photos} onChange={(e) => remember({ theme, photos: e.target.checked })} />
            Add photos
          </label>
        )}
        <button type="button" onClick={() => download("pptx")} disabled={busy !== null} className={isSlides ? "btn-primary" : "btn-outline"}>
          <Icon d={ICONS.download} size={18} />
          {busy === "pptx"
            ? canPhoto && photos
              ? "Finding photos…"
              : "Preparing…"
            : props.studentOnly
              ? "PowerPoint: student copy"
              : isSlides
                ? "Download PowerPoint"
                : "PowerPoint"}
        </button>
      </span>
    </div>
  );
}
