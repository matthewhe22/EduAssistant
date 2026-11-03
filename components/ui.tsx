"use client";

import { createContext, useContext } from "react";
import { Icon, ICONS } from "./Icon";

/** Lets any section open the "Rewrite this part" form provided by ResultPanel. */
export interface RefineApi {
  activeKey: string | null;
  open: (key: string) => void;
  renderForm: (key: string) => React.ReactNode;
  refinable: (key: string) => boolean;
}
export const RefineContext = createContext<RefineApi | null>(null);

/** Display options and follow-on actions shared by the output views. */
export interface ViewOptions {
  /** Student copy: hide answers, marking guides and teacher-only notes. */
  studentCopy: boolean;
  /** Unit plans: turn one lesson into a full lesson plan. */
  expandLesson?: (lessonNumber: number) => void;
}
export const ViewOptionsContext = createContext<ViewOptions>({ studentCopy: false });
export const useViewOptions = () => useContext(ViewOptionsContext);

export function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <p className="text-ink-muted">None</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`m-0 flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
      {filtered.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </Tag>
  );
}

export function Section({
  title,
  sectionKey,
  size = "lg",
  children,
}: {
  title: string;
  sectionKey?: string;
  size?: "lg" | "sm";
  children: React.ReactNode;
}) {
  const refine = useContext(RefineContext);
  const canRewrite = Boolean(refine && sectionKey && refine.refinable(sectionKey));
  const active = canRewrite && refine!.activeKey === sectionKey;
  return (
    <section id={sectionKey ? `sec-${sectionKey}` : undefined} className="group flex scroll-mt-6 flex-col gap-3 break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`m-0 font-bold ${size === "lg" ? "text-2xl" : "text-xl"}`}>{title}</h2>
        {canRewrite && !active && (
          <button
            type="button"
            onClick={() => refine!.open(sectionKey!)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-line-strong bg-white px-3 text-sm font-bold text-ink-soft transition-opacity hover:border-euc hover:bg-euc-tint hover:text-euc-dark focus-visible:opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 print:hidden"
          >
            <Icon d={ICONS.pencil} size={16} />
            Rewrite this part
          </button>
        )}
      </div>
      {active && refine!.renderForm(sectionKey!)}
      {children}
    </section>
  );
}

export function Label({ children, tone = "euc" }: { children: React.ReactNode; tone?: "euc" | "wattle" | "muted" }) {
  const c = tone === "wattle" ? "text-[#8A5A00]" : tone === "muted" ? "text-ink-muted" : "text-euc";
  return <p className={`eyebrow m-0 mb-1 ${c}`}>{children}</p>;
}

export function Panel({ children, tone = "mist" }: { children: React.ReactNode; tone?: "mist" | "wattle" }) {
  return <div className={`break-inside-avoid rounded-xl p-4 ${tone === "wattle" ? "bg-wattle-tint" : "bg-mist"}`}>{children}</div>;
}

export function CurriculumLinksView({ links, codeText }: { links: { code: string; howAddressed: string }[]; codeText: Record<string, string> }) {
  if (!links.length) return null;
  return (
    <div id="sec-curriculum" className="flex scroll-mt-6 flex-col gap-3 rounded-xl bg-mist px-4 py-3.5 text-[15px]">
      {links.map((l) => (
        <div key={l.code}>
          <p className="m-0 mb-1 font-bold">
            Curriculum <span className="font-mono text-euc">{l.code}</span>
          </p>
          {codeText[l.code] && <p className="m-0 text-ink-soft">{codeText[l.code]}</p>}
          <p className="m-0 mt-1 italic text-ink-soft">{l.howAddressed}</p>
        </div>
      ))}
    </div>
  );
}

export function Codes({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return <span className="ml-2 font-mono text-xs font-normal text-ink-muted">{codes.join(", ")}</span>;
}

export function Shell({
  title,
  typeLabel,
  typePill,
  meta,
  children,
}: {
  title: string;
  typeLabel: string;
  typePill: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <article className="card flex min-w-0 flex-col gap-8 px-6 py-8 sm:px-12 sm:py-10 print:border-0 print:p-0">
      <header className="flex flex-col gap-2.5">
        <p className="m-0 flex flex-wrap gap-2 text-sm">
          <span className={`pill ${typePill}`}>{typeLabel}</span>
          <span className="pill border border-line font-normal text-ink-soft">{meta}</span>
        </p>
        <h1 className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[36px]">{title}</h1>
      </header>
      {children}
    </article>
  );
}
