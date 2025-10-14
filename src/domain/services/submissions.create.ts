// src/domain/services/submissions.create.ts
"use server";

import { query } from "@/lib/db";

/** Allowed columns that can be returned to callers (whitelist). */
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
  const defaults: Column[] = ["id", "user_id", "raw_text", "status", "created_at", "updated_at"];
  const cols = (columns ?? defaults) as string[];
  const picked = cols.filter((c) => SAFE_COLUMNS.has(c as Column));
  return picked.length ? picked.join(", ") : defaults.join(", ");
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** ID generator (16 chars) that works in Node and Edge without external deps. */
function makeId(len = 16): string {
  const g: any = globalThis as any;
  if (g.crypto?.getRandomValues) {
    const bytes = new Uint8Array(len);
    g.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export type CreateSubmissionOptions = {
  /** Override ID (rare). If not provided, we generate one. */
  id?: string;
  /** Initial status (defaults to 'INTAKE'). */
  status?: string;
  /** Minimum characters required in raw_text (default 20). */
  minTextLen?: number;
  /** Allow empty/short text (skip min length check). Default false. */
  allowEmptyText?: boolean;
  /** Columns to RETURN from INSERT. Default safe set includes raw_text. */
  columns?: Column[] | "all";
};

/**
 * Create a submission row. Returns only the requested columns.
 * - Validates/sanitizes `raw_text`
 * - Uses a column whitelist for the RETURNING clause
 * - Returns the inserted row (not just the id)
 */
export async function createSubmission(
  userId: string,
  rawText?: string | null,
  opts?: CreateSubmissionOptions
) {
  if (!userId || typeof userId !== "string") {
    throw new Error("createSubmission: userId is required.");
  }

  // Normalize and validate text
  const text =
    typeof rawText === "string"
      ? rawText.replace(/\r\n/g, "\n").trim()
      : null;

  const minLen = Math.max(0, opts?.minTextLen ?? 20);
  if (!opts?.allowEmptyText) {
    const len = (text ?? "").length;
    if (len < minLen) {
      throw new Error(
        `createSubmission: raw_text too short (got ${len}, need >= ${minLen}).`
      );
    }
  }

  const id = (opts?.id && String(opts.id)) || makeId();
  const status = opts?.status ?? "INTAKE";
  const select = buildSelect(opts?.columns);

  // Use RETURNING to get only the columns you want
  const rows = await query<{ [k: string]: any }>(
    `INSERT INTO submissions (id, user_id, raw_text, status)
     VALUES ($1, $2, $3, $4)
     RETURNING ${select}`,
    [id, userId, text ?? null, status]
  );

  // Fallback to an object with id if DB doesn't return anything (shouldn't happen on Postgres)
  return rows[0] ?? { id };
}
