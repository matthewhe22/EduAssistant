import type { Db } from "../db";
import type { FormSettings } from "../library/settings";

export interface TemplateRow {
  id: string;
  name: string;
  settings: unknown;
  created_at: string | Date;
}

export async function listTemplates(db: Db, userId: string) {
  const { rows } = await db.query<TemplateRow>("select id, name, settings, created_at from templates where user_id = $1 order by name", [userId]);
  return rows;
}

export async function createTemplate(db: Db, userId: string, name: string, settings: FormSettings) {
  const { rows } = await db.query<TemplateRow>(
    "insert into templates (user_id, name, settings) values ($1, $2, $3) returning id, name, settings, created_at",
    [userId, name, JSON.stringify(settings)],
  );
  return rows[0];
}

export async function deleteTemplate(db: Db, userId: string, id: string) {
  const { rows } = await db.query("delete from templates where id = $2 and user_id = $1 returning id", [userId, id]);
  return rows.length > 0;
}
