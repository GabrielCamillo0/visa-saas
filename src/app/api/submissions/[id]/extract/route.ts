// src/app/api/submissions/[id]/extract/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractFacts } from "@/domain/services/extract-facts";

// Tune these if you want
const MIN_TEXT_LEN = Number(process.env.EXTRACT_MIN_TEXT_LEN ?? 20);
const RETURNING_COLUMNS = `
  id, raw_text, extracted_facts, classification, followup_questions,
  followup_answers, final_decision, status, created_at, updated_at
`;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    // 1) Load submission
    const rows = await query<{ id: string; raw_text: string | null }>(
      `SELECT id, raw_text FROM submissions WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    const raw = (rows[0].raw_text ?? "").replace(/\r\n/g, "\n").trim();
    if (raw.length < MIN_TEXT_LEN) {
      // Helpful log for debugging
      console.warn("[extractFacts] Rejected: raw_text too short.", {
        len: raw.length,
        sample: raw.slice(0, 80),
      });
      return NextResponse.json(
        {
          error: "raw_text_too_short",
          message: `Submission text is too short for extraction (got ${raw.length}, need >= ${MIN_TEXT_LEN}).`,
        },
        { status: 400 }
      );
    }

    // 2) Call the extractor
    let facts: unknown;

    try {
      // New signature (preferred): extractFacts(rawText: string)
      facts = await (extractFacts as unknown as (t: string) => Promise<unknown>)(raw);
    } catch {
      // Backward-compat: some versions accepted an object payload
      // @ts-expect-error legacy compat
      facts = await extractFacts({ raw_text: raw });
    }

    if (facts == null || typeof facts !== "object") {
      return NextResponse.json(
        {
          error: "invalid_facts_payload",
          message: "Extractor returned an empty or non-object payload.",
        },
        { status: 422 }
      );
    }

    // 3) Persist and return updated submission
    const updated = await query(
      `UPDATE submissions
         SET extracted_facts = $2::jsonb,
             updated_at      = NOW()
       WHERE id = $1
       RETURNING ${RETURNING_COLUMNS}`,
      [id, JSON.stringify(facts)]
    );

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("extract POST error:", err);

    // Surface upstream OpenAI-ish problems as 502
    const msg = String(err?.message || "");
    if (/quota|billing|insufficient|rate.?limit|429/i.test(msg)) {
      return NextResponse.json(
        { error: "upstream_openai_error", message: msg },
        { status: 502 }
      );
    }

    // Explicit extractor validation errors (your service may throw these)
    if (/INVALID_JSON|VALIDATION_ERROR/i.test(err?.code ?? "")) {
      return NextResponse.json(
        { error: "extract_validation_error", message: msg },
        { status: 422 }
      );
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
