import { redirect } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { isDbConfigured } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn, signUp } from "./actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  if (!isDbConfigured()) redirect("/plan");
  const input = "w-full rounded border px-3 py-2 dark:bg-slate-900";
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {searchParams.error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{searchParams.error}</p>
      )}
      <form className="space-y-3">
        <input type="hidden" name="next" value={searchParams.next ?? "/plan"} />
        <label className="block text-sm">
          Email
          <input name="email" type="email" required className={input} autoComplete="email" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required className={input} autoComplete="current-password" />
        </label>
        <SubmitButton formAction={signIn} pendingText="Signing in…" className="rounded bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">
          Sign in
        </SubmitButton>
        <details className="pt-4 text-sm">
          <summary className="cursor-pointer">Create an account</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              Your name
              <input name="name" className={input} autoComplete="name" />
            </label>
            <p className="text-xs text-slate-500">
              Uses the email and password above (at least {MIN_PASSWORD_LENGTH} characters). Only the first account, or emails the owner allows, can sign up.
            </p>
            <SubmitButton formAction={signUp} pendingText="Creating account…" className="rounded border px-4 py-2 text-sm">
              Create account
            </SubmitButton>
          </div>
        </details>
      </form>
    </div>
  );
}
