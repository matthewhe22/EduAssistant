import "server-only";
import { MissingApiKeyError } from "../ai/config";
import { AttachmentError } from "./attachments";
import { GenerationError, OpenAI } from "./llm";
import type { GenerateEvent } from "./schema";

/** Plain-English messages for Tenon / OpenAI-compatible API errors. */
export function errorMessage(err: unknown): string {
  if (err instanceof GenerationError || err instanceof AttachmentError || err instanceof MissingApiKeyError) return err.message;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return "The AI service took too long to answer. Please try again.";
  if (err instanceof OpenAI.APIConnectionError) return "Could not reach the AI service (mytenon.com). Check the connection and try again.";
  if (err instanceof OpenAI.APIError) {
    switch (err.status) {
      case 401:
        return "Your Tenon API key was rejected. Check it on the Settings page.";
      case 402:
        return "Your Tenon balance is used up, or the key reached its spending limit. Top up at mytenon.com.";
      case 403:
        return "This Tenon key isn't allowed to use the selected model. Choose another model on the Settings page.";
      case 404:
        return "The selected model isn't available on Tenon. Choose another model on the Settings page.";
      case 429:
      case 503:
        return "The AI service is busy right now. Please try again in a minute.";
      case 400:
        return `The model rejected the request: ${err.message}`;
      default:
        return `The AI service returned an error (${err.status ?? "unknown"}). Please try again.`;
    }
  }
  if (err instanceof Error && err.name === "AbortError") return "Generation cancelled.";
  console.error(err);
  return "Something went wrong while generating.";
}

/** Runs `work` and streams its events to the browser as NDJSON. Progress events are throttled. */
export function ndjsonResponse(
  work: (send: (e: GenerateEvent) => void, progress: (characters: number, section?: string) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let lastSent = 0;
      let lastSection: string | undefined;
      const progress = (characters: number, section?: string) => {
        if (characters - lastSent >= 200 || characters < lastSent || section !== lastSection) {
          lastSent = characters;
          lastSection = section;
          send({ type: "progress", characters, ...(section ? { section } : {}) });
        }
      };
      try {
        await work(send, progress);
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Tracks which top-level section the model is writing, from the streamed JSON text.
 * Scans only new text each call, so it stays cheap on long outputs.
 */
export function sectionTracker(keys: string[]) {
  const wanted = new Set(keys);
  let scanned = 0;
  let current: string | undefined;
  return (text: string) => {
    const from = Math.max(0, scanned - 40);
    const re = /"([A-Za-z]+)"\s*:/g;
    re.lastIndex = from;
    for (let m = re.exec(text); m; m = re.exec(text)) if (wanted.has(m[1])) current = m[1];
    scanned = text.length;
    return current;
  };
}
