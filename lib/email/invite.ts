import { INVITE_DAYS } from "../data/invitations";
import type { Email } from "./send";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The invitation email: a short note and a button to the sign-up link. */
export function inviteEmail(input: { to: string; name?: string | null; link: string; inviter?: string | null; message?: string | null; replyTo?: string }): Email {
  const hello = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const who = input.inviter?.trim() || "The Lessonroo team";
  const note = input.message?.trim();
  const text = [
    hello,
    "",
    `${who} has invited you to Lessonroo, a lesson planning assistant for Victorian primary teachers (Prep to Year 6). It turns a rough idea into a lesson plan, worksheet, rubric or quiz matched to the Victorian Curriculum 2.0.`,
    ...(note ? ["", note] : []),
    "",
    "Create your account here:",
    input.link,
    "",
    `The link works for ${INVITE_DAYS} days and only for ${input.to}. If you weren't expecting this, you can ignore it.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F6F7F3;font-family:Arial,Helvetica,sans-serif;color:#17202A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:12px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#1E5A43;padding-bottom:20px">Lessonroo</td></tr>
<tr><td style="font-size:16px;line-height:1.55">
<p style="margin:0 0 14px">${esc(hello)}</p>
<p style="margin:0 0 14px"><strong>${esc(who)}</strong> has invited you to Lessonroo, a lesson planning assistant for Victorian primary teachers (Prep to Year 6). It turns a rough idea into a lesson plan, worksheet, rubric or quiz matched to the Victorian Curriculum 2.0.</p>
${note ? `<p style="margin:0 0 14px;padding:12px 14px;background:#EEF4F0;border-radius:8px;white-space:pre-line">${esc(note)}</p>` : ""}
<p style="margin:24px 0"><a href="${esc(input.link)}" style="display:inline-block;background:#1E5A43;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:9px">Create your account</a></p>
<p style="margin:0 0 14px;font-size:14px;color:#55606B">Or copy this link: <br><a href="${esc(input.link)}" style="color:#1E5A43;word-break:break-all">${esc(input.link)}</a></p>
<p style="margin:0;font-size:14px;color:#55606B">The link works for ${INVITE_DAYS} days and only for ${esc(input.to)}. If you weren't expecting this, you can ignore it.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: input.to, subject: `${who} invited you to Lessonroo`, html, text, replyTo: input.replyTo };
}
