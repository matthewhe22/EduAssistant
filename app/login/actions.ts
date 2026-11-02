"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/plan";
}

export async function signIn(formData: FormData) {
  const supabase = createSupabaseServerClient();
  if (!supabase) redirect("/plan");
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(safeNext(formData.get("next")));
}

export async function signUp(formData: FormData) {
  const supabase = createSupabaseServerClient();
  if (!supabase) redirect("/plan");
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    options: { data: { name: String(formData.get("name") ?? "") } },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
  }
  redirect(safeNext(formData.get("next")));
}
