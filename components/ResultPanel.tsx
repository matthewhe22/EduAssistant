"use client";

import { useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import { LEVEL_LABELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import type { DIFFICULTIES, Usage } from "@/lib/generator/schema";
import { OutputView } from "./OutputViews";
import { PlanActions } from "./PlanActions";

export interface ResultState {
  outputType: OutputType;
  content: Record<string, unknown>;
  warnings: string[];
  generationId: string | null;
  usage?: Usage;
}

export interface ResultContext {
  subjectSlug: string;
  subjectName: string;
  level: PrimaryLevel;
  lessonMinutes: number;
  difficulty: (typeof DIFFICULTIES)[number];
}

const input = "w-full rounded border px-3 py-2 text-sm dark:bg-slate-900";

export function ResultPanel({
  initial,
  context,
  codeText,
  extraMeta = "",
}: {
  initial: ResultState;
  context: ResultContext;
  codeText: Record<string, string>;
  extraMeta?: string;
}) {
  const [result, setResult] = useState(initial);
  const def = OUTPUTS[result.outputType];
  const [section, setSection] = useState(Object.keys(def.sections)[0]);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function refine(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setProgress(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const event = await postForResult(
        "/api/refine",
        { ...context, outputType: result.outputType, section, instruction, content: result.content, generationId: result.generationId },
        setProgress,
        ctrl.signal,
      );
      setResult({ ...event, generationId: event.generationId ?? result.generationId });
      setInstruction("");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const meta = [context.subjectName, LEVEL_LABELS[context.level], def.usesLessonLength ? `${context.lessonMinutes} minutes` : "", extraMeta]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      {result.warnings.length > 0 && (
        <ul className="rounded bg-amber-50 p-3 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-200">
          {result.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      <PlanActions outputType={result.outputType} content={result.content} subjectSlug={context.subjectSlug} level={context.level} lessonMinutes={context.lessonMinutes} />
      {result.generationId && (
        <p className="text-xs text-slate-500 print:hidden">
          Saved to <a className="underline" href={`/plans/${result.generationId}`}>your library</a>.
        </p>
      )}

      <form onSubmit={refine} className="space-y-2 rounded-lg border border-dashed border-slate-300 p-4 print:hidden dark:border-slate-700">
        <p className="text-sm font-medium">Refine one section</p>
        <div className="flex flex-wrap gap-2">
          <select className={`${input} md:w-56`} value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">
            {Object.entries(def.sections).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input
            className={`${input} flex-1`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            minLength={3}
            maxLength={1000}
            required
            placeholder="e.g. make it more hands-on, add a worked example, simplify the language"
            aria-label="How should this section change?"
          />
          <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
            {busy ? "Rewriting…" : "Rewrite section"}
          </button>
          {busy && (
            <button type="button" className="text-sm underline" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          )}
        </div>
        {busy && <p className="text-xs text-slate-500">{progress === 0 ? "Thinking…" : `Writing… (${Math.round(progress / 100) / 10}k characters)`}</p>}
        {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      </form>

      <OutputView outputType={result.outputType} content={result.content} meta={meta} codeText={codeText} />

      {result.usage && (
        <p className="text-xs text-slate-400 print:hidden">
          {result.usage.model} · {result.usage.inputTokens + result.usage.cacheReadTokens} input tokens ({result.usage.cacheReadTokens} cached) · {result.usage.outputTokens} output tokens
        </p>
      )}
    </div>
  );
}
