import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EdAssistant",
  description: "Lesson planning for Victorian primary teachers, aligned to the Victorian Curriculum F–10 Version 2.0.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <a href="/" className="font-semibold">EdAssistant</a>
            <a href="/curriculum" className="text-sm text-slate-600 hover:underline dark:text-slate-300">Curriculum</a>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
          Curriculum content © Victorian Curriculum and Assessment Authority (VCAA). Personal, non-commercial use.
        </footer>
      </body>
    </html>
  );
}
