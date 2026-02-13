import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { finalizeDecision } from "@/domain/services/finalize-decision";
import { FinalDecisionSchema } from "@/domain/schemas/final-decision.schema";

// Body: { answers: string[] }
const Body = z.object({
  answers: z.array(z.string()).min(1).max(50),
});

// Normaliza formatos possíveis de followup_questions no DB
function extractQuestions(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  }
  const q = (input as any)?.questions;
  if (Array.isArray(q)) {
    return q.filter((s: unknown): s is string => typeof s === "string" && String(s).trim().length > 0);
  }
  return [];
}

type SubRow = {
  id: string;
  extracted_facts: any | null;
  classification: any | null;
  followup_answers: { answers: string[] } | null;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Busca perguntas atuais (apenas do dono)
    const rows = await query<{ followup_questions: unknown }>(
      `SELECT followup_questions FROM submissions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    const questions = extractQuestions(rows[0].followup_questions);
    if (questions.length === 0) {
      return NextResponse.json({ error: "no_questions" }, { status: 400 });
    }

    // Normaliza respostas: string, trim, sem vazias
    const normalized = parsed.data.answers.map((s) => (s ?? "").toString().trim());

    if (normalized.length !== questions.length) {
      return NextResponse.json(
        { error: "answers_count_mismatch", expected: questions.length, received: normalized.length },
        { status: 422 }
      );
    }
    if (normalized.some((s) => s.length === 0)) {
      return NextResponse.json(
        { error: "empty_answer", message: "Todas as respostas precisam ser preenchidas." },
        { status: 422 }
      );
    }

    // 1) Persiste respostas
    await query(
      `UPDATE submissions
          SET followup_answers = $2::jsonb,
              updated_at       = NOW()
        WHERE id = $1 AND user_id = $3`,
      [id, JSON.stringify({ answers: normalized }), userId]
    );

    // 2) Dispara decisão final automaticamente (mesmos pré-requisitos do POST /finalize)
    const subRows = await query<SubRow>(
      `SELECT id, extracted_facts, classification, followup_answers
         FROM submissions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, userId]
    );
    const sub = subRows[0];
    if (
      sub?.extracted_facts &&
      sub?.classification &&
      sub?.followup_answers?.answers?.length
    ) {
      const mergedFacts = { ...sub.extracted_facts, classification: sub.classification };
      const decision = await finalizeDecision(mergedFacts, sub.followup_answers, sub.classification);
      const validated = FinalDecisionSchema.safeParse(decision);
      if (validated.success) {
        await query(
          `UPDATE submissions SET final_decision = $2::jsonb, updated_at = NOW()
             WHERE id = $1 AND user_id = $3`,
          [id, JSON.stringify(validated.data), userId]
        );
      }
    }

    const updated = await query(
      `SELECT id, followup_answers, final_decision FROM submissions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return NextResponse.json(updated[0] ?? { ok: true });
  } catch (e: any) {
    console.error("answers POST error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
