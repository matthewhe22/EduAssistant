import "server-only";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { Attachment } from "./schema";

/** Upper bound for extracted text (~15k tokens). Longer files are rejected, not truncated. */
export const MAX_ATTACHMENT_TEXT = 60_000;

export class AttachmentError extends Error {}

export interface PreparedAttachment {
  name: string;
  text: string;
}

/** Turns an uploaded PDF, Word or text file into plain text that any model can read. */
export async function prepareAttachment(att: Attachment): Promise<PreparedAttachment> {
  const buffer = Buffer.from(att.data, "base64");
  let text: string;
  if (att.mediaType === "application/pdf") {
    try {
      text = (await extractText(new Uint8Array(buffer), { mergePages: true })).text;
    } catch {
      throw new AttachmentError(`Could not read "${att.name}". Is it a valid PDF?`);
    }
    if (!text.trim()) {
      throw new AttachmentError(`"${att.name}" has no selectable text (it may be a scan). Upload a Word or text version instead.`);
    }
  } else if (att.mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      text = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new AttachmentError(`Could not read "${att.name}". Is it a valid Word (.docx) file?`);
    }
  } else {
    text = buffer.toString("utf8");
  }
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new AttachmentError(`"${att.name}" has no readable text.`);
  if (text.length > MAX_ATTACHMENT_TEXT) {
    throw new AttachmentError(
      `"${att.name}" is too long (${Math.round(text.length / 1000)}k characters; the limit is ${MAX_ATTACHMENT_TEXT / 1000}k). Upload just the relevant part.`,
    );
  }
  return { name: att.name, text };
}
