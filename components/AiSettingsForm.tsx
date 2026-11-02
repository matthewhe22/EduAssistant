"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ModelOption } from "@/lib/ai/models";
import { Notice } from "./Page";

export function AiSettingsForm({
  keyHint,
  keySource,
  model,
  models,
  canStoreKeys,
}: {
  keyHint: string | null;
  keySource: "user" | "server" | "none";
  model: string;
  models: ModelOption[];
  canStoreKeys: boolean;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [selected, setSelected] = useState(model);
  const [busy, setBusy] = useState<"key" | "model" | "remove" | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const options = models.some((m) => m.id === selected) ? models : [{ id: selected, label: selected }, ...models];

  async function save(body: Record<string, unknown>, which: "key" | "model" | "remove", ok: string) {
    setBusy(which);
    setMsg(null);
    const res = await fetch("/api/ai-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setMsg({ tone: "error", text: data.error ?? "Couldn't save. Please try again." });
      return;
    }
    setMsg({ tone: "info", text: [ok, ...(data.notes ?? [])].join(" ") });
    setApiKey("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ apiKey }, "key", "Key saved.");
        }}
      >
        <label className="label" htmlFor="tenon-key">Tenon API key</label>
        <p className="m-0 text-[15px] text-ink-soft">
          {keySource === "user" && <>Using your key <span className="font-mono">{keyHint}</span>.</>}
          {keySource === "server" && "Using the site's shared key. Add your own to use your Tenon balance."}
          {keySource === "none" && "No key yet. Create one at mytenon.com → API keys (it starts with sk-tx-)."}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="tenon-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySource === "user" ? "Paste a new key to replace it" : "sk-tx-…"}
            className="field flex-[1_1_280px] font-mono"
            disabled={!canStoreKeys}
          />
          <button className="btn-primary" disabled={!canStoreKeys || apiKey.trim().length < 8 || busy !== null}>
            {busy === "key" ? "Checking…" : "Save key"}
          </button>
          {keySource === "user" && (
            <button type="button" className="btn-outline" disabled={busy !== null} onClick={() => save({ removeKey: true }, "remove", "Key removed.")}>
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
        <p className="m-0 text-sm text-ink-muted">
          {canStoreKeys
            ? "Stored encrypted. It's checked with Tenon before saving and never shown again in full."
            : "Saving keys is turned off until the site owner sets SETTINGS_SECRET on the server."}
        </p>
      </form>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save({ model: selected }, "model", "Default model saved.");
        }}
      >
        <label className="label" htmlFor="default-model">Default model</label>
        <div className="flex flex-wrap gap-2">
          <select id="default-model" value={selected} onChange={(e) => setSelected(e.target.value)} className="field flex-[1_1_280px] font-normal">
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.note ? ` — ${m.note}` : ""}
              </option>
            ))}
          </select>
          <button className="btn-outline" disabled={selected === model || busy !== null}>
            {busy === "model" ? "Saving…" : "Use this model"}
          </button>
        </div>
        <p className="m-0 text-sm text-ink-muted">Used for everything you create. Prices are on mytenon.com/pricing.</p>
      </form>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}
