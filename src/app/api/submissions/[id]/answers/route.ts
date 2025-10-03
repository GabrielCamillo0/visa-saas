import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";

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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Busca perguntas atuais
    const rows = await query<{ followup_questions: unknown }>(
      `SELECT followup_questions FROM submissions WHERE id = $1`,
      [id]
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

    // Persiste como JSONB padronizado
    await query(
      `UPDATE submissions
          SET followup_answers = $2::jsonb,
              updated_at       = NOW()
        WHERE id = $1`,
      [id, JSON.stringify({ answers: normalized })]
    );

    const updated = await query(
      `SELECT id, followup_answers FROM submissions WHERE id = $1`,
      [id]
    );

    return NextResponse.json(updated[0] ?? { ok: true });
  } catch (e: any) {
    console.error("answers POST error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
