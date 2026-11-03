import type { GenerateEvent } from "../generator/schema";

/** POSTs JSON and reads the NDJSON event stream. Resolves with the result event or throws with the error message. */
export async function postForResult(
  url: string,
  body: unknown,
  onProgress: (characters: number, section?: string) => void,
  signal?: AbortSignal,
): Promise<Extract<GenerateEvent, { type: "result" }>> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as GenerateEvent;
      if (event.type === "progress") onProgress(event.characters, event.section);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "result") return event;
    }
  }
  throw new Error("The connection closed before the result arrived. Please try again.");
}
