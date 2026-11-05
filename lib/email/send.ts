/**
 * Sends email through Resend's HTTP API (https://resend.com). HTTP rather than SMTP because
 * Render's free plan blocks outgoing SMTP ports.
 *   RESEND_API_KEY  API key (re_...)
 *   EMAIL_FROM      Sender, e.g. "EduAssistant <invites@yourdomain.com>" (the domain must be verified in Resend)
 */
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type SendResult = { ok: true } | { ok: false; error: string };

export function isEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function sendEmail(email: Email, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  if (!isEmailConfigured(env)) return { ok: false, error: "Email isn't set up yet (RESEND_API_KEY and EMAIL_FROM)." };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM!.trim(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: `The email service said: ${body?.message ?? `HTTP ${res.status}`}` };
  } catch {
    return { ok: false, error: "Couldn't reach the email service." };
  }
}
