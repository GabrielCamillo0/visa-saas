import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generateValidationQuestions } from "@/domain/services/generate-questions";

type Row = {
  extracted_facts: any | null;
  classification: any | null;
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    // 1) Carrega pré-requisitos
    const rows = await query<Row>(
      `SELECT extracted_facts, classification FROM submissions WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }
    const facts = rows[0].extracted_facts;
    const classification = rows[0].classification;
    if (!facts || !classification) {
      return NextResponse.json(
        { error: "missing_prerequisites", details: ["extracted_facts", "classification"] },
        { status: 400 }
      );
    }

    // 2) Gera perguntas (tolerante ao formato)
    const raw = (await generateValidationQuestions(facts, classification)) as
      | string[]
      | { questions?: unknown };

    const questions: string[] = Array.isArray(raw)
      ? raw.filter((x) => typeof x === "string" && x.trim().length > 0)
      : Array.isArray(raw?.questions)
      ? (raw.questions as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0
        )
      : [];

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error: "invalid_questions_payload",
          message:
            "A IA não retornou perguntas válidas. Tente novamente ou ajuste o prompt/serviço.",
        },
        { status: 422 }
      );
    }

    const payload = { questions };

    // 3) Persiste e zera respostas anteriores
    const updated = await query(
      `UPDATE submissions
          SET followup_questions = $2::jsonb,
              followup_answers   = NULL,
              updated_at         = NOW()
        WHERE id = $1
        RETURNING id, raw_text, extracted_facts, classification,
                  followup_questions, followup_answers, final_decision,
                  created_at, updated_at`,
      [id, JSON.stringify(payload)]
    );

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("questions POST error:", err);
    const msg = String(err?.message || "");
    // repassa pistas úteis quando for erro de upstream
    if (/quota|billing|insufficient|rate|429/i.test(msg)) {
      return NextResponse.json({ error: "upstream_openai_error", message: msg }, { status: 502 });
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
