import "server-only";
import pg from "pg";

/** The subset of a Postgres client the app uses (pg.Pool in production, PGlite in tests). */
export interface Db {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

let pool: pg.Pool | null = null;
let override: Db | null = null;

/** For tests: use another client (e.g. PGlite) instead of DATABASE_URL. */
export function setDbForTesting(db: Db | null) {
  override = db;
}

function sslOption(url: string) {
  if (process.env.DATABASE_SSL === "false") return false;
  const host = new URL(url).hostname;
  return host.includes(".") && host !== "127.0.0.1" ? { rejectUnauthorized: false } : false;
}

/** Shared connection pool, or null in local mode (no DATABASE_URL). */
export function getDb(): Db | null {
  if (override) return override;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  pool ??= new pg.Pool({ connectionString: url, ssl: sslOption(url), max: 5 });
  return pool as unknown as Db;
}
