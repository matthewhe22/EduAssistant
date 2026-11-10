/**
 * Runs the real Tenon client code (OpenAI SDK, streaming, JSON parsing, repair) against a
 * local fake of Tenon's OpenAI-compatible API.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonPlanSchema } from "@/lib/generator/schema";
import { samplePlan } from "./fixtures/sample-plan";

type Handler = (body: Record<string, unknown>, req: IncomingMessage) => { status?: number; sse?: unknown[]; json?: unknown };
let handler: Handler;
const requests: Record<string, unknown>[] = [];
let server: Server;
let llm: typeof import("@/lib/generator/llm");
let stream: typeof import("@/lib/generator/stream");

const chunk = (content: string, extra: Record<string, unknown> = {}) => ({
  id: "c1",
  object: "chat.completion.chunk",
  created: 0,
  model: "glm-5.3-flash",
  choices: [{ index: 0, delta: { content }, finish_reason: null }],
  ...extra,
});
const finish = (reason: string, usage?: unknown) => ({
  id: "c1",
  object: "chat.completion.chunk",
  created: 0,
  model: "glm-5.3-flash",
  choices: [{ index: 0, delta: {}, finish_reason: reason }],
  ...(usage ? { usage } : {}),
});

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      if (req.url?.startsWith("/v1/models")) {
        if (req.headers.authorization !== "Bearer sk-tx-good") {
          res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "invalid key" } }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(
          JSON.stringify({ object: "list", data: ["glm-5.3-flash", "claude-opus-5-5", "llama-guard-4-12b"].map((id) => ({ id, object: "model", owned_by: "x", created: 0 })) }),
        );
        return;
      }
      const body = JSON.parse(raw || "{}");
      requests.push(body);
      const out = handler(body, req);
      if (out.sse) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const e of out.sse) res.write(`data: ${JSON.stringify(e)}\n\n`);
        res.end("data: [DONE]\n\n");
      } else {
        res.writeHead(out.status ?? 200, { "Content-Type": "application/json" }).end(JSON.stringify(out.json));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  vi.stubEnv("TENON_BASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`);
  llm = await import("@/lib/generator/llm");
  stream = await import("@/lib/generator/stream");
});
afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  requests.length = 0;
});

const ai = { apiKey: "sk-tx-good", model: "glm-5.3-flash", keySource: "user" as const };
const run = (model = ai.model, onProgress: (n: number) => void = () => {}) =>
  llm.generateStructured({ schema: LessonPlanSchema, ai: { ...ai, model }, curriculumText: "CURRICULUM", requestText: "REQUEST", onProgress });

describe("generateStructured via Tenon", () => {
  it("streams JSON, reports progress and maps cached-token usage", async () => {
    const text = "```json\n" + JSON.stringify(samplePlan) + "\n```";
    handler = () => ({
      sse: [chunk(text.slice(0, 300)), chunk(text.slice(300)), finish("stop", { prompt_tokens: 9000, completion_tokens: 2500, prompt_tokens_details: { cached_tokens: 8000 } })],
    });
    const progress: number[] = [];
    const result = await run(ai.model, (n) => progress.push(n));
    expect(result.content.title).toBe(samplePlan.title);
    expect(result.usage).toMatchObject({ inputTokens: 1000, cacheReadTokens: 8000, outputTokens: 2500 });
    expect(result.usage.costUsd).toBeCloseTo((1000 * 0.18 + 8000 * 0.036 + 2500 * 0.6) / 1e6, 5);
    expect(progress.at(-1)).toBe(text.length);

    const sent = requests[0] as { model: string; stream: boolean; response_format?: unknown; messages: { role: string; content: string }[] };
    expect(sent).toMatchObject({ model: "glm-5.3-flash", stream: true, response_format: { type: "json_object" } });
    expect(sent.messages[0].role).toBe("system");
    expect(sent.messages[0].content).toContain("JSON Schema");
    expect(sent.messages[0].content).toContain('"learningIntention"');
    expect(sent.messages[1].content).toBe("CURRICULUM\n\n---\n\nREQUEST");
  });

  it("doesn't send OpenAI JSON mode to Claude models", async () => {
    handler = () => ({ sse: [chunk(JSON.stringify(samplePlan)), finish("stop")] });
    await run("claude-opus-5-5");
    expect(requests[0]).not.toHaveProperty("response_format");
  });

  it("repairs an invalid first answer once", async () => {
    handler = (body) =>
      body.stream
        ? { sse: [chunk('{"title": "Half a plan"}'), finish("stop", { prompt_tokens: 100, completion_tokens: 10 })] }
        : { json: { id: "r", object: "chat.completion", created: 0, model: "glm-5.3-flash", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(samplePlan) }, finish_reason: "stop" }], usage: { prompt_tokens: 200, completion_tokens: 20 } } };
    const result = await run();
    expect(result.content.overview).toBe(samplePlan.overview);
    expect(requests).toHaveLength(2);
    const repair = requests[1] as { messages: { role: string; content: string }[] };
    expect(repair.messages.at(-2)).toEqual({ role: "assistant", content: '{"title": "Half a plan"}' });
    expect(repair.messages.at(-1)?.content).toContain("overview");
    expect(result.usage).toMatchObject({ inputTokens: 300, outputTokens: 30 });
  });

  it("gives up after one failed repair", async () => {
    handler = (body) =>
      body.stream
        ? { sse: [chunk("not json at all"), finish("stop")] }
        : { json: { id: "r", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content: "still not json" }, finish_reason: "stop" }] } };
    await expect(run()).rejects.toThrow(/unexpected format/);
  });

  it("reports cut-off output", async () => {
    handler = () => ({ sse: [chunk('{"title": "x"'), finish("length")] });
    await expect(run()).rejects.toThrow(/too long/);
  });

  it("turns Tenon errors into plain-English messages", async () => {
    for (const [status, expected] of [
      [401, /key was rejected/],
      [402, /balance is used up/],
      [404, /isn't available on Tenon/],
      [503, /busy/],
    ] as const) {
      handler = () => ({ status, json: { error: { message: "x" } } });
      const err = await run().catch((e) => e);
      expect(stream.errorMessage(err)).toMatch(expected);
    }
  });
});

describe("models and key checks", () => {
  it("lists models for a valid key and checks keys", async () => {
    expect(await llm.listModelIds("sk-tx-good")).toEqual(["glm-5.3-flash", "claude-opus-5-5", "llama-guard-4-12b"]);
    expect(await llm.listModelIds("sk-tx-bad")).toBeNull();
    expect(await llm.checkApiKey("sk-tx-good")).toBe("ok");
    expect(await llm.checkApiKey("sk-tx-bad")).toBe("invalid");
  });
});

describe("helpers", () => {
  it("extracts JSON from fenced or wrapped replies", () => {
    expect(llm.extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(llm.extractJson('Here you go: {"a":2} Thanks')).toEqual({ a: 2 });
    expect(() => llm.extractJson("nothing")).toThrow();
  });
  it("maps DeepSeek's prompt_cache_hit_tokens too", () => {
    expect(llm.mapUsage({ prompt_tokens: 500, completion_tokens: 50, prompt_cache_hit_tokens: 400 })).toEqual({ inputTokens: 100, cacheWriteTokens: 0, cacheReadTokens: 400, outputTokens: 50 });
    expect(llm.mapUsage(undefined)).toEqual({ inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 });
  });
});
