import type { Metadata } from "next";
import { Icon, ICONS } from "@/components/Icon";
import { NavLinks } from "@/components/NavLinks";
import { isAdminEmail } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EduAssistant",
  description: "Lesson plans, worksheets, rubrics and quizzes for Prep to Year 6, matched to the Victorian Curriculum.",
};

const initials = (name: string | null, email: string) =>
  (name?.trim() ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : email.slice(0, 2)).toUpperCase();

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isDbConfigured();
  const user = authEnabled ? await getCurrentUser() : null;
  const isAdmin = Boolean(user && isAdminEmail(user.email));
  const links = [
    { href: "/plan", label: "Create", match: ["/plan"] },
    ...(authEnabled
      ? [
          { href: "/plans", label: "Library", match: ["/plans"] },
          { href: "/templates", label: "Templates", match: ["/templates"] },
          { href: "/usage", label: "Usage", match: ["/usage"] },
          { href: "/settings", label: "Settings", match: ["/settings"] },
        ]
      : []),
    { href: "/curriculum", label: "Curriculum", match: ["/curriculum"] },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", match: ["/admin"] }] : []),
  ];
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <header className="border-b border-line bg-white print:hidden">
          <nav aria-label="Main" className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-7 gap-y-2 px-6 py-3.5">
            <a href="/" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-euc text-wattle">
                <Icon d={ICONS.logo} size={18} strokeWidth={2.2} />
              </span>
              <span className="font-display text-xl font-bold tracking-tight">EduAssistant</span>
            </a>
            <NavLinks links={links} />
            {authEnabled &&
              (user ? (
                <details className="relative">
                  <summary
                    className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-2.5 [&::-webkit-details-marker]:hidden"
                    aria-label={`Account menu for ${user.displayName ?? user.email}`}
                  >
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-wattle text-sm font-bold text-ink">
                      {initials(user.displayName, user.email)}
                    </span>
                    <Icon d={ICONS.chevronDown} size={16} />
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-[0_8px_24px_rgba(23,32,42,0.12)]">
                    <p className="truncate px-2 pb-2 text-sm text-ink-muted">{user.email}</p>
                    <a href="/settings" className="block rounded-lg px-2 py-2 font-bold text-ink no-underline hover:bg-mist hover:text-ink">Settings</a>
                    <form action="/auth/signout" method="post">
                      <button className="w-full rounded-lg px-2 py-2 text-left font-bold text-ink hover:bg-mist">Sign out</button>
                    </form>
                  </div>
                </details>
              ) : (
                <a href="/login" className="btn-outline">Sign in</a>
              ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="mx-auto max-w-[1240px] px-6 pb-10 pt-4 text-sm text-ink-muted print:hidden">
          Generated material should be reviewed by a teacher before use.
        </footer>
      </body>
    </html>
  );
}
