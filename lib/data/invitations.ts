import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db";
import { normaliseEmail } from "./users";

export const INVITE_DAYS = 14;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: Date;
  sentAt: Date | null;
  sendCount: number;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  status: InvitationStatus;
}

type Raw = Record<string, unknown>;
const d = (v: unknown) => (v ? new Date(v as string) : null);
function toInvitation(r: Raw, now = new Date()): Invitation {
  const inv = {
    id: String(r.id),
    email: String(r.email),
    displayName: (r.display_name as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    sentAt: d(r.sent_at),
    sendCount: Number(r.send_count),
    expiresAt: new Date(r.expires_at as string),
    acceptedAt: d(r.accepted_at),
    revokedAt: d(r.revoked_at),
  };
  const status: InvitationStatus = inv.acceptedAt ? "accepted" : inv.revokedAt ? "revoked" : inv.expiresAt <= now ? "expired" : "pending";
  return { ...inv, status };
}

/**
 * Creates an invitation for `email`, or refreshes the open one (new token, new expiry), and
 * returns the raw token for the link. The token is never stored, only its hash.
 */
export async function createInvitation(
  db: Db,
  input: { email: string; displayName?: string | null; invitedBy: string | null },
): Promise<{ id: string; token: string }> {
  const email = normaliseEmail(input.email);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const name = input.displayName?.trim() || null;
  const open = await db.query<{ id: string }>(
    "select id from invitations where lower(email) = $1 and accepted_at is null and revoked_at is null",
    [email],
  );
  if (open.rows[0]) {
    await db.query(
      "update invitations set token_hash = $2, expires_at = $3, display_name = coalesce($4, display_name), invited_by = $5 where id = $1",
      [open.rows[0].id, hashToken(token), expires, name, input.invitedBy],
    );
    return { id: open.rows[0].id, token };
  }
  const { rows } = await db.query<{ id: string }>(
    "insert into invitations (email, display_name, token_hash, invited_by, expires_at) values ($1, $2, $3, $4, $5) returning id",
    [email, name, hashToken(token), input.invitedBy, expires],
  );
  return { id: rows[0].id, token };
}

/** Records that the invitation email went out. */
export async function markInvitationSent(db: Db, id: string) {
  await db.query("update invitations set sent_at = now(), send_count = send_count + 1 where id = $1", [id]);
}

/** The open, unexpired invitation for a link token, or null. */
export async function findOpenInvitation(db: Db, token: string | null | undefined): Promise<Invitation | null> {
  if (!token) return null;
  const { rows } = await db.query<Raw>(
    "select * from invitations where token_hash = $1 and accepted_at is null and revoked_at is null and expires_at > now()",
    [hashToken(token)],
  );
  return rows[0] ? toInvitation(rows[0]) : null;
}

export async function acceptInvitation(db: Db, id: string) {
  await db.query("update invitations set accepted_at = now() where id = $1 and accepted_at is null", [id]);
}

/** Withdraws an open invitation so its link stops working. */
export async function revokeInvitation(db: Db, id: string) {
  await db.query("update invitations set revoked_at = now() where id = $1 and accepted_at is null and revoked_at is null", [id]);
}

export async function getInvitation(db: Db, id: string): Promise<Invitation | null> {
  const { rows } = await db.query<Raw>("select * from invitations where id = $1", [id]);
  return rows[0] ? toInvitation(rows[0]) : null;
}

/** Most recent first. */
export async function listInvitations(db: Db, limit = 200): Promise<Invitation[]> {
  const { rows } = await db.query<Raw>(`select * from invitations order by created_at desc limit ${Number(limit)}`);
  return rows.map((r) => toInvitation(r));
}
