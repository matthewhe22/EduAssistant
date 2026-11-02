"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LEVEL_LABELS, PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LESSON_LENGTHS,
  type GenerateEvent,
  type LessonPlan,
} from "@/lib/generator/schema";
import { LessonPlanView } from "./LessonPlanView";
import { PlanActions } from "./PlanActions";

export interface SubjectOption {
  slug: string;
  subject: string;
  learningArea: string;
  levels: PrimaryLevel[];
}

interface CdOption {
  code: string;
  strand: string;
  subStrand?: string;
  text: string;
}

type Result = Extract<GenerateEvent, { type: "result" }> & {
  subjectSlug: string;
  level: PrimaryLevel;
  lessonMinutes: number;
  subjectName: string;
};

const input = "w-full rounded border px-3 py-2 text-sm dark:bg-slate-900";

export function PlanForm({ subjects, canSave }: { subjects: SubjectOption[]; canSave: boolean }) {
  const [level, setLevel] = useState<PrimaryLevel>("3");
  const available = useMemo(() => subjects.filter((s) => s.levels.includes(level)), [subjects, level]);
  const [subjectSlug, setSubjectSlug] = useState("mathematics");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("at");
  const [lessonMinutes, setLessonMinutes] = useState(60);
  const [idea, setIdea] = useState("");
  const [classContext, setClassContext] = useState("");
  const [cds, setCds] = useState<CdOption[]>([]);
  const [band, setBand] = useState<string | null>(null);
  const [focusCodes, setFocusCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the subject valid for the chosen level.
  useEffect(() => {
    if (!available.some((s) => s.slug === subjectSlug) && available[0]) setSubjectSlug(available[0].slug);
  }, [available, subjectSlug]);

  // Load content descriptions for the optional focus picker.
  useEffect(() => {
    setFocusCodes([]);
    const ctrl = new AbortController();
    fetch(`/api/curriculum?subject=${subjectSlug}&level=${level}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setCds(d.contentDescriptions ?? []);
        setBand(d.band ?? null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [subjectSlug, level]);

  const byArea = useMemo(() => {
    const groups: Record<string, SubjectOption[]> = {};
    for (const s of available) (groups[s.learningArea] ??= []).push(s);
    return groups;
  }, [available]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setStatus("generating");
    setProgress(0);
    setError("");
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const request = { level, subjectSlug, idea, difficulty, lessonMinutes, focusCodes, classContext };
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as GenerateEvent;
          if (event.type === "progress") setProgress(event.characters);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "result") {
            const subjectName = subjects.find((s) => s.slug === subjectSlug)?.subject ?? subjectSlug;
            setResult({ ...event, subjectSlug, level, lessonMinutes, subjectName });
            setStatus("done");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError((err as Error).message);
      setStatus("error");
    }
  }

  const codeText = useMemo(() => Object.fromEntries(cds.map((c) => [c.code, c.text])), [cds]);

  return (
    <div className="space-y-8">
      <form onSubmit={generate} className="space-y-4 rounded-lg border border-slate-200 p-6 print:hidden dark:border-slate-800">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm">
            Year level
            <select className={input} value={level} onChange={(e) => setLevel(e.target.value as PrimaryLevel)}>
              {PRIMARY_LEVELS.map((l) => (
                <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            Subject
            <select className={input} value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)}>
              {Object.entries(byArea).map(([area, list]) => (
                <optgroup key={area} label={area}>
                  {list.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.subject}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Lesson length
            <select className={input} value={lessonMinutes} onChange={(e) => setLessonMinutes(Number(e.target.value))}>
              {LESSON_LENGTHS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          Your idea or rough plan
          <textarea
            className={`${input} h-32`}
            required
            minLength={5}
            maxLength={4000}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. Introduce equivalent fractions using paper strips and pizza, then a partner game. Students struggled with halves vs quarters last week."
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Difficulty
            <select className={input} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Class context (optional, no student names)
            <input
              className={input}
              maxLength={1000}
              value={classContext}
              onChange={(e) => setClassContext(e.target.value)}
              placeholder="e.g. 24 students, 5 EAL/D, two need movement breaks"
            />
          </label>
        </div>

        {cds.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer">
              Focus on specific content descriptions (optional){band ? ` · ${band}` : ""}
              {focusCodes.length > 0 && ` · ${focusCodes.length} selected`}
            </summary>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {cds.map((cd) => (
                <li key={cd.code}>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={focusCodes.includes(cd.code)}
                      onChange={(e) =>
                        setFocusCodes((prev) => (e.target.checked ? [...prev, cd.code].slice(0, 10) : prev.filter((c) => c !== cd.code)))
                      }
                    />
                    <span>
                      <span className="mr-1 font-mono text-xs text-slate-500">{cd.code}</span>
                      {cd.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "generating"}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {status === "generating" ? "Generating…" : "Generate lesson plan"}
          </button>
          {status === "generating" && (
            <>
              <span className="text-sm text-slate-500">
                {progress === 0 ? "Planning the lesson…" : `Writing the plan… (${Math.round(progress / 100) / 10}k characters)`}
              </span>
              <button type="button" className="text-sm underline" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </>
          )}
          {!canSave && <span className="text-xs text-slate-500">Local mode: plans are not saved.</span>}
        </div>
        {status === "error" && <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      </form>

      {result && (
        <div className="space-y-4">
          {result.warnings.length > 0 && (
            <ul className="rounded bg-amber-50 p-3 text-sm text-amber-900 print:hidden dark:bg-amber-950 dark:text-amber-200">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <PlanActions plan={result.plan} subjectSlug={result.subjectSlug} level={result.level} lessonMinutes={result.lessonMinutes} />
          {result.generationId && (
            <p className="text-xs text-slate-500 print:hidden">
              Saved to <a className="underline" href={`/plans/${result.generationId}`}>your library</a>.
            </p>
          )}
          <LessonPlanView
            plan={result.plan}
            meta={`${result.subjectName} · ${LEVEL_LABELS[result.level]} · ${result.lessonMinutes} minutes`}
            codeText={codeText}
          />
          <p className="text-xs text-slate-400 print:hidden">
            {result.usage.model} · {result.usage.inputTokens + result.usage.cacheReadTokens} input tokens ({result.usage.cacheReadTokens} cached) · {result.usage.outputTokens} output tokens
          </p>
        </div>
      )}
    </div>
  );
}
