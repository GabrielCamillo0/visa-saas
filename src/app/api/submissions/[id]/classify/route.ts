// src/app/api/submissions/[id]/classify/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { classifyVisa } from "@/domain/services/classify-visa";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    // 1) Busca submission e os fatos extraídos
    const rows = await query(
      `SELECT id, extracted_facts
         FROM submissions
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }

    const extractedFacts = rows[0].extracted_facts;
    if (!extractedFacts) {
      return NextResponse.json({ error: "missing_extracted_facts" }, { status: 400 });
    }

    // 2) Classifica com o serviço de IA
    const classification = await classifyVisa(extractedFacts);

    // 3) Persiste resultado como JSONB
    await query(
      `UPDATE submissions
          SET classification = $2::jsonb,
              updated_at     = NOW()
        WHERE id = $1`,
      [id, JSON.stringify(classification)]
    );

    // 4) Retorna o registro atualizado
    const updated = await query(`SELECT * FROM submissions WHERE id=$1`, [id]);
    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("classify POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
