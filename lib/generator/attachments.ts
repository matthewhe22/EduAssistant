import "server-only";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { Attachment } from "./schema";

/** Upper bound for extracted text (~15k tokens). Longer files are rejected, not truncated. */
export const MAX_ATTACHMENT_TEXT = 60_000;
/** Upper bound for all files in one request together (~25k tokens). */
export const MAX_TOTAL_ATTACHMENT_TEXT = 100_000;

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const decodeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Text of a DrawingML part, one line per paragraph (<a:p>), runs (<a:t>) joined. */
function drawingText(xml: string) {
  const paras = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? [];
  return paras
    .map((p) => (p.match(/<a:t(?: [^>]*)?>([\s\S]*?)<\/a:t>/g) ?? []).map((t) => decodeXml(t.replace(/<[^>]+>/g, ""))).join(""))
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** Slide text and speaker notes from a PowerPoint (.pptx) file, in slide order. */
export async function pptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .map((name) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(name))
    .filter((m): m is RegExpExecArray => !!m)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  if (!slides.length) throw new Error("no slides");
  const out: string[] = [];
  for (const [i, m] of slides.entries()) {
    const text = drawingText(await zip.file(m[0])!.async("string"));
    // Speaker notes are linked from the slide's relationships file.
    const rels = await zip.file(`ppt/slides/_rels/slide${m[1]}.xml.rels`)?.async("string");
    const notesTarget = rels && /Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/.exec(rels)?.[1];
    const notesXml = notesTarget ? await zip.file(`ppt/notesSlides/${notesTarget}`)?.async("string") : undefined;
    // Notes slides repeat the slide number in a placeholder; drop lines that are just digits.
    const notes = notesXml ? drawingText(notesXml).split("\n").filter((l) => !/^\d+$/.test(l)).join("\n") : "";
    out.push([`Slide ${i + 1}`, text, notes ? `Speaker notes: ${notes}` : ""].filter(Boolean).join("\n"));
  }
  return out.join("\n\n");
}

export class AttachmentError extends Error {}

export interface PreparedAttachment {
  name: string;
  text: string;
}

/** Turns an uploaded PDF, Word, PowerPoint or text file into plain text that any model can read. */
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
  } else if (att.mediaType === PPTX) {
    try {
      text = await pptxText(buffer);
    } catch {
      throw new AttachmentError(`Could not read "${att.name}". Is it a valid PowerPoint (.pptx) file? Older .ppt files need to be saved as .pptx first.`);
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

/** Prepares every uploaded file, rejecting the set if together they are too long for the prompt. */
export async function prepareAttachments(atts: Attachment[]): Promise<PreparedAttachment[]> {
  const prepared: PreparedAttachment[] = [];
  for (const att of atts) prepared.push(await prepareAttachment(att));
  const total = prepared.reduce((n, a) => n + a.text.length, 0);
  if (total > MAX_TOTAL_ATTACHMENT_TEXT) {
    throw new AttachmentError(
      `Together your files are too long (${Math.round(total / 1000)}k characters; the limit is ${MAX_TOTAL_ATTACHMENT_TEXT / 1000}k). Remove a file or upload just the relevant parts.`,
    );
  }
  return prepared;
}
