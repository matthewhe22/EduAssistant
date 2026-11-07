"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postForResult } from "@/lib/client/ndjson";
import { PRIMARY_LEVELS, type PrimaryLevel } from "@/lib/curriculum/types";
import { OUTPUT_TYPES, OUTPUTS, type OutputType } from "@/lib/generator/outputs";
import { ATTACHMENT_TYPES, DIFFICULTIES, LESSON_LENGTHS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, type Attachment } from "@/lib/generator/schema";
import type { FormSettings } from "@/lib/library/settings";
import { exampleIdeas } from "@/lib/ui/examples";
import { classLabel, DIFFICULTY_UI, OUTPUT_UI, progressMessage, typeNoun, YEAR_LABELS, YEAR_SHORT } from "@/lib/ui/labels";
import { Icon, ICONS } from "./Icon";
import { Notice } from "./Page";
import { ResultPanel, type ResultContext, type ResultState, type SourceMaterial } from "./ResultPanel";

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
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
};

async function readAttachment(file: File): Promise<Attachment> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = EXTENSION_TYPES[ext];
  if (!mediaType) {
    if (ext === "ppt" || ext === "doc") throw new Error(`"${file.name}" is an older Office file. Save it as .${ext}x first, then upload it again.`);
    throw new Error(`"${file.name}" can't be used. Upload a PDF, Word (.docx), PowerPoint (.pptx) or text file.`);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`"${file.name}" is larger than 5 MB.`);
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
  modelLabel,
  hasKey = true,
  initialSource = null,
}: {
  subjects: SubjectOption[];
  canSave: boolean;
  modelLabel?: string;
  hasKey?: boolean;
  initial?: FormSettings;
  initialNote?: string;
  templates?: TemplateOption[];
  /** Material the new item should go with (from "Make something to go with it"). */
  initialSource?: SourceMaterial | null;
}) {
  const [outputType, setOutputType] = useState<OutputType>(initial.outputType ?? "lesson_plan");
  const def = OUTPUTS[outputType];
  const [level, setLevel] = useState<PrimaryLevel>(initial.level ?? "3");
  const [secondLevel, setSecondLevel] = useState<PrimaryLevel | undefined>(initial.secondLevel);
  const [composite, setComposite] = useState(Boolean(initial.secondLevel));
  const activeSecond = composite ? secondLevel : undefined;
  const available = useMemo(
    () => subjects.filter((s) => s.levels.includes(level) && (!activeSecond || s.levels.includes(activeSecond))),
    [subjects, level, activeSecond],
  );
  const [subjectSlug, setSubjectSlug] = useState(initial.subjectSlug ?? "mathematics");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>(initial.difficulty ?? "at");
  const [lessonMinutes, setLessonMinutes] = useState(initial.lessonMinutes ?? 60);
  const [customLength, setCustomLength] = useState(!LESSON_LENGTHS.includes((initial.lessonMinutes ?? 60) as (typeof LESSON_LENGTHS)[number]));
  const [source, setSource] = useState<SourceMaterial | null>(initialSource);
  const [itemCounts, setItemCounts] = useState<Partial<Record<OutputType, number>>>(
    initial.itemCount && initial.outputType ? { [initial.outputType]: initial.itemCount } : {},
  );
  const [idea, setIdea] = useState(initial.idea ?? "");
  const [classContext, setClassContext] = useState(initial.classContext ?? "");
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateMsg, setTemplateMsg] = useState(initialNote ?? "");
  const pendingFocus = useRef<string[] | null>(initial.focusCodes ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [cds, setCds] = useState<CdOption[]>([]);
  const [focusCodes, setFocusCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [progress, setProgress] = useState<{ characters: number; section?: string }>({ characters: 0 });
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ state: ResultState; context: ResultContext; codeText: Record<string, string> } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const itemOpt = def.itemCount;
  const itemCount = itemOpt ? itemCounts[outputType] ?? itemOpt.default : undefined;
  const subjectName = subjects.find((s) => s.slug === subjectSlug)?.subject ?? subjectSlug;
  const levelLabel = classLabel(level, activeSecond);
  const examples = useMemo(() => exampleIdeas(subjectSlug, level), [subjectSlug, level]);
  const topRef = useRef<HTMLDivElement | null>(null);

  /** Year buttons: one level normally, two for a composite class (clicking a third replaces the older pick). */
  function pickLevel(l: PrimaryLevel) {
    if (!composite) return setLevel(l);
    if (l === level) {
      if (secondLevel) {
        setLevel(secondLevel);
        setSecondLevel(undefined);
      }
      return;
    }
    if (l === secondLevel) return setSecondLevel(undefined);
    if (!secondLevel) return setSecondLevel(l);
    setLevel(secondLevel);
    setSecondLevel(l);
  }

  function makeMatching(src: SourceMaterial, type: OutputType, newIdea?: string) {
    setSource(src);
    setOutputType(type);
    setIdea(newIdea ?? "");
    setFiles([]);
    setStatus("idle");
    setTemplateMsg("");
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  useEffect(() => {
    if (!available.some((s) => s.slug === subjectSlug) && available[0]) setSubjectSlug(available[0].slug);
  }, [available, subjectSlug]);

  useEffect(() => {
    setFocusCodes(pendingFocus.current ?? []);
    pendingFocus.current = null;
    const ctrl = new AbortController();
    fetch(`/api/curriculum?subject=${subjectSlug}&level=${level}${activeSecond ? `&level2=${activeSecond}` : ""}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setCds(d.contentDescriptions ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [subjectSlug, level, activeSecond]);

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
    setSecondLevel(s.secondLevel);
    setComposite(Boolean(s.secondLevel));
    if (s.subjectSlug) setSubjectSlug(s.subjectSlug);
    if (s.difficulty) setDifficulty(s.difficulty);
    if (s.lessonMinutes) {
      setLessonMinutes(s.lessonMinutes);
      setCustomLength(!LESSON_LENGTHS.includes(s.lessonMinutes as (typeof LESSON_LENGTHS)[number]));
    }
    if (s.itemCount && s.outputType) setItemCounts((prev) => ({ ...prev, [s.outputType!]: s.itemCount }));
    if (s.classContext !== undefined) setClassContext(s.classContext);
    if (s.idea !== undefined) setIdea(s.idea);
    const changesCurriculum = (s.subjectSlug && s.subjectSlug !== subjectSlug) || (s.level && s.level !== level) || s.secondLevel !== activeSecond;
    pendingFocus.current = changesCurriculum ? s.focusCodes ?? [] : null;
    setFocusCodes(s.focusCodes ?? []);
  }

  async function saveTemplate() {
    const name = window.prompt('Name this template (e.g. "Year 3 maths, 50 min")');
    if (!name?.trim()) return;
    const settings: FormSettings = { outputType, level, secondLevel: activeSecond, subjectSlug, difficulty, lessonMinutes, itemCount, classContext, focusCodes };
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
    if (composite && !secondLevel) {
      setError("Pick the second year level for your composite class, or untick “Composite class”.");
      setStatus("error");
      return;
    }
    if (lessonMinutes < 15 || lessonMinutes > 180) {
      setError("Lesson length must be between 15 and 180 minutes.");
      setStatus("error");
      return;
    }
    if (idea.trim().length < 5 && !files.length && !source) {
      setError("Describe your idea in a few words, or upload reference material.");
      setStatus("error");
      return;
    }
    setStatus("generating");
    setProgress({ characters: 0 });
    setError("");
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const attachments = await Promise.all(files.map(readAttachment));
      const event = await postForResult(
        "/api/generate",
        {
          outputType,
          level,
          secondLevel: activeSecond,
          subjectSlug,
          idea,
          difficulty,
          lessonMinutes,
          itemCount,
          focusCodes,
          classContext,
          attachments,
          basedOn: source ?? undefined,
        },
        (characters, section) => setProgress({ characters, section }),
        ctrl.signal,
      );
      setResult({
        state: event,
        context: { subjectSlug, subjectName, level, secondLevel: activeSecond, lessonMinutes, difficulty },
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
    <div ref={topRef} className="scroll-mt-6 space-y-10">
      <form onSubmit={generate} className="flex flex-wrap items-start gap-7 print:hidden">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          {source && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-euc bg-euc-tint px-5 py-4">
              <span className="text-euc"><Icon d={ICONS.link} size={22} /></span>
              <p className="m-0 flex-[1_1_260px]">
                <strong>Making a {typeNoun(outputType)} to go with “{source.title}”</strong>
                <span className="block text-sm text-ink-soft">
                  It will match that {typeNoun(source.outputType)}. Check the settings below, add any notes, then press the button.
                </span>
              </p>
              <button type="button" className="btn-outline bg-white text-sm" onClick={() => setSource(null)}>Don&apos;t link</button>
            </div>
          )}
          <Step n={1} title="Your class">
            <fieldset className="mb-[18px]">
              <legend className="mb-2 text-[15px] font-bold">
                Year level{composite && <span className="font-normal text-ink-muted"> (pick two)</span>}
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                {PRIMARY_LEVELS.map((l) => {
                  const on = l === level || (composite && l === secondLevel);
                  return (
                    <button key={l} type="button" aria-pressed={on} aria-label={YEAR_LABELS[l]} onClick={() => pickLevel(l)} className={segBtn(on)}>
                      {YEAR_SHORT[l]}
                    </button>
                  );
                })}
                <label className="ml-1 inline-flex min-h-[48px] cursor-pointer items-center gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-euc"
                    checked={composite}
                    onChange={(e) => {
                      setComposite(e.target.checked);
                      if (e.target.checked && !secondLevel) {
                        const i = PRIMARY_LEVELS.indexOf(level);
                        setSecondLevel(PRIMARY_LEVELS[i + 1] ?? PRIMARY_LEVELS[i - 1]);
                      }
                    }}
                  />
                  Composite class
                </label>
              </div>
              {composite && (
                <p className="m-0 mt-2 text-sm text-ink-muted">
                  {secondLevel ? `${levelLabel}: one shared lesson, with adjustments for each year level.` : "Pick the second year level."}
                </p>
              )}
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
                  <span className="flex gap-2">
                    <select
                      className="field min-w-0 flex-1 font-normal"
                      value={customLength ? "custom" : lessonMinutes}
                      onChange={(e) => {
                        if (e.target.value === "custom") return setCustomLength(true);
                        setCustomLength(false);
                        setLessonMinutes(Number(e.target.value));
                      }}
                    >
                      {LESSON_LENGTHS.map((m) => (
                        <option key={m} value={m}>{m} minutes</option>
                      ))}
                      <option value="custom">Other…</option>
                    </select>
                    {customLength && (
                      <span className="flex items-center gap-1.5 font-normal">
                        <input
                          type="number"
                          aria-label="Minutes"
                          min={15}
                          max={180}
                          step={5}
                          value={lessonMinutes}
                          onChange={(e) => setLessonMinutes(Number(e.target.value))}
                          className="field w-20 text-center"
                        />
                        min
                      </span>
                    )}
                  </span>
                </label>
              )}
            </div>
          </Step>

          <Step n={2} title="What do you need?">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
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
              {source ? "Anything to add? (optional)" : "Describe it in your own words"}
              <textarea
                rows={5}
                maxLength={4000}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                className="field min-h-[132px] resize-y py-3 font-normal leading-normal"
                placeholder={
                  source
                    ? "e.g. Make it shorter, add a challenge question, or focus on the second half of the lesson."
                    : "e.g. Equivalent fractions with paper strips. A few students mixed up halves and quarters last week, so start with a quick review. Finish with a partner game."
                }
              />
            </label>
            {!source && !idea.trim() && (
              <div className="mt-2.5">
                <p className="m-0 mb-1.5 text-sm text-ink-muted">Need a start? Try one of these and change it to suit your class:</p>
                <div className="flex flex-col gap-1.5">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setIdea(ex)}
                      className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-[15px] text-ink-soft hover:border-euc hover:bg-euc-tint hover:text-ink"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3.5 flex flex-col gap-2">
              <label className="relative flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-dashed border-[#9AA39A] bg-paper p-4 hover:bg-mist">
                <span className="text-euc"><Icon d={ICONS.upload} size={24} strokeWidth={1.8} /></span>
                <span className="flex-[1_1_260px]">
                  <span className="block font-bold">{files.length ? "Add more reference material" : "Add reference material (optional)"}</span>
                  <span className="block text-sm text-ink-muted">
                    An existing plan, slides, a reading or a worksheet. PDF, Word, PowerPoint or text, up to {MAX_ATTACHMENTS} files of 5 MB each. Your structure and good ideas are kept.
                  </span>
                </span>
                <span className="btn-outline pointer-events-none text-sm">Choose files</span>
                <input
                  type="file"
                  multiple
                  accept={Object.keys(EXTENSION_TYPES).map((e) => `.${e}`).join(",")}
                  className="sr-only"
                  disabled={files.length >= MAX_ATTACHMENTS}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    const problems: string[] = [];
                    const ok = picked.filter((f) => {
                      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
                      if (!EXTENSION_TYPES[ext]) problems.push(ext === "ppt" || ext === "doc" ? `"${f.name}" is an older Office file: save it as .${ext}x first.` : `"${f.name}" isn't a PDF, Word, PowerPoint or text file.`);
                      else if (f.size > MAX_ATTACHMENT_BYTES) problems.push(`"${f.name}" is larger than 5 MB.`);
                      else return true;
                      return false;
                    });
                    const next = [...files, ...ok.filter((f) => !files.some((x) => x.name === f.name && x.size === f.size))];
                    if (next.length > MAX_ATTACHMENTS) problems.push(`You can add up to ${MAX_ATTACHMENTS} files.`);
                    setFiles(next.slice(0, MAX_ATTACHMENTS));
                    setFileError(problems.join(" "));
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Reference files">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2">
                      <span className="rounded bg-euc-tint px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-euc-dark">{f.name.split(".").pop()}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px]">{f.name}</span>
                      <span className="text-sm text-ink-muted">{f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`}</span>
                      <button type="button" className="text-sm font-bold text-euc-dark underline" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fileError && <p className="m-0 text-sm text-alert" role="alert">{fileError}</p>}
            </div>
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
                  Pick specific curriculum points <span className="font-normal text-ink-muted">({focusCodes.length ? `${focusCodes.length} chosen` : `${cds.length} for ${levelLabel} ${subjectName.toLowerCase()}`})</span>
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
          <div className="rounded-2xl border border-[#BCD6C7] bg-[#DDEDE3] p-6 text-ink">
            <p className="eyebrow mb-3.5 text-euc-dark">Ready to make</p>
            <p className="font-display text-[26px] font-bold leading-[1.15]">{OUTPUT_UI[outputType].label}</p>
            <dl className="mb-[22px] mt-[18px] grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 text-[15px]">
              <dt className="text-ink-muted">Class</dt>
              <dd>{levelLabel} · {subjectName}</dd>
              {itemOpt && (
                <>
                  <dt className="text-ink-muted">Size</dt>
                  <dd>{itemCount} {itemOpt.label.replace(/^Number of /, "").toLowerCase()}</dd>
                </>
              )}
              {def.usesLessonLength && (
                <>
                  <dt className="text-ink-muted">Length</dt>
                  <dd>{lessonMinutes} minutes</dd>
                </>
              )}
              <dt className="text-ink-muted">Pitch</dt>
              <dd>{DIFFICULTY_UI[difficulty]}</dd>
              <dt className="text-ink-muted">From</dt>
              <dd className="truncate">
                {[source ? `“${source.title}”` : idea.trim() ? "Your idea" : "", files.length ? `${files.length} reference file${files.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" + ") || "—"}
              </dd>
              {modelLabel && (
                <>
                  <dt className="text-ink-muted">Model</dt>
                  <dd>
                    {modelLabel}
                    {canSave && <a href="/settings" className="ml-2 text-sm font-bold text-euc-dark">change</a>}
                  </dd>
                </>
              )}
            </dl>
            <button type="submit" disabled={status === "generating"} className="btn-wattle min-h-[52px] w-full text-[17px]">
              {status === "generating" ? "Working on it…" : OUTPUT_UI[outputType].make}
            </button>
            <p className="mt-3 text-sm text-ink-soft" role="status">
              {status === "generating"
                ? progressMessage(def.sections, progress.characters, progress.section)
                : "You can rewrite any part afterwards."}
            </p>
            {status === "generating" && (
              <button type="button" onClick={() => abortRef.current?.abort()} className="mt-1 text-sm font-bold text-euc-dark underline">
                Cancel
              </button>
            )}
            {!canSave && <p className="mt-3 text-xs text-ink-muted">Local mode: results aren&apos;t saved.</p>}
          </div>
          {!hasKey && (
            <Notice>
              No AI key is set up yet. {canSave ? <><a href="/settings">Add your Tenon API key</a> in Settings.</> : "Set TENON_API_KEY on the server."}
            </Notice>
          )}
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
            onMakeMatching={makeMatching}
          />
        </div>
      )}
    </div>
  );
}
