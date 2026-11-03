import { normaliseEmail } from "../data/users";

/** Super admin accounts, matched by email. Override with ADMIN_EMAILS (comma-separated). */
const DEFAULT_ADMINS = "matthew.he@outlook.com";

export function adminEmails(env = process.env.ADMIN_EMAILS): string[] {
  return (env?.trim() ? env : DEFAULT_ADMINS)
    .split(",")
    .map(normaliseEmail)
    .filter(Boolean);
}

/**
 * Whether a signed-in account is a super admin. Sign-ups are closed to strangers and email
 * addresses are unique, so the address identifies the account.
 */
export function isAdminEmail(email: string | null | undefined, env = process.env.ADMIN_EMAILS): boolean {
  return Boolean(email) && adminEmails(env).includes(normaliseEmail(email!));
}
