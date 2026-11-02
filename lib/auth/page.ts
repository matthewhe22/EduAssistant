import "server-only";
import { redirect } from "next/navigation";
import { getDb, type Db } from "../db";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * For pages that need a signed-in teacher. Returns null in local mode (no database);
 * redirects to /login when a database is configured but nobody is signed in.
 */
export async function pageUser(next: string): Promise<{ db: Db; user: SessionUser } | null> {
  const db = getDb();
  if (!db) return null;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { db, user };
}
