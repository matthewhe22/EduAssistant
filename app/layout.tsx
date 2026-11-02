import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EdAssistant",
  description: "Lesson planning for Victorian primary teachers, aligned to the Victorian Curriculum F–10 Version 2.0.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authEnabled = isDbConfigured();
  const user = authEnabled ? await getCurrentUser() : null;
  const link = "text-sm text-slate-600 hover:underline dark:text-slate-300";
  return (
    <html lang="en-AU">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 print:hidden dark:border-slate-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <a href="/" className="font-semibold">EdAssistant</a>
            <a href="/plan" className={link}>Create</a>
            {authEnabled && <a href="/plans" className={link}>My library</a>}
            {authEnabled && <a href="/usage" className={link}>Usage</a>}
            <a href="/curriculum" className={link}>Curriculum</a>
            <span className="ml-auto" />
            {authEnabled &&
              (user ? (
                <form action="/auth/signout" method="post" className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{user.email}</span>
                  <button className={link}>Sign out</button>
                </form>
              ) : (
                <a href="/login" className={link}>Sign in</a>
              ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500 print:hidden">
          Generated material should be reviewed by a teacher before use.
        </footer>
      </body>
    </html>
  );
}
