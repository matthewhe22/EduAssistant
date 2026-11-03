import { AiSettingsForm } from "@/components/AiSettingsForm";
import { Notice, Page } from "@/components/Page";
import { DEFAULT_MODEL } from "@/lib/ai/config";
import { labelFor, mergeModels } from "@/lib/ai/models";
import { pageUser } from "@/lib/auth/page";
import { canEncrypt } from "@/lib/crypto/secret";
import { getAiSettings } from "@/lib/data/settings";
import { listModelIds } from "@/lib/generator/llm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await pageUser("/settings");
  if (!auth) {
    return (
      <Page title="Settings">
        <Notice tone="info">Settings need a database. In local mode, set TENON_API_KEY and DEFAULT_MODEL on the server.</Notice>
      </Page>
    );
  }
  const settings = await getAiSettings(auth.db, auth.user.id);
  const activeKey = settings.apiKey ?? process.env.TENON_API_KEY ?? null;
  const keySource: "user" | "server" | "none" = settings.apiKey ? "user" : process.env.TENON_API_KEY ? "server" : "none";
  const model = settings.model || DEFAULT_MODEL;
  const liveModels = activeKey ? await listModelIds(activeKey) : null;

  return (
    <Page title="Settings">
      <div className="flex max-w-[760px] flex-col gap-8">
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="ai-heading">
          <div>
            <h2 id="ai-heading" className="m-0 text-2xl font-bold">AI provider</h2>
            <p className="m-0 mt-1 text-ink-soft">
              EduAssistant uses <a href="https://mytenon.com" target="_blank" rel="noreferrer">Tenon</a>, one key for many AI models. Now using{" "}
              <strong>{labelFor(model)}</strong>.
            </p>
          </div>
          <AiSettingsForm keyHint={settings.keyHint} keySource={keySource} model={model} models={mergeModels(liveModels)} canStoreKeys={canEncrypt()} />
        </section>
        <p className="m-0 text-[15px] text-ink-soft">
          Spending, your monthly budget and feedback are on the <a href="/usage">Usage</a> page.
        </p>
      </div>
    </Page>
  );
}
