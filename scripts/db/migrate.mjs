// Applies db/migrations/*.sql in order, once each. Safe to run on every start.
//   DATABASE_URL=postgres://... node scripts/db/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../db/migrations");

export async function migrate(client, log = console.log) {
  await client.query("select pg_advisory_lock(727001)");
  try {
    await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        log(`migrated ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(727001)");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set; skipping migrations (local mode).");
  } else {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption(process.env.DATABASE_URL) });
    await client.connect();
    try {
      await migrate(client);
      console.log("database is up to date");
    } finally {
      await client.end();
    }
  }
}

/** Render's internal URLs (no domain) don't use SSL; external URLs need it. */
export function sslOption(url) {
  if (process.env.DATABASE_SSL === "false") return false;
  const host = new URL(url).hostname;
  return host.includes(".") && host !== "127.0.0.1" ? { rejectUnauthorized: false } : false;
}
