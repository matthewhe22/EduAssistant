import type { Db } from "../db";
import type { OutputType } from "../generator/outputs";

export interface NewGeneration {
  title: string;
  level: string;
  subjectSlug: string;
  outputType: OutputType;
  difficulty: string;
  teacherInput: unknown;
  curriculumCodes: string[];
  content: unknown;
  model: string;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function insertGeneration(db: Db, userId: string, g: NewGeneration): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into generations (user_id, title, level, subject_slug, output_type, difficulty, teacher_input, curriculum_codes,
       content, model, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, cost_usd)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
    [
      userId, g.title, g.level, g.subjectSlug, g.outputType, g.difficulty, JSON.stringify(g.teacherInput), g.curriculumCodes,
      JSON.stringify(g.content), g.model, g.inputTokens, g.cacheWriteTokens, g.cacheReadTokens, g.outputTokens, g.costUsd,
    ],
  );
  return rows[0].id;
}

/** Keep at most this many earlier versions per item. */
export const MAX_VERSIONS = 20;

/**
 * Replaces an item's content. Unless `snapshot` is false, the current content is saved
 * to generation_versions first so the change can be undone.
 */
export async function updateGenerationContent(
  db: Db,
  userId: string,
  id: string,
  title: string,
  content: unknown,
  opts: { snapshot?: boolean; note?: string } = {},
) {
  if (opts.snapshot !== false) {
    await db.query(
      `insert into generation_versions (generation_id, user_id, title, content, note)
       select id, user_id, title, content, $3 from generations where id = $2 and user_id = $1`,
      [userId, id, opts.note ?? null],
    );
    await db.query(
      `delete from generation_versions where generation_id = $2 and user_id = $1 and id not in (
         select id from generation_versions where generation_id = $2 and user_id = $1 order by created_at desc, id desc limit ${MAX_VERSIONS})`,
      [userId, id],
    );
  }
  const { rows } = await db.query<{ id: string }>(
    "update generations set title = $3, content = $4, updated_at = now() where id = $2 and user_id = $1 returning id",
    [userId, id, title, JSON.stringify(content)],
  );
  return rows[0]?.id ?? null;
}

export async function countVersions(db: Db, userId: string, id: string) {
  const { rows } = await db.query<{ n: number }>(
    "select count(*)::int as n from generation_versions where generation_id = $2 and user_id = $1",
    [userId, id],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Restores the most recent saved version and removes it from the history.
 * Returns the restored content and how many earlier versions remain, or null if there is none.
 */
export async function undoLastChange(db: Db, userId: string, id: string) {
  const { rows } = await db.query<{ vid: string; title: string; content: Record<string, unknown> }>(
    `select id as vid, title, content from generation_versions where generation_id = $2 and user_id = $1
     order by created_at desc, id desc limit 1`,
    [userId, id],
  );
  const v = rows[0];
  if (!v) return null;
  await updateGenerationContent(db, userId, id, v.title, v.content, { snapshot: false });
  await db.query("delete from generation_versions where id = $1", [v.vid]);
  return { title: v.title, content: v.content, remaining: await countVersions(db, userId, id) };
}

export interface GenerationRow {
  id: string;
  title: string;
  output_type: string;
  level: string;
  subject_slug: string;
  difficulty: string;
  teacher_input: Record<string, unknown> | null;
  content: Record<string, unknown> | null;
  rating: number | null;
  feedback_comment: string | null;
  created_at: string | Date;
}

export async function getGeneration(db: Db, userId: string, id: string): Promise<GenerationRow | null> {
  const { rows } = await db.query<GenerationRow>(
    `select id, title, output_type, level, subject_slug, difficulty, teacher_input, content, rating, feedback_comment, created_at
     from generations where id = $2 and user_id = $1`,
    [userId, id],
  );
  return rows[0] ?? null;
}

export interface LibraryFilters {
  q?: string;
  outputType?: string;
  subjectSlug?: string;
  level?: string;
  rating?: "up" | "down" | "none";
}

/** Escapes LIKE wildcards so search text is matched literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listGenerations(db: Db, userId: string, f: LibraryFilters, limit: number, offset: number) {
  const where = ["user_id = $1"];
  const params: unknown[] = [userId];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (f.q) add("(title ilike ? or teacher_input->>'idea' ilike ?)", likePattern(f.q));
  if (f.outputType) add("output_type = ?::output_type", f.outputType);
  if (f.subjectSlug) add("subject_slug = ?", f.subjectSlug);
  if (f.level) add("level = ?", f.level);
  if (f.rating === "up") where.push("rating = 1");
  if (f.rating === "down") where.push("rating = -1");
  if (f.rating === "none") where.push("rating is null");
  const clause = where.join(" and ");
  const [items, total] = await Promise.all([
    db.query<{ id: string; title: string; output_type: string; level: string; subject_slug: string; rating: number | null; created_at: string | Date }>(
      `select id, title, output_type, level, subject_slug, rating, created_at from generations where ${clause}
       order by created_at desc limit ${Number(limit)} offset ${Number(offset)}`,
      params,
    ),
    db.query<{ n: number }>(`select count(*)::int as n from generations where ${clause}`, params),
  ]);
  return { items: items.rows, count: total.rows[0].n };
}

export async function deleteGeneration(db: Db, userId: string, id: string) {
  const { rows } = await db.query("delete from generations where id = $2 and user_id = $1 returning id", [userId, id]);
  return rows.length > 0;
}

export async function setFeedback(db: Db, userId: string, id: string, rating: 1 | -1 | null, comment: string) {
  const { rows } = await db.query(
    `update generations set rating = $3, feedback_comment = $4, rated_at = case when $3::smallint is null then null else now() end
     where id = $2 and user_id = $1 returning id`,
    [userId, id, rating, comment || null],
  );
  return rows.length > 0;
}

export async function ratingsByType(db: Db, userId: string) {
  const { rows } = await db.query<{ output_type: string; rating: number | null }>(
    "select output_type, rating from generations where user_id = $1",
    [userId],
  );
  return rows;
}

export async function recentComments(db: Db, userId: string, limit = 15) {
  const { rows } = await db.query<{ id: string; title: string; output_type: string; rating: number | null; feedback_comment: string }>(
    `select id, title, output_type, rating, feedback_comment from generations
     where user_id = $1 and feedback_comment is not null order by rated_at desc nulls last limit ${Number(limit)}`,
    [userId],
  );
  return rows;
}
