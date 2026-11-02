"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import { LEVEL_LABELS, PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUT_TYPES, OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import {
  ATTACHMENT_TYPES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LESSON_LENGTHS,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
} from "@/lib/generator/schema";
import { ResultPanel, type ResultContext, type ResultState } from "./ResultPanel";

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

const input = "w-full rounded border px-3 py-2 text-sm dark:bg-slate-900";
const EXTENSION_TYPES: Record<string, keyof typeof ATTACHMENT_TYPES> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

async function readAttachment(file: File): Promise<Attachment> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = EXTENSION_TYPES[ext];
  if (!mediaType) throw new Error("Upload a PDF, Word (.docx), or text file.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("That file is larger than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name: file.name, mediaType, data: btoa(binary) };
}

export function PlanForm({ subjects, canSave }: { subjects: SubjectOption[]; canSave: boolean }) {
  const [outputType, setOutputType] = useState<OutputType>("lesson_plan");
  const def = OUTPUTS[outputType];
  const [level, setLevel] = useState<PrimaryLevel>("3");
  const available = useMemo(() => subjects.filter((s) => s.levels.includes(level)), [subjects, level]);
  const [subjectSlug, setSubjectSlug] = useState("mathematics");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("at");
  const [lessonMinutes, setLessonMinutes] = useState(60);
  const [itemCounts, setItemCounts] = useState<Partial<Record<OutputType, number>>>({});
  const [idea, setIdea] = useState("");
  const [classContext, setClassContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cds, setCds] = useState<CdOption[]>([]);
  const [band, setBand] = useState<string | null>(null);
  const [focusCodes, setFocusCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ state: ResultState; context: ResultContext; codeText: Record<string, string> } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const itemCount = def.itemCount ? itemCounts[outputType] ?? def.itemCount.default : undefined;

  useEffect(() => {
    if (!available.some((s) => s.slug === subjectSlug) && available[0]) setSubjectSlug(available[0].slug);
  }, [available, subjectSlug]);

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
    try {
      const attachment = file ? await readAttachment(file) : undefined;
      const event = await postForResult(
        "/api/generate",
        { outputType, level, subjectSlug, idea, difficulty, lessonMinutes, itemCount, focusCodes, classContext, attachment },
        setProgress,
        ctrl.signal,
      );
      const subjectName = subjects.find((s) => s.slug === subjectSlug)?.subject ?? subjectSlug;
      setResult({
        state: event,
        context: { subjectSlug, subjectName, level, lessonMinutes, difficulty },
        codeText: Object.fromEntries(cds.map((c) => [c.code, c.text])),
      });
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={generate} className="space-y-5 rounded-lg border border-slate-200 p-6 print:hidden dark:border-slate-800">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">What do you need?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {OUTPUT_TYPES.map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded border p-3 text-sm ${t === outputType ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-900" : "border-slate-200 dark:border-slate-800"}`}
              >
                <input type="radio" name="outputType" value={t} checked={t === outputType} onChange={() => setOutputType(t)} className="sr-only" />
                <span className="block font-medium">{OUTPUTS[t].label}</span>
                <span className="block text-xs text-slate-500">{OUTPUTS[t].description}</span>
              </label>
            ))}
          </div>
        </fieldset>

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
          {def.usesLessonLength ? (
            <label className="block text-sm">
              Lesson length
              <select className={input} value={lessonMinutes} onChange={(e) => setLessonMinutes(Number(e.target.value))}>
                {LESSON_LENGTHS.map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>

        <label className="block text-sm">
          Your idea or rough plan
          <textarea
            className={`${input} h-28`}
            maxLength={4000}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. Equivalent fractions using paper strips and pizza, then a partner game. Students mixed up halves and quarters last week."
          />
        </label>

        <label className="block text-sm">
          Or upload an existing plan (PDF, Word or text, up to 5 MB)
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            Difficulty
            <select className={input} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </label>
          {def.itemCount ? (
            <label className="block text-sm">
              {def.itemCount.label}
              <input
                type="number"
                className={input}
                min={def.itemCount.min}
                max={def.itemCount.max}
                value={itemCount}
                onChange={(e) => setItemCounts((prev) => ({ ...prev, [outputType]: Number(e.target.value) }))}
              />
            </label>
          ) : (
            <div />
          )}
          <label className="block text-sm">
            Class context (optional, no names)
            <input
              className={input}
              maxLength={1000}
              value={classContext}
              onChange={(e) => setClassContext(e.target.value)}
              placeholder="e.g. 24 students, 5 EAL/D"
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "generating" || (idea.trim().length < 5 && !file)}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {status === "generating" ? "Generating…" : `Generate ${def.label.toLowerCase()}`}
          </button>
          {status === "generating" && (
            <>
              <span className="text-sm text-slate-500">
                {progress === 0 ? "Planning…" : `Writing… (${Math.round(progress / 100) / 10}k characters)`}
              </span>
              <button type="button" className="text-sm underline" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            </>
          )}
          {!canSave && <span className="text-xs text-slate-500">Local mode: results are not saved.</span>}
        </div>
        {status === "error" && <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      </form>

      {result && (
        <ResultPanel
          key={`${result.state.generationId ?? ""}-${String(result.state.content.title)}`}
          initial={result.state}
          context={result.context}
          codeText={result.codeText}
        />
      )}
    </div>
  );
}
