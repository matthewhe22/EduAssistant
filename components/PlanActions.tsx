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
  const [busy, setBusy] = useState(false);
  async function downloadDocx() {
    setBusy(true);
    try {
      const res = await fetch("/api/export/docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(props) });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "lessonroo.docx";
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Sorry, the Word download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2.5">
      <button type="button" onClick={() => window.print()} className="btn-outline">
        <Icon d={ICONS.print} size={18} />
        {props.studentOnly ? "Print student copy" : "Print"}
      </button>
      <button type="button" onClick={downloadDocx} disabled={busy} className="btn-primary">
        <Icon d={ICONS.download} size={18} />
        {busy ? "Preparing…" : props.studentOnly ? "Word: student copy" : "Download Word"}
      </button>
    </div>
  );
}
