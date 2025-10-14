// src/domain/services/submissions.get.ts
import { query } from "@/lib/db";

/** Columns we allow callers to request explicitly (whitelist). */
const SAFE_COLUMNS = new Set([
  "id",
  "user_id",
  "raw_text",
  "facts_json",
  "candidates_json",
  "final_json",
  "status",
  "created_at",
  "updated_at",
]);

type Column = typeof SAFE_COLUMNS extends Set<infer T> ? T : never;

function buildSelect(columns?: Column[] | "all"): string {
  if (columns === "all") return "*";
  const cols = (columns ?? [
    // sensible default projection (includes raw_text for extraction)
    "id",
    "user_id",
    "raw_text",
    "status",
    "created_at",
    "updated_at",
  ]) as string[];

  const picked = cols.filter((c) => SAFE_COLUMNS.has(c as Column));
  return picked.length ? picked.join(", ") : "id, user_id, raw_text, status, created_at, updated_at";
}

/**
 * Fetch a single submission by id.
 * @param id Submission ID
 * @param opts.columns Allowed list of columns to return (or "all"). Defaults include `raw_text`.
 */
export async function getSubmission(
  id: string,
  opts?: { columns?: Column[] | "all" }
) {
  const select = buildSelect(opts?.columns);
  const rows = await query<{ [k: string]: any }>(
    `SELECT ${select} FROM submissions WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * List submissions for a user (paginated).
 * @param userId Owner user id
 * @param opts.limit Max rows (default 50, capped at 200)
 * @param opts.offset Offset for pagination (default 0)
 * @param opts.columns Allowed list of columns to return (or "all"). Defaults include `raw_text`.
 */
export async function listSubmissions(
  userId: string,
  opts?: { limit?: number; offset?: number; columns?: Column[] | "all" }
) {
  const limit = Math.min(Math.max(1, opts?.limit ?? 50), 200);
  const offset = Math.max(0, opts?.offset ?? 0);
  const select = buildSelect(opts?.columns);

  return query<{ [k: string]: any }>(
    `SELECT ${select}
       FROM submissions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
}
