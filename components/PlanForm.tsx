"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUT_TYPES, OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import { ATTACHMENT_TYPES, DIFFICULTIES, LESSON_LENGTHS, MAX_ATTACHMENT_BYTES, type Attachment } from "@/lib/generator/schema";
import type { FormSettings } from "@/lib/library/settings";
import { DIFFICULTY_UI, OUTPUT_UI, YEAR_LABELS, YEAR_SHORT } from "@/lib/ui/labels";
import { Icon, ICONS } from "./Icon";
import { Notice } from "./Page";
import { ResultPanel, type ResultContext, type ResultState } from "./ResultPanel";

export interface SubjectOption {
  slug: string;
  subject: string;
  learningArea: string;
  levels: PrimaryLevel[];
}

export interface TemplateOption {
  id: string;
  name: string;
  settings: FormSettings;
}

interface CdOption {
  code: string;
  strand: string;
  subStrand?: string;
  text: string;
}

const EXTENSION_TYPES: Record<string, keyof typeof ATTACHMENT_TYPES> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
};

async function readAttachment(file: File): Promise<Attachment> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = EXTENSION_TYPES[ext];
  if (!mediaType) throw new Error("Upload a PDF, Word (.docx) or text file.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("That file is larger than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name: file.name, mediaType, data: btoa(binary) };
}

function Step({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-[18px] flex items-center gap-2.5 text-xl font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-sans text-sm text-white">{n}</span>
        {title}
        {note && <span className="font-sans text-[15px] font-normal text-ink-muted">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

export function PlanForm({
  subjects,
  canSave,
  initial = {},
  initialNote,
  templates: initialTemplates = [],
}: {
  subjects: SubjectOption[];
  canSave: boolean;
  initial?: FormSettings;
  initialNote?: string;
  templates?: TemplateOption[];
}) {
  const [outputType, setOutputType] = useState<OutputType>(initial.outputType ?? "lesson_plan");
  const def = OUTPUTS[outputType];
  const [level, setLevel] = useState<PrimaryLevel>(initial.level ?? "3");
  const available = useMemo(() => subjects.filter((s) => s.levels.includes(level)), [subjects, level]);
  const [subjectSlug, setSubjectSlug] = useState(initial.subjectSlug ?? "mathematics");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>(initial.difficulty ?? "at");
  const [lessonMinutes, setLessonMinutes] = useState(initial.lessonMinutes ?? 60);
  const [itemCounts, setItemCounts] = useState<Partial<Record<OutputType, number>>>(
    initial.itemCount && initial.outputType ? { [initial.outputType]: initial.itemCount } : {},
  );
  const [idea, setIdea] = useState(initial.idea ?? "");
  const [classContext, setClassContext] = useState(initial.classContext ?? "");
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateMsg, setTemplateMsg] = useState(initialNote ?? "");
  const pendingFocus = useRef<string[] | null>(initial.focusCodes ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [cds, setCds] = useState<CdOption[]>([]);
  const [focusCodes, setFocusCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ state: ResultState; context: ResultContext; codeText: Record<string, string> } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const itemOpt = def.itemCount;
  const itemCount = itemOpt ? itemCounts[outputType] ?? itemOpt.default : undefined;
  const subjectName = subjects.find((s) => s.slug === subjectSlug)?.subject ?? subjectSlug;

  useEffect(() => {
    if (!available.some((s) => s.slug === subjectSlug) && available[0]) setSubjectSlug(available[0].slug);
  }, [available, subjectSlug]);

  useEffect(() => {
    setFocusCodes(pendingFocus.current ?? []);
    pendingFocus.current = null;
    const ctrl = new AbortController();
    fetch(`/api/curriculum?subject=${subjectSlug}&level=${level}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setCds(d.contentDescriptions ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [subjectSlug, level]);

  useEffect(() => {
    if (status === "done") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status]);

  const byArea = useMemo(() => {
    const groups: Record<string, SubjectOption[]> = {};
    for (const s of available) (groups[s.learningArea] ??= []).push(s);
    return groups;
  }, [available]);

  function applySettings(s: FormSettings) {
    if (s.outputType) setOutputType(s.outputType);
    if (s.level) setLevel(s.level);
    if (s.subjectSlug) setSubjectSlug(s.subjectSlug);
    if (s.difficulty) setDifficulty(s.difficulty);
    if (s.lessonMinutes) setLessonMinutes(s.lessonMinutes);
    if (s.itemCount && s.outputType) setItemCounts((prev) => ({ ...prev, [s.outputType!]: s.itemCount }));
    if (s.classContext !== undefined) setClassContext(s.classContext);
    if (s.idea !== undefined) setIdea(s.idea);
    const changesCurriculum = (s.subjectSlug && s.subjectSlug !== subjectSlug) || (s.level && s.level !== level);
    pendingFocus.current = changesCurriculum ? s.focusCodes ?? [] : null;
    setFocusCodes(s.focusCodes ?? []);
  }

  async function saveTemplate() {
    const name = window.prompt('Name this template (e.g. "Year 3 maths, 50 min")');
    if (!name?.trim()) return;
    const settings: FormSettings = { outputType, level, subjectSlug, difficulty, lessonMinutes, itemCount, classContext, focusCodes };
    if (idea.trim() && window.confirm("Also save the idea text in this template?")) settings.idea = idea;
    const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, settings }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTemplateMsg(data.error ?? "Could not save the template.");
      return;
    }
    setTemplates((prev) => [...prev, data.template].sort((a, b) => a.name.localeCompare(b.name)));
    setTemplateMsg(`Saved template "${data.template.name}".`);
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (idea.trim().length < 5 && !file) {
      setError("Describe your idea in a few words, or upload a plan you already have.");
      setStatus("error");
      return;
    }
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

  const segBtn = (active: boolean) =>
    `min-h-[48px] min-w-[48px] rounded-[10px] px-3 font-bold ${active ? "border-2 border-euc bg-euc text-white" : "border border-line-strong bg-white text-ink hover:bg-mist"}`;

  return (
    <div className="space-y-10">
      <form onSubmit={generate} className="flex flex-wrap items-start gap-7 print:hidden">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          <Step n={1} title="Your class">
            <fieldset className="mb-[18px]">
              <legend className="mb-2 text-[15px] font-bold">Year level</legend>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_LEVELS.map((l) => (
                  <button key={l} type="button" aria-pressed={l === level} aria-label={YEAR_LABELS[l]} onClick={() => setLevel(l)} className={segBtn(l === level)}>
                    {YEAR_SHORT[l]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="label">
                Subject
                <select className="field font-normal" value={subjectSlug} onChange={(e) => setSubjectSlug(e.target.value)}>
                  {Object.entries(byArea).map(([area, list]) => (
                    <optgroup key={area} label={area}>
                      {list.map((s) => (
                        <option key={s.slug} value={s.slug}>{s.subject}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {def.usesLessonLength && (
                <label className="label">
                  Lesson length
                  <select className="field font-normal" value={lessonMinutes} onChange={(e) => setLessonMinutes(Number(e.target.value))}>
                    {LESSON_LENGTHS.map((m) => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </Step>

          <Step n={2} title="What do you need?">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {OUTPUT_TYPES.map((t) => {
                const ui = OUTPUT_UI[t];
                const sel = t === outputType;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setOutputType(t)}
                    className={`flex min-h-[116px] flex-col gap-1.5 rounded-xl p-3.5 text-left ${sel ? "border-2 border-euc bg-euc-tint" : "border border-line bg-white hover:border-line-strong hover:bg-mist"}`}
                  >
                    <span className="flex items-center justify-between text-euc">
                      <Icon d={ui.icon} size={22} strokeWidth={1.8} />
                      {sel && <Icon d={ICONS.check} size={18} strokeWidth={2.6} />}
                    </span>
                    <span className="text-[15px] font-bold leading-tight">{ui.label}</span>
                    <span className="text-[13px] leading-snug text-ink-muted">{ui.hint}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={3} title="Your idea">
            <label className="label">
              Describe it in your own words
              <textarea
                rows={5}
                maxLength={4000}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className="field min-h-[132px] resize-y py-3 font-normal leading-normal"
                placeholder="e.g. Equivalent fractions with paper strips. A few students mixed up halves and quarters last week, so start with a quick review. Finish with a partner game."
              />
            </label>
            <label className="relative mt-3.5 flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[#9AA39A] bg-paper p-4 hover:bg-mist">
              <span className="text-euc"><Icon d={ICONS.upload} size={24} strokeWidth={1.8} /></span>
              <span className="flex-[1_1_260px]">
                <span className="block font-bold">{file ? file.name : "Or start from a plan you already have"}</span>
                <span className="block text-sm text-ink-muted">
                  {file ? "This file will be used as the starting point." : "PDF, Word or text file, up to 5 MB. Your structure and good ideas are kept."}
                </span>
              </span>
              {file ? (
                <button type="button" className="btn-outline text-sm" onClick={(e) => { e.preventDefault(); setFile(null); }}>Remove</button>
              ) : (
                <span className="btn-outline pointer-events-none text-sm">Choose file</span>
              )}
              <input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Step>

          <Step n={4} title="Fine-tune" note="optional">
            <fieldset className="mb-[18px]">
              <legend className="mb-2 text-[15px] font-bold">Difficulty</legend>
              <div className="inline-flex flex-wrap overflow-hidden rounded-xl border border-line-strong">
                {DIFFICULTIES.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === difficulty}
                    onClick={() => setDifficulty(d)}
                    className={`min-h-[44px] px-4 ${i < DIFFICULTIES.length - 1 ? "border-r border-line-strong" : ""} ${d === difficulty ? "bg-wattle-tint font-bold" : "bg-white hover:bg-mist"}`}
                  >
                    {DIFFICULTY_UI[d]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {itemOpt && itemCount !== undefined && (
                <div className="label">
                  <span id="count-label">{itemOpt.label}</span>
                  <span className="flex items-center gap-2 font-normal">
                    <button type="button" aria-label="Fewer" className="btn-outline w-11 px-0 text-xl" onClick={() => setItemCounts((p) => ({ ...p, [outputType]: Math.max(itemOpt.min, itemCount - 1) }))}>−</button>
                    <input
                      aria-labelledby="count-label"
                      inputMode="numeric"
                      value={itemCount}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, ""));
                        if (n) setItemCounts((p) => ({ ...p, [outputType]: Math.min(itemOpt.max, n) }));
                      }}
                      className="field w-16 px-0 text-center"
                    />
                    <button type="button" aria-label="More" className="btn-outline w-11 px-0 text-xl" onClick={() => setItemCounts((p) => ({ ...p, [outputType]: Math.min(itemOpt.max, itemCount + 1) }))}>+</button>
                  </span>
                </div>
              )}
              <label className="label">
                About the class
                <input
                  className="field font-normal"
                  maxLength={1000}
                  value={classContext}
                  onChange={(e) => setClassContext(e.target.value)}
                  placeholder="e.g. 24 students, 5 learning English (no names)"
                />
              </label>
            </div>
            {cds.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer font-bold text-euc">
                  Pick specific curriculum points <span className="font-normal text-ink-muted">({focusCodes.length ? `${focusCodes.length} chosen` : `${cds.length} for ${YEAR_LABELS[level]} ${subjectName.toLowerCase()}`})</span>
                </summary>
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-line p-3">
                  {cds.map((cd) => (
                    <li key={cd.code}>
                      <label className="flex gap-2.5 text-[15px]">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-euc"
                          checked={focusCodes.includes(cd.code)}
                          onChange={(e) => setFocusCodes((prev) => (e.target.checked ? [...prev, cd.code].slice(0, 10) : prev.filter((c) => c !== cd.code)))}
                        />
                        <span>
                          <span className="mr-1.5 font-mono text-xs text-ink-muted">{cd.code}</span>
                          {cd.text}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Step>
        </div>

        <aside aria-label="Summary" className="sticky top-6 flex flex-[1_1_300px] flex-col gap-3.5">
          <div className="rounded-2xl bg-ink p-6 text-white">
            <p className="eyebrow mb-3.5 text-wattle">Ready to make</p>
            <p className="font-display text-[26px] font-bold leading-[1.15]">{OUTPUT_UI[outputType].label}</p>
            <dl className="mb-[22px] mt-[18px] grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[15px]">
              <dt className="text-[#AEB6BE]">Class</dt>
              <dd>{YEAR_LABELS[level]} · {subjectName}</dd>
              {itemOpt && (
                <>
                  <dt className="text-[#AEB6BE]">Size</dt>
                  <dd>{itemCount} {itemOpt.label.replace(/^Number of /, "").toLowerCase()}</dd>
                </>
              )}
              {def.usesLessonLength && (
                <>
                  <dt className="text-[#AEB6BE]">Length</dt>
                  <dd>{lessonMinutes} minutes</dd>
                </>
              )}
              <dt className="text-[#AEB6BE]">Pitch</dt>
              <dd>{DIFFICULTY_UI[difficulty]}</dd>
              <dt className="text-[#AEB6BE]">From</dt>
              <dd className="truncate">{file ? file.name : idea.trim() ? "Your idea" : "—"}</dd>
            </dl>
            <button type="submit" disabled={status === "generating"} className="btn-wattle min-h-[52px] w-full text-[17px]">
              {status === "generating" ? "Working on it…" : OUTPUT_UI[outputType].make}
            </button>
            <p className="mt-3 text-sm text-[#C7CDD3]" role="status">
              {status === "generating"
                ? progress === 0
                  ? "Planning…"
                  : `Writing… ${Math.round(progress / 100) / 10}k characters so far`
                : "You can rewrite any part afterwards."}
            </p>
            {status === "generating" && (
              <button type="button" onClick={() => abortRef.current?.abort()} className="mt-1 text-sm font-bold text-wattle underline">
                Cancel
              </button>
            )}
            {!canSave && <p className="mt-3 text-xs text-[#AEB6BE]">Local mode: results aren&apos;t saved.</p>}
          </div>
          {status === "error" && <Notice tone="error">{error}</Notice>}
          {canSave && (
            <div className="card flex flex-col gap-2.5 p-4">
              <label className="label">
                Start from a template
                <select
                  className="field font-normal"
                  value=""
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t) {
                      applySettings(t.settings);
                      setTemplateMsg(`Loaded "${t.name}".`);
                    }
                  }}
                >
                  <option value="">{templates.length ? "Choose…" : "No templates yet"}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={saveTemplate} className="btn-outline">Save these settings as a template</button>
              {templateMsg && <p className="text-sm text-ink-muted" role="status">{templateMsg}</p>}
            </div>
          )}
        </aside>
      </form>

      {result && (
        <div ref={resultRef} className="scroll-mt-6">
          <ResultPanel
            key={`${result.state.generationId ?? ""}-${String(result.state.content.title)}`}
            initial={result.state}
            context={result.context}
            codeText={result.codeText}
          />
        </div>
      )}
    </div>
  );
}
