"use server";

import { redirect } from "next/navigation";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { canSignUp, createUser, findUserByEmail } from "@/lib/data/users";
import { getDb } from "@/lib/db";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/plan";
}

const fail = (message: string, next: string): never => redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);

export async function signIn(formData: FormData) {
  const db = getDb();
  const next = safeNext(formData.get("next"));
  if (!db) redirect(next);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await findUserByEmail(db, email);
  // Same message either way so the form doesn't reveal which emails have accounts.
  if (!user || !(await verifyPassword(password, user.password_hash))) fail("Wrong email or password.", next);
  await createSession(db, user!.id);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const db = getDb();
  const next = safeNext(formData.get("next"));
  if (!db) redirect(next);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.", next);
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, next);
  if (!(await canSignUp(db, email))) fail("New accounts are closed. Ask the owner to add your email to ALLOWED_EMAILS.", next);
  if (await findUserByEmail(db, email)) fail("An account with that email already exists. Sign in instead.", next);
  const id = await createUser(db, { email, passwordHash: await hashPassword(password), displayName: String(formData.get("name") ?? "") });
  await createSession(db, id);
  redirect(next);
}
