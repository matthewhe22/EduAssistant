"use client";

import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; match: string[] }[] }) {
  const path = usePathname();
  return (
    <div className="flex flex-auto flex-wrap gap-1">
      {links.map((l) => {
        const active = l.match.some((m) => path === m || path.startsWith(`${m}/`));
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 no-underline ${active ? "bg-euc-tint font-bold text-euc-dark" : "text-ink-soft hover:bg-mist hover:text-ink"}`}
          >
            {l.label}
          </a>
        );
      })}
    </div>
  );
}
