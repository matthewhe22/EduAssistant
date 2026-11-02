export function Page({
  eyebrow,
  title,
  actions,
  children,
  narrow = false,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto ${narrow ? "max-w-[880px]" : "max-w-[1240px]"} px-6 pb-16 pt-10 print:p-0`}>
      {(title || actions) && (
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            {eyebrow && <p className="eyebrow mb-1.5 text-euc">{eyebrow}</p>}
            {title && <h1 className="m-0 text-[40px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "error" | "info"; children: React.ReactNode }) {
  const cls = tone === "error" ? "bg-alert-tint text-alert" : tone === "info" ? "bg-euc-tint text-euc-dark" : "bg-wattle-tint text-wattle-ink";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-[15px] ${cls}`}>
      {children}
    </div>
  );
}
