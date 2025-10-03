// src/lib/normalize.ts
export function extractQuestions(input: unknown): string[] {
    if (Array.isArray(input)) {
      return input.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    }
    const q = (input as any)?.questions;
    if (Array.isArray(q)) {
      return q.filter((s: unknown): s is string => typeof s === "string" && String(s).trim().length > 0);
    }
    return [];
  }
  