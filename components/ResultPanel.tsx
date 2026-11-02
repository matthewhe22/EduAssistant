"use client";

import { useMemo, useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import type { DIFFICULTIES, Usage } from "@/lib/generator/schema";
import { formatUsd } from "@/lib/pricing";
import { YEAR_LABELS } from "@/lib/ui/labels";
import { FeedbackBar, type Feedback } from "./FeedbackBar";
import { Icon, ICONS } from "./Icon";
import { OutputView } from "./OutputViews";
import { Notice } from "./Page";
import { PlanActions } from "./PlanActions";
import { RefineContext, type RefineApi } from "./ui";

export interface ResultState {
  outputType: OutputType;
  content: Record<string, unknown>;
  warnings: string[];
  generationId: string | null;
  usage?: Usage;
  feedback?: Feedback;
}

export interface ResultContext {
  subjectSlug: string;
  subjectName: string;
  level: PrimaryLevel;
  lessonMinutes: number;
  difficulty: (typeof DIFFICULTIES)[number];
}

const CHIPS = ["Simpler language", "Shorter", "More hands-on", "Add a worked example", "More challenge"];

export function ResultPanel({
  initial,
  context,
  codeText,
  extraMeta = "",
  backHref,
}: {
  initial: ResultState;
  context: ResultContext;
  codeText: Record<string, string>;
  extraMeta?: string;
  backHref?: string;
}) {
  const [result, setResult] = useState(initial);
  const def = OUTPUTS[result.outputType];
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function refine(section: string) {
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
      setResult({ ...event, generationId: event.generationId ?? result.generationId, feedback: result.feedback });
      setInstruction("");
      setActiveKey(null);
      requestAnimationFrame(() => document.getElementById(`sec-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const api: RefineApi = useMemo(
    () => ({
      activeKey,
      refinable: (key) => key in def.sections,
      open: (key) => {
        setActiveKey(key);
        setInstruction("");
        setError("");
      },
      renderForm: (key) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            refine(key);
          }}
          className="flex flex-col gap-2.5 rounded-xl border-2 border-euc bg-paper p-4 print:hidden"
        >
          <label className="label">
            How should the {def.sections[key].toLowerCase()} change?
            <textarea
              rows={2}
              autoFocus
              required
              minLength={3}
              maxLength={1000}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="field min-h-[72px] resize-y py-2.5 font-normal"
              placeholder="e.g. make it more hands-on and add a worked example"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex flex-auto flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInstruction((prev) => (prev.trim() ? `${prev.trim().replace(/[.]$/, "")}. ${c}.` : `${c}.`))}
                  className="min-h-[36px] rounded-full border border-line-strong bg-white px-3 text-sm hover:bg-mist"
                >
                  {c}
                </button>
              ))}
            </span>
            {busy ? (
              <>
                <span className="text-sm text-ink-muted" role="status">
                  {progress === 0 ? "Thinking…" : `Rewriting… ${Math.round(progress / 100) / 10}k characters`}
                </span>
                <button type="button" className="btn text-ink-soft" onClick={() => abortRef.current?.abort()}>Stop</button>
              </>
            ) : (
              <>
                <button type="button" className="btn text-ink-soft" onClick={() => setActiveKey(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Rewrite</button>
              </>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKey, instruction, busy, progress, error, def, result],
  );

  const meta = [YEAR_LABELS[context.level], context.subjectName, def.usesLessonLength ? `${context.lessonMinutes} min` : "", extraMeta]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 print:hidden">
        {backHref ? (
          <a href={backHref} className="inline-flex items-center gap-1.5 font-bold no-underline">
            <Icon d={ICONS.back} size={18} />
            Library
          </a>
        ) : (
          <p className="m-0 font-bold">
            {result.generationId ? (
              <>Saved to <a href={`/plans/${result.generationId}`}>your library</a></>
            ) : (
              "Here it is"
            )}
          </p>
        )}
        <span className="flex-auto" />
        {result.generationId && <FeedbackBar key={result.generationId} generationId={result.generationId} initial={result.feedback} />}
        <PlanActions outputType={result.outputType} content={result.content} subjectSlug={context.subjectSlug} level={context.level} lessonMinutes={context.lessonMinutes} />
      </div>

      {result.warnings.length > 0 && (
        <div className="print:hidden">
          <Notice>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-2"><Icon d={ICONS.warning} size={18} className="mt-0.5 shrink-0" />{w}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-8">
        <nav aria-label="Sections" className="sticky top-6 flex max-w-[260px] flex-[1_1_220px] flex-col gap-0.5 text-[15px] print:hidden">
          <p className="eyebrow m-0 mb-2 text-ink-muted">In this {OUTPUTS[result.outputType].label.toLowerCase().replace(/ \/.*$/, "")}</p>
          {Object.entries(def.sections).map(([key, label]) => (
            <a
              key={key}
              href={`#sec-${key}`}
              className={`rounded-lg px-3 py-2 no-underline ${activeKey === key ? "bg-wattle-tint font-bold text-ink" : "text-ink hover:bg-mist hover:text-ink"}`}
            >
              {label}
            </a>
          ))}
          <p className="m-0 mt-4 px-3 text-sm text-ink-muted">Use “Rewrite this part” on any section to change just that section.</p>
        </nav>
        <div className="min-w-0 flex-[999_1_640px]">
          <RefineContext.Provider value={api}>
            <OutputView outputType={result.outputType} content={result.content} meta={meta} codeText={codeText} />
          </RefineContext.Provider>
          {result.usage && (
            <p className="mt-3 text-xs text-ink-muted print:hidden">
              {result.usage.model} · {result.usage.inputTokens + result.usage.cacheWriteTokens + result.usage.cacheReadTokens} input tokens ({result.usage.cacheReadTokens} reused) ·{" "}
              {result.usage.outputTokens} output tokens · about {formatUsd(result.usage.costUsd)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
