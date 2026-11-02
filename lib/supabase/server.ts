import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Supabase client acting as the signed-in teacher (RLS applies). Null when Supabase isn't configured. */
export function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
