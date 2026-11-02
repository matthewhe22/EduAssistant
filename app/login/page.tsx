import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn, signUp } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; next?: string };
}) {
  if (!isSupabaseConfigured()) redirect("/plan");
  const input = "w-full rounded border px-3 py-2 dark:bg-slate-900";
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {searchParams.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{searchParams.error}</p>}
      {searchParams.message && <p className="rounded bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{searchParams.message}</p>}
      <form className="space-y-3">
        <input type="hidden" name="next" value={searchParams.next ?? "/plan"} />
        <label className="block text-sm">
          Name (new accounts only)
          <input name="name" className={input} autoComplete="name" />
        </label>
        <label className="block text-sm">
          Email
          <input name="email" type="email" required className={input} autoComplete="email" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required minLength={8} className={input} autoComplete="current-password" />
        </label>
        <div className="flex gap-3">
          <button formAction={signIn} className="rounded bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">
            Sign in
          </button>
          <button formAction={signUp} className="rounded border px-4 py-2 text-sm">
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
