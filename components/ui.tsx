export function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return <p className="text-sm text-slate-500">None</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`ml-5 space-y-1 text-sm leading-6 ${ordered ? "list-decimal" : "list-disc"}`}>
      {filtered.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </Tag>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 break-inside-avoid">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase text-slate-500">{children}</p>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="break-inside-avoid rounded border border-slate-200 p-4 dark:border-slate-800">{children}</div>;
}

export function CurriculumLinksView({
  links,
  codeText,
}: {
  links: { code: string; howAddressed: string }[];
  codeText: Record<string, string>;
}) {
  return (
    <Section title="Victorian Curriculum 2.0">
      <ul className="space-y-2 text-sm leading-6">
        {links.map((l) => (
          <li key={l.code}>
            <span className="mr-2 font-mono text-xs font-semibold">{l.code}</span>
            {codeText[l.code] && <span>{codeText[l.code]}</span>}
            <div className="text-slate-600 dark:text-slate-300">{l.howAddressed}</div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Codes({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return <span className="ml-2 font-mono text-xs text-slate-500">{codes.join(", ")}</span>;
}

export function Shell({ title, meta, overview, children }: { title: string; meta: string; overview?: string; children: React.ReactNode }) {
  return (
    <article className="space-y-6 rounded-lg border border-slate-200 p-6 dark:border-slate-800 print:border-0 print:p-0">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{meta}</p>
        {overview && <p className="text-sm leading-6">{overview}</p>}
      </header>
      {children}
    </article>
  );
}
