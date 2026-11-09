"use client";

import {
  FRAMEWORK_INFO,
  FRAMEWORK_MODE_LABELS,
  FRAMEWORK_MODES,
  FRAMEWORK_SECTIONS,
  activeSections,
  emptyFramework,
  fixedMinutes,
  sectionOf,
  type Framework,
  type FrameworkMode,
  type FrameworkSection,
  type FrameworkSectionInput,
} from "@/lib/generator/framework";

/**
 * The teacher's own lesson framework: seven sections, each with standing requirements, wording
 * to keep, or left out. Set once (remembered in this browser and saved in templates), so each
 * new lesson only needs the idea.
 */
export function FrameworkEditor({
  framework,
  onChange,
  lessonMinutes,
  usesMinutes,
  canSave,
}: {
  framework: Framework;
  onChange: (fw: Framework) => void;
  lessonMinutes: number;
  /** Slides and unit plans have no phase timings. */
  usesMinutes: boolean;
  canSave: boolean;
}) {
  const update = (key: FrameworkSection, patch: Partial<FrameworkSectionInput>) =>
    onChange({
      ...framework,
      sections: {
        ...framework.sections,
        [key]: { ...sectionOf(framework, key), ...patch },
      },
    });
  const fixed = fixedMinutes(framework);
  const active = activeSections(framework).length;

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-euc"
          checked={framework.enabled}
          onChange={(e) => onChange({ ...framework, enabled: e.target.checked })}
        />
        <span>
          <span className="block font-bold">Use my lesson framework</span>
          <span className="block text-sm text-ink-muted">
            Learning intention → activate prior knowledge → concept development → guided practice → relevance → skill closure → independent task. Write your
            usual requirements for each part once; after that you only change the idea.
            {canSave ? " Save the settings as a template to keep it." : ""} It is also remembered on this device.
          </span>
        </span>
      </label>

      {framework.enabled && (
        <>
          <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            {FRAMEWORK_SECTIONS.map((key, i) => {
              const info = FRAMEWORK_INFO[key];
              const s = sectionOf(framework, key);
              const skip = s.mode === "skip";
              const id = `fw-${key}`;
              return (
                <li key={key} className={`rounded-xl border p-3.5 ${skip ? "border-dashed border-line-strong bg-mist" : "border-line bg-white"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${skip ? "bg-line-strong text-ink-soft" : "bg-euc text-white"}`}
                    >
                      {i + 1}
                    </span>
                    <span id={`${id}-label`} className={`flex-[1_1_160px] font-bold ${skip ? "text-ink-muted line-through" : ""}`}>
                      {info.label}
                    </span>
                    <span className="flex min-w-0 max-w-full items-center gap-3">
                      <select
                        aria-label={`${info.label}: how to use it`}
                        className="field min-h-[40px] w-auto min-w-0 flex-[0_1_auto] py-1 text-sm"
                        value={s.mode}
                        onChange={(e) => update(key, { mode: e.target.value as FrameworkMode })}
                      >
                        {FRAMEWORK_MODES.map((m) => (
                          <option key={m} value={m}>
                            {FRAMEWORK_MODE_LABELS[m]}
                          </option>
                        ))}
                      </select>
                      {usesMinutes && !skip && (
                        <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
                          <input
                            type="number"
                            min={0}
                            max={180}
                            step={1}
                            aria-label={`${info.label}: minutes (0 = decide for me)`}
                            className="field min-h-[40px] w-16 px-1 text-center"
                            value={s.minutes || ""}
                            placeholder="auto"
                            onChange={(e) =>
                              update(key, {
                                minutes: Math.max(0, Math.min(180, Number(e.target.value) || 0)),
                              })
                            }
                          />
                          min
                        </label>
                      )}
                    </span>
                  </div>
                  {!skip && (
                    <>
                      <p className="m-0 mt-1.5 text-[13px] leading-snug text-ink-muted">{info.purpose}</p>
                      <textarea
                        aria-labelledby={`${id}-label`}
                        rows={3}
                        maxLength={1500}
                        value={s.text}
                        onChange={(e) => update(key, { text: e.target.value })}
                        className="field mt-2 min-h-[84px] resize-y py-2 text-[15px] font-normal leading-normal"
                        placeholder={
                          s.mode === "keep"
                            ? "Your exact wording, e.g. a routine you use every lesson. Use [brackets] for parts that change, like [today's topic]."
                            : `${info.placeholder} Leave empty to let Lessonroo decide.`
                        }
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="m-0 mt-2.5 text-sm text-ink-muted" role="status">
            {active} of {FRAMEWORK_SECTIONS.length} sections in the lesson.
            {usesMinutes && fixed > 0 && (
              <span className={fixed > lessonMinutes ? "font-bold text-alert" : ""}>
                {" "}
                {fixed} of {lessonMinutes} minutes fixed
                {fixed > lessonMinutes ? ": more than the lesson length." : "; the rest is shared out."}
              </span>
            )}
          </p>
          <button
            type="button"
            className="mt-1 text-sm font-bold text-euc-dark underline"
            onClick={() => {
              if (window.confirm("Clear the requirements and minutes for every section?")) onChange(emptyFramework());
            }}
          >
            Clear all requirements
          </button>
        </>
      )}
    </div>
  );
}
