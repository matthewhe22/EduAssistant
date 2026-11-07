"use client";

import { useState } from "react";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import type { OutputType } from "@/lib/generator/outputs";
import { Icon, ICONS } from "./Icon";

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
  const isSlides = props.outputType === "slides";
  async function download(format: "docx" | "pptx") {
    setBusy(format);
    try {
      const res = await fetch(`/api/export/${format}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(props) });
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
  return (
    <div className="flex flex-wrap gap-2.5">
      <button type="button" onClick={() => window.print()} className="btn-outline">
        <Icon d={ICONS.print} size={18} />
        {props.studentOnly ? "Print student copy" : "Print"}
      </button>
      <button type="button" onClick={() => download("docx")} disabled={busy !== null} className={isSlides ? "btn-outline" : "btn-primary"}>
        <Icon d={ICONS.download} size={18} />
        {busy === "docx" ? "Preparing…" : props.studentOnly ? "Word: student copy" : isSlides ? "Word outline" : "Download Word"}
      </button>
      <button type="button" onClick={() => download("pptx")} disabled={busy !== null} className={isSlides ? "btn-primary" : "btn-outline"}>
        <Icon d={ICONS.download} size={18} />
        {busy === "pptx" ? "Preparing…" : props.studentOnly ? "PowerPoint: student copy" : isSlides ? "Download PowerPoint" : "PowerPoint"}
      </button>
    </div>
  );
}
