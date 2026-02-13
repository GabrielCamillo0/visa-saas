// src/app/api/submissions/[id]/finalize/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { finalizeDecision } from "@/domain/services/finalize-decision";
import { FinalDecisionSchema } from "@/domain/schemas/final-decision.schema";

type Row = {
  id: string;
  extracted_facts: any | null;                     // JSONB
  classification: any | null;                      // JSONB
  followup_answers: { answers: string[] } | null;  // JSONB { answers: string[] }
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Busca os dados necessários (apenas do dono)
    const rows = await query<Row>(
      `SELECT id, extracted_facts, classification, followup_answers
         FROM submissions
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [id, userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    const sub = rows[0];

    // 2) Valida pré-requisitos
    const missing: string[] = [];
    if (!sub.extracted_facts) missing.push("extracted_facts");
    if (!sub.classification) missing.push("classification");
    if (!sub.followup_answers?.answers?.length) missing.push("followup_answers");
    if (missing.length) {
      return NextResponse.json(
        { error: `missing_prerequisites: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Narrowing explícito p/ TypeScript (agora garante que não é null)
    const answersPayload = sub.followup_answers as NonNullable<Row["followup_answers"]>;

    // 3) Mescla fatos + classificação e chama a IA
    const mergedFacts = { ...sub.extracted_facts, classification: sub.classification };
    const decision = await finalizeDecision(mergedFacts, answersPayload);

    // 4) Valida o payload de saída (defensivo)
    const parsed = FinalDecisionSchema.safeParse(decision);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "schema_validation_failed", details: parsed.error.format() },
        { status: 422 }
      );
    }

    // 5) Persiste como JSONB e retorna o registro atualizado (só atualiza se for do dono)
    const updated = await query(
      `UPDATE submissions
          SET final_decision = $2::jsonb,
              updated_at     = NOW()
        WHERE id = $1 AND user_id = $3
      RETURNING *`,
      [id, JSON.stringify(parsed.data), userId]
    );

    return NextResponse.json(updated[0]);
  } catch (err) {
    console.error("finalize POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
