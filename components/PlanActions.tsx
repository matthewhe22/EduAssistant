"use client";

import { useState } from "react";
import type { LessonPlan } from "@/lib/generator/schema";
import type { PrimaryLevel } from "@/lib/curriculum/types";

export function PlanActions(props: { plan: LessonPlan; subjectSlug: string; level: PrimaryLevel; lessonMinutes: number }) {
  const [busy, setBusy] = useState(false);
  async function downloadDocx() {
    setBusy(true);
    try {
      const res = await fetch("/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "lesson-plan.docx";
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Sorry, the Word export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button onClick={downloadDocx} disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
        {busy ? "Preparing…" : "Download Word (.docx)"}
      </button>
      <button onClick={() => window.print()} className="rounded border px-4 py-2 text-sm">
        Print
      </button>
    </div>
  );
}
