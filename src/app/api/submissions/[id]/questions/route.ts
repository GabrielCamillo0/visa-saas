// src/app/api/submissions/[id]/questions/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateValidationQuestions } from "@/domain/services/generate-questions";

type Row = {
  id: string;
  extracted_facts: any | null;
  classification: any | null;
  followup_questions: any | null;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Carrega dados necessários (apenas do dono)
    const rows = await query<Row>(
      `SELECT id, extracted_facts, classification, followup_questions
         FROM submissions
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [id, userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    const sub = rows[0];

    // Idempotência: se já temos perguntas, apenas retorne
    if (Array.isArray(sub.followup_questions) && sub.followup_questions.length > 0) {
      return NextResponse.json(sub);
    }

    // Pré-requisitos: facts + classification
    if (!sub.extracted_facts || !sub.classification) {
      return NextResponse.json(
        {
          error: "missing_prerequisites",
          details: ["extracted_facts", "classification"],
        },
        { status: 400 }
      );
    }

    // 2) Gera perguntas (tolerante ao formato do serviço)
    const raw = (await generateValidationQuestions(sub.extracted_facts, sub.classification)) as
      | string[]
      | { questions?: unknown };

    // Normalização para array<string>
    const list: string[] = Array.isArray(raw)
      ? raw
      : (Array.isArray(raw?.questions) ? raw.questions : []);

    const questions = Array.from(
      new Set(
        list
          .map((q) => (typeof q === "string" ? q.trim() : ""))
          .filter((q) => q.length > 0)
      )
    ).slice(0, 8); // máx 8 (qualidade > quantidade; serviço já retorna 5–10)

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error: "invalid_questions_payload",
          message: "A IA não retornou perguntas válidas. Tente novamente ou ajuste o prompt/serviço.",
        },
        { status: 422 }
      );
    }

    // 3) Persiste (array direto) e zera respostas anteriores (só atualiza se for do dono)
    const updated = await query(
      `UPDATE submissions
          SET followup_questions = $2::jsonb,
              followup_answers   = NULL,
              updated_at         = NOW()
        WHERE id = $1 AND user_id = $3
      RETURNING id, raw_text, extracted_facts, classification,
                followup_questions, followup_answers, final_decision,
                created_at, updated_at`,
      [id, JSON.stringify(questions), userId]
    );

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("questions POST error:", err);
    const msg = String(err?.message || "");

    // repassa pistas úteis quando for erro de upstream
    if (/quota|billing|insufficient|rate|429/i.test(msg)) {
      return NextResponse.json(
        { error: "upstream_openai_error", message: msg },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
