import "server-only";
import { AttachmentError } from "./attachments";
import { Anthropic, GenerationError } from "./claude";
import type { GenerateEvent } from "./schema";

export function errorMessage(err: unknown): string {
  if (err instanceof GenerationError || err instanceof AttachmentError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key is missing or invalid (ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Please wait a minute and try again.";
  if (err instanceof Anthropic.BadRequestError) return `The request was rejected: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Check the server's internet connection and try again.";
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status ?? "unknown"}). Please try again.`;
  if (err instanceof Error && err.name === "AbortError") return "Generation cancelled.";
  console.error(err);
  return "Something went wrong while generating.";
}

/** Runs `work` and streams its events to the browser as NDJSON. Progress events are throttled. */
export function ndjsonResponse(
  work: (send: (e: GenerateEvent) => void, progress: (characters: number) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GenerateEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let lastSent = 0;
      const progress = (characters: number) => {
        if (characters - lastSent >= 200 || characters < lastSent) {
          lastSent = characters;
          send({ type: "progress", characters });
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
