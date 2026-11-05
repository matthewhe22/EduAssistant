"use server";

import { redirect } from "next/navigation";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { acceptInvitation, findOpenInvitation } from "@/lib/data/invitations";
import { canSignUp, createUser, findUserByEmail } from "@/lib/data/users";
import { getDb } from "@/lib/db";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/plan";
}

const fail = (message: string, next: string, mode = "signin", invite = ""): never =>
  redirect(
    `/login?mode=${mode}&error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}${invite ? `&invite=${encodeURIComponent(invite)}` : ""}`,
  );

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
  const token = String(formData.get("invite") ?? "");
  // An invitation link fixes the email: the account is created for the invited address.
  const invitation = token ? await findOpenInvitation(db, token) : null;
  if (token && !invitation) fail("This invitation link has expired or been withdrawn. Ask for a new one.", next, "signup");
  const email = invitation ? invitation.email : String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.", next, "signup", token);
  if (password.length < MIN_PASSWORD_LENGTH) fail(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, next, "signup", token);
  // Check for an existing account first, so a repeated submit says "sign in" rather than "closed".
  if (await findUserByEmail(db, email)) fail("You already have an account with this email. Sign in with your password.", next);
  if (!invitation && !(await canSignUp(db, email))) fail("New accounts are closed. Ask the person who runs this site to invite you.", next, "signup");
  const id = await createUser(db, { email, passwordHash: await hashPassword(password), displayName: String(formData.get("name") ?? "") });
  if (invitation) await acceptInvitation(db, invitation.id);
  await createSession(db, id);
  redirect(next);
}
