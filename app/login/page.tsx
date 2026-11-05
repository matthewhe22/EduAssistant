import { redirect } from "next/navigation";
import { Icon, ICONS } from "@/components/Icon";
import { Notice } from "@/components/Page";
import { SubmitButton } from "@/components/SubmitButton";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { findOpenInvitation } from "@/lib/data/invitations";
import { getDb, isDbConfigured } from "@/lib/db";
import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

const YEARS = ["Prep", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string; mode?: string; invite?: string } }) {
  if (!isDbConfigured()) redirect("/plan");
  const db = getDb();
  const token = searchParams.invite ?? "";
  const invitation = token && db ? await findOpenInvitation(db, token) : null;
  const signup = searchParams.mode === "signup" || (Boolean(token) && searchParams.mode !== "signin");
  const next = searchParams.next ?? "/plan";
  const tab = (active: boolean) =>
    `flex min-h-[44px] items-center justify-center rounded-[9px] no-underline ${active ? "bg-white font-bold text-ink shadow-[0_1px_2px_rgba(23,32,42,0.12)] hover:text-ink" : "text-ink-soft hover:text-ink"}`;
  const qs = (mode: string) =>
    `/login?mode=${mode}&next=${encodeURIComponent(next)}${mode === "signup" && invitation ? `&invite=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-wrap">
      <section className="flex flex-[1_1_480px] flex-col justify-between gap-12 bg-euc p-10 text-white sm:p-14">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-white text-euc">
            <Icon d={ICONS.logo} size={20} strokeWidth={2.2} />
          </span>
          <span className="font-display text-[22px] font-bold">EduAssistant</span>
        </span>
        <div className="max-w-[30ch]">
          <p className="m-0 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[48px]">From a rough idea to a ready-to-teach lesson.</p>
          <p className="m-0 mt-5 text-lg text-[#D7E6DD]">Lesson plans, worksheets, rubrics and quizzes for Prep to Year 6, matched to the Victorian Curriculum.</p>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Year levels covered">
          {YEARS.map((y, i) => (
            <li key={y} className={`rounded-full px-3 py-1.5 text-sm font-bold ${i === 0 ? "bg-wattle text-ink" : "border border-[#7FA894]"}`}>{y}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-[1_1_480px] items-center justify-center px-6 py-14">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <nav aria-label="Account" className="grid grid-cols-2 rounded-xl bg-[#EEF0EA] p-1">
            <a href={qs("signin")} aria-current={!signup ? "page" : undefined} className={tab(!signup)}>Sign in</a>
            <a href={qs("signup")} aria-current={signup ? "page" : undefined} className={tab(signup)}>Create account</a>
          </nav>
          <div>
            <h1 className="m-0 text-[32px] font-bold tracking-[-0.01em]">{invitation ? "You're invited" : signup ? "Create your account" : "Welcome back"}</h1>
            <p className="m-0 mt-1.5 text-ink-muted">
              {invitation ? "Choose a password to finish creating your account." : signup ? "It takes a few seconds." : "Sign in to see your library and keep planning."}
            </p>
          </div>
          {searchParams.error && <Notice tone="error">{searchParams.error}</Notice>}
          {token && !invitation && !searchParams.error && (
            <Notice tone="error">This invitation link has expired, been used or been withdrawn. Ask the person who invited you for a new one, or sign in if you already have an account.</Notice>
          )}
          <form className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            {invitation && <input type="hidden" name="invite" value={token} />}
            {signup && (
              <label className="label">Your name
                <input name="name" autoComplete="name" defaultValue={invitation?.displayName ?? undefined} className="field font-normal" />
              </label>
            )}
            <label className="label">Email
              {invitation ? (
                <input name="email" type="email" value={invitation.email} readOnly autoComplete="email" className="field bg-mist font-normal" />
              ) : (
                <input name="email" type="email" required autoComplete="email" className="field font-normal" />
              )}
            </label>
            <label className="label">Password
              <input
                name="password"
                type="password"
                required
                minLength={signup ? MIN_PASSWORD_LENGTH : undefined}
                autoComplete={signup ? "new-password" : "current-password"}
                className="field font-normal"
              />
              {signup && <span className="text-sm font-normal text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</span>}
            </label>
            {signup ? (
              <SubmitButton formAction={signUp} pendingText="Creating account…" className="btn-primary min-h-[52px] text-[17px]">Create account</SubmitButton>
            ) : (
              <SubmitButton formAction={signIn} pendingText="Signing in…" className="btn-primary min-h-[52px] text-[17px]">Sign in</SubmitButton>
            )}
          </form>
          <p className="m-0 rounded-xl bg-mist px-4 py-3.5 text-sm text-ink-soft">
            {invitation
              ? `This invitation is for ${invitation.email} and works until ${invitation.expiresAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "Australia/Melbourne" })}.`
              : signup
              ? "Only invited email addresses can create an account. Ask the person who runs this site to add you."
              : "Forgotten your password? Ask the person who runs this site to add a new email for you."}
          </p>
        </div>
      </section>
    </div>
  );
}
