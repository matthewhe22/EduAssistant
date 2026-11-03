"use client";

import { useMemo, useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import type { PrimaryLevel } from "@/lib/curriculum/types";
import { availableFixes, type Fix } from "@/lib/generator/fixes";
import { OUTPUT_TYPES, OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import type { DIFFICULTIES, UnitPlan, Usage } from "@/lib/generator/schema";
import { formatUsd } from "@/lib/pricing";
import { classLabel, OUTPUT_UI, progressMessage } from "@/lib/ui/labels";
import { FeedbackBar, type Feedback } from "./FeedbackBar";
import { Icon, ICONS } from "./Icon";
import { OutputView } from "./OutputViews";
import { Notice } from "./Page";
import { PlanActions } from "./PlanActions";
import { RefineContext, ViewOptionsContext, type RefineApi } from "./ui";

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
  secondLevel?: PrimaryLevel;
  lessonMinutes: number;
  difficulty: (typeof DIFFICULTIES)[number];
}

/** Existing material that a new item is made to go with. */
export interface SourceMaterial {
  outputType: OutputType;
  title: string;
  content: Record<string, unknown>;
  generationId: string | null;
}

/** Types with answers, where a student copy makes sense. */
const STUDENT_COPY_TYPES: OutputType[] = ["worksheet", "assessment", "differentiation"];

/** Sections hidden in a student copy. */
const TEACHER_ONLY = ["teacherNotes", "markingGuide", "nextSteps", "ealDAdjustments", "commonTask"];

/** Sensible follow-ons for each type, most useful first. */
const MATCHES: Record<OutputType, OutputType[]> = {
  lesson_plan: ["worksheet", "differentiation", "assessment", "activities", "rubric", "parent_note"],
  unit_plan: ["assessment", "rubric", "parent_note", "worksheet"],
  activities: ["worksheet", "lesson_plan", "parent_note"],
  worksheet: ["differentiation", "assessment", "lesson_plan"],
  differentiation: ["worksheet", "assessment", "lesson_plan"],
  rubric: ["assessment", "worksheet", "parent_note"],
  assessment: ["rubric", "worksheet", "differentiation"],
  parent_note: ["worksheet", "activities"],
};

/** Idea text for expanding one unit plan lesson into a full lesson plan. */
export function lessonIdea(unit: UnitPlan, n: number) {
  const l = unit.lessons.find((x) => x.number === n);
  if (!l) return "";
  return [
    `Lesson ${l.number} of ${unit.lessons.length} in the unit "${unit.title}": ${l.title}.`,
    `Learning intention: ${l.learningIntention}`,
    l.keyActivities.length ? `Key activities: ${l.keyActivities.join("; ")}` : "",
    l.resources.length ? `Resources: ${l.resources.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const CHIPS = ["Simpler language", "Shorter", "More hands-on", "Add a worked example", "More challenge"];

export function ResultPanel({
  initial,
  context,
  codeText,
  extraMeta = "",
  backHref,
  initialVersions = 0,
  onMakeMatching,
}: {
  initial: ResultState;
  context: ResultContext;
  codeText: Record<string, string>;
  extraMeta?: string;
  backHref?: string;
  /** Earlier versions saved in the library (for undo). */
  initialVersions?: number;
  /** Starts a matching item in the form. Without it, links to /plan with the library item. */
  onMakeMatching?: (source: SourceMaterial, outputType: OutputType, idea?: string) => void;
}) {
  const [result, setResult] = useState(initial);
  const def = OUTPUTS[result.outputType];
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ characters: number; section?: string }>({ characters: 0 });
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Undo: local history for this page view, plus versions saved in the library.
  const [history, setHistory] = useState<{ state: ResultState; note: string }[]>([]);
  const [serverVersions, setServerVersions] = useState(initialVersions);
  const [lastChange, setLastChange] = useState("");
  const [studentCopy, setStudentCopy] = useState(false);
  const fixes = availableFixes(result.outputType, result.content, context.lessonMinutes);
  const canUndo = result.generationId ? serverVersions > 0 || history.length > 0 : history.length > 0;
  const hasStudentCopy = STUDENT_COPY_TYPES.includes(result.outputType);
  const source: SourceMaterial = { outputType: result.outputType, title: String(result.content.title), content: result.content, generationId: result.generationId };

  function remember(note: string) {
    setHistory((h) => [...h.slice(-19), { state: result, note }]);
    setLastChange(note);
  }

  async function undo() {
    setError("");
    if (result.generationId) {
      const res = await fetch(`/api/generations/${result.generationId}/undo`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult((r) => ({ ...r, content: data.content, warnings: data.warnings }));
        setServerVersions(data.remaining);
        setHistory((h) => h.slice(0, -1));
        setLastChange("");
        return;
      }
      if (!history.length) {
        setError(data.error ?? "Could not undo.");
        return;
      }
    }
    const prev = history.at(-1);
    if (!prev) return;
    setResult(prev.state);
    setHistory((h) => h.slice(0, -1));
    setLastChange("");
  }

  async function applyFix(fix: Fix) {
    const content = fix.apply(result.content);
    const warnings = result.warnings.filter((w) => !w.startsWith(fix.warningPrefix));
    remember(fix.id === "timings" ? "Fixed the timings" : "Fixed the total marks");
    setResult((r) => ({ ...r, content, warnings }));
    if (result.generationId) {
      const res = await fetch(`/api/generations/${result.generationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, warnings, note: fix.label }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setServerVersions(data.versions);
      else setError("The fix was made here but could not be saved to your library.");
    }
  }

  function makeMatching(outputType: OutputType, idea?: string, lesson?: number) {
    if (onMakeMatching) return onMakeMatching(source, outputType, idea);
    if (result.generationId) {
      window.location.href = `/plan?basedOn=${result.generationId}&type=${outputType}${lesson ? `&lesson=${lesson}` : ""}`;
    }
  }
  const canMatch = Boolean(onMakeMatching || result.generationId);

  async function refine(section: string) {
    setBusy(true);
    setError("");
    setProgress({ characters: 0 });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const event = await postForResult(
        "/api/refine",
        { ...context, outputType: result.outputType, section, instruction, content: result.content, generationId: result.generationId },
        (characters, sec) => setProgress({ characters, section: sec }),
        ctrl.signal,
      );
      remember(`Rewrote the ${def.sections[section].toLowerCase()}`);
      if (event.generationId) setServerVersions((n) => n + 1);
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
                  {progress.characters === 0 ? "Reading your request…" : progress.section ? `Rewriting the ${def.sections[key].toLowerCase()}…` : "Thinking it through…"}
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

  const meta = [classLabel(context.level, context.secondLevel), context.subjectName, def.usesLessonLength ? `${context.lessonMinutes} min` : "", extraMeta]
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
        {canUndo && (
          <button type="button" onClick={undo} className="btn text-ink-soft" title={lastChange ? `Undo: ${lastChange.toLowerCase()}` : "Go back to the previous version"}>
            <Icon d={ICONS.undo} size={18} />
            Undo{lastChange ? `: ${lastChange.toLowerCase()}` : " last change"}
          </button>
        )}
        <span className="flex-auto" />
        {result.generationId && <FeedbackBar key={result.generationId} generationId={result.generationId} initial={result.feedback} />}
        {hasStudentCopy && (
          <div role="group" aria-label="Copy" className="inline-flex overflow-hidden rounded-xl border border-line-strong text-sm">
            {[false, true].map((sc) => (
              <button
                key={String(sc)}
                type="button"
                aria-pressed={studentCopy === sc}
                onClick={() => setStudentCopy(sc)}
                className={`min-h-[40px] px-3 ${sc ? "border-l border-line-strong" : ""} ${studentCopy === sc ? "bg-wattle-tint font-bold" : "bg-white hover:bg-mist"}`}
              >
                {sc ? "Student copy" : "Teacher copy"}
              </button>
            ))}
          </div>
        )}
        <PlanActions
          outputType={result.outputType}
          content={result.content}
          subjectSlug={context.subjectSlug}
          level={context.level}
          secondLevel={context.secondLevel}
          lessonMinutes={context.lessonMinutes}
          studentOnly={hasStudentCopy && studentCopy}
        />
      </div>

      {(result.warnings.length > 0 || fixes.length > 0 || error) && !activeKey && (
        <div className="print:hidden">
          <Notice tone={error ? "error" : undefined}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {error && <li>{error}</li>}
              {result.warnings.map((w, i) => (
                <li key={i} className="flex gap-2"><Icon d={ICONS.warning} size={18} className="mt-0.5 shrink-0" />{w}</li>
              ))}
            </ul>
            {fixes.length > 0 && (
              <p className="m-0 mt-2.5 flex flex-wrap gap-2">
                {fixes.map((f) => (
                  <button key={f.id} type="button" onClick={() => applyFix(f)} className="btn-outline min-h-[40px] bg-white text-sm">
                    <Icon d={ICONS.check} size={16} />
                    {f.label}
                  </button>
                ))}
              </p>
            )}
          </Notice>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-8">
        <nav aria-label="Sections" className="sticky top-6 flex max-w-[260px] flex-[1_1_220px] flex-col gap-0.5 text-[15px] print:hidden">
          <p className="eyebrow m-0 mb-2 text-ink-muted">In this {OUTPUTS[result.outputType].label.toLowerCase().replace(/ \/.*$/, "")}</p>
          {Object.entries(def.sections).filter(([key]) => !(studentCopy && hasStudentCopy && TEACHER_ONLY.includes(key))).map(([key, label]) => (
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
          <RefineContext.Provider value={studentCopy ? null : api}>
            <ViewOptionsContext.Provider
              value={{
                studentCopy: hasStudentCopy && studentCopy,
                expandLesson:
                  canMatch && result.outputType === "unit_plan"
                    ? (n) => makeMatching("lesson_plan", lessonIdea(result.content as UnitPlan, n), n)
                    : undefined,
              }}
            >
              <OutputView outputType={result.outputType} content={result.content} meta={meta} codeText={codeText} />
            </ViewOptionsContext.Provider>
          </RefineContext.Provider>
          {canMatch && (
            <section aria-labelledby="match-heading" className="card mt-6 flex flex-col gap-3 p-5 print:hidden">
              <h2 id="match-heading" className="m-0 text-xl font-bold">Make something to go with it</h2>
              <p className="m-0 text-[15px] text-ink-muted">Same class and settings, built from this {OUTPUT_UI[result.outputType].label.toLowerCase()} so the vocabulary and examples match.</p>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_TYPES.filter((t) => MATCHES[result.outputType].includes(t))
                  .sort((a, b) => MATCHES[result.outputType].indexOf(a) - MATCHES[result.outputType].indexOf(b))
                  .map((t) => (
                    <button key={t} type="button" onClick={() => makeMatching(t)} className="btn-outline min-h-[44px]">
                      <Icon d={OUTPUT_UI[t].icon} size={18} strokeWidth={1.8} />
                      {OUTPUT_UI[t].label}
                    </button>
                  ))}
              </div>
            </section>
          )}
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
