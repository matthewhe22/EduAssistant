import "server-only";
import { notFound } from "next/navigation";
import { pageUser } from "./page";
import { isAdminEmail } from "./admin";

/** For admin pages: signed-in super admins only. Everyone else gets a plain 404. */
export async function adminPage(next: string) {
  const auth = await pageUser(next);
  if (!auth || !isAdminEmail(auth.user.email)) notFound();
  return auth;
}
