"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { createInvitation, EMAIL_RE, getInvitation, markInvitationSent, revokeInvitation } from "@/lib/data/invitations";
import { findUserByEmail } from "@/lib/data/users";
import { getDb } from "@/lib/db";
import { inviteEmail } from "@/lib/email/invite";
import { sendEmail } from "@/lib/email/send";
import { isUuid } from "@/lib/library/server";
import { SITE_URL } from "@/lib/ui/landing-content";

export interface InviteResult {
  ok: boolean;
  message: string;
  /** Shown when the email couldn't be sent, so the admin can pass the link on another way. */
  link?: string;
}

async function requireAdmin() {
  const db = getDb();
  const user = db ? await getCurrentUser() : null;
  if (!db || !user || !isAdminEmail(user.email)) notFound();
  return { db: db!, user: user! };
}

/** The public address of this site, from the request (falls back to NEXT_PUBLIC_SITE_URL). */
function origin() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function issue(email: string, name: string | null, message: string | null): Promise<InviteResult> {
  const { db, user } = await requireAdmin();
  if (await findUserByEmail(db, email)) return { ok: false, message: `${email} already has an account.` };
  const { id, token } = await createInvitation(db, { email, displayName: name, invitedBy: user.id });
  const link = `${origin()}/login?mode=signup&invite=${encodeURIComponent(token)}`;
  const sent = await sendEmail(inviteEmail({ to: email, name, link, inviter: user.displayName || null, message, replyTo: user.email }));
  revalidatePath("/admin");
  if (!sent.ok) return { ok: false, message: `The invitation was created but the email wasn't sent. ${sent.error} Copy the link below and send it yourself.`, link };
  await markInvitationSent(db, id);
  return { ok: true, message: `Invitation sent to ${email}.` };
}

export async function inviteUser(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100) || null;
  const message = String(formData.get("message") ?? "").trim().slice(0, 1000) || null;
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email address." };
  return issue(email, name, message);
}

/** Sends the invitation again with a fresh link (the old link stops working). */
export async function resendInvite(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const { db } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const inv = isUuid(id) ? await getInvitation(db, id) : null;
  if (!inv || inv.status === "accepted" || inv.status === "revoked") return { ok: false, message: "That invitation can't be sent again." };
  return issue(inv.email, inv.displayName, null);
}

export async function withdrawInvite(formData: FormData) {
  const { db } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (isUuid(id)) await revokeInvitation(db, id);
  revalidatePath("/admin");
}
