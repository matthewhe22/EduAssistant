"use client";

import { frame, CHECK_TEXTS, DOC_SAMPLES, FAN_OUTPUTS, LESSON_PHASES, PICK_OUTPUTS, YEAR_BUTTONS } from "@/lib/ui/landing-anim";
import { OUTPUT_UI } from "@/lib/ui/labels";
import { Icon, ICONS } from "../Icon";
import { useTick } from "./Clock";

const CARD = "rounded-xl border border-[#E3E6DE] bg-paper p-4";
const useFrame = () => frame(useTick());

/** The notebook-to-lesson-plan animation in the hero. Described once for screen readers. */
export function HeroDemo() {
  const f = useFrame();
  const h = f.hero;
  return (
    <div
      role="img"
      aria-label="Animated example. A teacher types a rough idea about equivalent fractions. A lesson plan appears with its curriculum code and six teaching phases that add up to exactly 60 minutes, and a matching worksheet, quiz and note home are made from it."
      className="flex max-w-[580px] flex-[1_1_440px] flex-col gap-3.5"
      style={{ opacity: h.fade }}
    >
      <div
        className="relative -rotate-1 rounded bg-white py-1.5 pl-[58px] pr-5 font-hand text-[27px] leading-8 text-[#20336B] shadow-[0_12px_0_-6px_#EEF0EA]"
        style={{ border: "1px solid #D9DDD3", backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, #E3E8DE 31px, #E3E8DE 32px)" }}
      >
        <span className="absolute bottom-0 left-[42px] top-0 w-0.5 bg-[#E7B5AA]" />
        <div className="font-sans text-xs uppercase tracking-[0.1em] text-ink-muted">Tuesday night · my idea</div>
        <div className="min-h-[96px]">
          {h.typed1}
          <br />
          {h.typed2}
          <span className="hand-cursor" />
        </div>
      </div>

      <div
        className="ml-7 w-fit -rotate-2 rounded-md border-2 border-euc px-3 py-1 text-sm font-bold uppercase tracking-[0.06em] text-euc"
        style={{ opacity: h.chipOpacity }}
      >
        Year 3 · Mathematics · 60 min
      </div>

      <div
        className="flex flex-col gap-3 rounded-2xl border border-[#D9DDD3] bg-white px-[22px] pb-[18px] pt-5 shadow-[0_22px_40px_-28px_rgba(23,32,42,0.45)]"
        style={{ opacity: h.sheetOpacity, transform: `translateY(${h.sheetOffset}px)` }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded-full bg-euc-tint px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-euc-dark">Lesson plan</span>
          <span className="rounded-md border border-[#D9DDD3] px-2 py-0.5 font-mono text-[13px] text-ink-muted">VC2M3N03</span>
        </div>
        <p className="m-0 font-display text-2xl font-bold leading-[1.15] tracking-[-0.01em]">Equivalent fractions with paper strips</p>
        <div className="flex flex-col gap-1.5">
          {h.phases.map((ph) => (
            <div key={ph.name} className="grid grid-cols-[138px_minmax(0,1fr)_54px] items-center gap-2.5 text-sm">
              <span className="text-ink-soft">{ph.name}</span>
              <span className="block h-2.5 overflow-hidden rounded-[5px] bg-[#EEF0EA]">
                <span className="block h-2.5 origin-left rounded-[5px] bg-euc" style={{ width: `${ph.percent}%`, transform: `scaleX(${ph.grow})` }} />
              </span>
              <span className="text-right tabular-nums" style={{ opacity: ph.grow }}>{ph.minutes} min</span>
            </div>
          ))}
        </div>
        <p className="m-0 flex items-center gap-2 text-[15px] font-bold text-euc" style={{ opacity: h.totalOpacity }}>
          <Icon d={ICONS.check} size={18} strokeWidth={2.6} />
          Adds up to exactly 60 minutes
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-line-strong pt-3">
          <span className="text-sm text-ink-muted">Made to match:</span>
          {h.matches.map((m) => (
            <span key={m.label} className="rounded-full border-[1.5px] border-euc px-3 py-0.5 text-sm font-bold text-euc-dark" style={{ opacity: m.opacity }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StepYears() {
  const f = useFrame();
  return (
    <div aria-hidden="true" className={`${CARD} mt-auto flex flex-col gap-3`}>
      <div className="flex flex-wrap gap-1.5">
        {YEAR_BUTTONS.map((label, i) => {
          const on = i === f.yearSelected;
          return (
            <span
              key={label}
              className={`inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-[9px] border-2 px-2 text-sm font-bold ${on ? "border-euc bg-euc text-white" : "border-line-strong bg-white text-ink"}`}
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-lg border border-line-strong bg-white px-3 py-1.5">Mathematics</span>
        <span className="rounded-lg border border-line-strong bg-white px-3 py-1.5">60 minutes</span>
      </div>
    </div>
  );
}

export function StepPicks() {
  const f = useFrame();
  return (
    <div aria-hidden="true" className={`${CARD} mt-auto grid grid-cols-2 gap-2`}>
      {PICK_OUTPUTS.map((type, i) => {
        const on = i === f.pickSelected;
        return (
          <div key={type} className={`flex items-center gap-2 rounded-[10px] border-2 p-2.5 text-sm font-bold ${on ? "border-euc bg-euc-tint" : "border-[#E3E6DE] bg-white"}`}>
            <span className="text-euc"><Icon d={OUTPUT_UI[type].icon} size={20} strokeWidth={1.8} /></span>
            {OUTPUT_UI[type].label.replace(" + answers", "")}
          </div>
        );
      })}
    </div>
  );
}

export function StepEdit() {
  const f = useFrame();
  const { edited, undone } = f.edit;
  return (
    <div aria-hidden="true" className={`${CARD} mt-auto flex flex-col gap-3`}>
      <p className="m-0 text-base">
        Fold the strip into{" "}
        <span className={`rounded px-1.5 py-px font-bold ${edited ? "bg-wattle-tint" : ""}`}>{edited ? "quarters" : "halves"}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span className="rounded-lg border border-line-strong bg-white px-3 py-1.5">Edit</span>
        <span className="rounded-lg border border-line-strong bg-white px-3 py-1.5">Rewrite with AI</span>
        <span className={`rounded-lg border-2 px-3 py-[5px] ${undone ? "border-euc bg-euc-tint" : "border-line-strong bg-white"}`}>Undo</span>
      </div>
    </div>
  );
}

export function FanDemo() {
  const f = useFrame();
  return (
    <div aria-hidden="true" className="flex min-h-[340px] flex-[1_1_420px] flex-col gap-2.5 rounded-[20px] bg-mist p-7" style={{ opacity: f.fade }}>
      <div className="-rotate-1 rounded border border-[#D9DDD3] bg-white px-4 py-2.5 font-hand text-[26px] leading-[30px] text-[#20336B]">Year 3 maths: fractions with paper strips</div>
      {FAN_OUTPUTS.map((type, i) => (
        <div
          key={type}
          className="flex items-center gap-3 rounded-[10px] border border-[#D9DDD3] bg-white px-3.5 py-2.5 text-base font-bold"
          style={{ opacity: f.fan[i].opacity, transform: `translateX(${f.fan[i].offset}px)` }}
        >
          <span className="text-euc"><Icon d={OUTPUT_UI[type].icon} size={22} strokeWidth={1.8} /></span>
          {OUTPUT_UI[type].label.replace(" + answers", "")}
          <span className="ml-auto text-[13px] font-normal text-ink-muted">ready</span>
        </div>
      ))}
    </div>
  );
}

export function DocsDemo() {
  const f = useFrame();
  return (
    <div aria-hidden="true" className="flex min-h-[340px] flex-[1_1_420px] flex-wrap content-center gap-3 rounded-[20px] bg-mist p-7">
      {DOC_SAMPLES.map((d, i) => (
        <div key={d.kind} className="flex flex-[1_1_150px] flex-col gap-2.5 rounded-[10px] border border-[#D9DDD3] bg-white p-3.5">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-euc">{d.kind}</span>
          <span className="block h-2 w-[90%] rounded bg-[#E3E8DE]" />
          <span className="block h-2 w-[70%] rounded bg-[#E3E8DE]" />
          <p className="m-0 text-[15px] leading-[1.4]">
            {d.pre}{" "}
            <span className="rounded px-1 py-px font-bold" style={{ background: `rgba(242, 181, 58, ${f.docHighlight[i]})` }}>{d.term}</span> {d.post}
          </p>
          <span className="block h-2 w-[80%] rounded bg-[#E3E8DE]" />
        </div>
      ))}
    </div>
  );
}

export function ChecksDemo() {
  const f = useFrame();
  return (
    <div aria-hidden="true" className="flex min-h-[340px] flex-[1_1_420px] items-center rounded-[20px] bg-mist p-7">
      <ul className="m-0 flex w-full list-none flex-col gap-4 rounded-[14px] border border-[#D9DDD3] bg-white p-0 px-6 py-[22px]">
        {CHECK_TEXTS.map((text, i) => (
          <li key={text} className="flex items-start gap-3 text-base">
            <span
              className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2 border-euc"
              style={{ background: f.checks[i] > 0.5 ? "#1E5A43" : "#FFFFFF" }}
            >
              <span style={{ opacity: f.checks[i] }} className="flex text-white"><Icon d={ICONS.check} size={14} strokeWidth={3.2} /></span>
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VtlmDemo() {
  const f = useFrame();
  const now = LESSON_PHASES[f.phaseSelected];
  return (
    <div aria-hidden="true" className="flex flex-[1_1_440px] flex-col gap-[18px] rounded-[20px] bg-[#0C2A1E] p-7">
      <p className="m-0 text-[13px] font-bold uppercase tracking-[0.1em] text-[#BFD3C8]">A 60-minute lesson, in six phases</p>
      <div className="flex h-14 items-stretch gap-1">
        {LESSON_PHASES.map((s, i) => (
          <span key={s.name} className="min-w-0 rounded-lg" style={{ flex: `${s.minutes} 1 0`, background: i === f.phaseSelected ? "#F2B53A" : "#3F7D63", opacity: i === f.phaseSelected ? 1 : 0.7 }} />
        ))}
      </div>
      <div className="flex min-h-[92px] flex-col gap-1 border-l-4 border-wattle pl-4">
        <span className="font-display text-2xl font-bold">{now.name}</span>
        <span className="text-base text-[#DCE8E1]">{now.text}</span>
      </div>
    </div>
  );
}
