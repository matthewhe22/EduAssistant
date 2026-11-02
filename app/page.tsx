import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Signed-in teachers (and local mode) go straight to Create; everyone else to Sign in. */
export default async function Home() {
  if (isDbConfigured() && !(await getCurrentUser())) redirect("/login");
  redirect("/plan");
}
