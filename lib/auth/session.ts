import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, type Db } from "../db";

export const SESSION_COOKIE = "eda_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [hashToken(token), userId, expires]);
  await db.query("delete from sessions where expires_at < now()"); // housekeeping
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function userForToken(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await db.query<{ id: string; email: string; display_name: string | null }>(
    `select u.id, u.email, u.display_name from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ? { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name } : null;
}

/** The signed-in teacher, or null (also null in local mode). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const db = getDb();
  if (!db) return null;
  return userForToken(db, cookies().get(SESSION_COOKIE)?.value);
}

export async function destroySession() {
  const db = getDb();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (db && token) await db.query("delete from sessions where token_hash = $1", [hashToken(token)]);
  cookies().delete(SESSION_COOKIE);
}
