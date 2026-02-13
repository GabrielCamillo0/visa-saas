// src/app/api/submissions/[id]/classify/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { classifyVisa } from "@/domain/services/classify-visa";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Busca submission e os fatos extraídos (apenas do dono)
    const rows = await query(
      `SELECT id, extracted_facts
         FROM submissions
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [id, userId]
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

    // 3) Persiste resultado como JSONB (só atualiza se for do dono)
    await query(
      `UPDATE submissions
          SET classification = $2::jsonb,
              updated_at     = NOW()
        WHERE id = $1 AND user_id = $3`,
      [id, JSON.stringify(classification), userId]
    );

    // 4) Retorna o registro atualizado
    const updated = await query(`SELECT * FROM submissions WHERE id = $1 AND user_id = $2`, [id, userId]);
    return NextResponse.json(updated[0]);
  } catch (err: any) {
    console.error("classify POST error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
