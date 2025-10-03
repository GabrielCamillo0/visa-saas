// src/app/api/submissions/[id]/extract/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractFacts } from "@/domain/services/extract-facts";

// Dica: sua extractFacts deve aceitar { raw_text: string }.
// Se ela ainda requer { personal, purpose }, mantemos compatibilidade abaixo.

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  try {
    // 1) Carrega o submission e checa raw_text
    const rows = await query<{ id: string; raw_text: string | null }>(
      `SELECT id, raw_text FROM submissions WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }
    const raw = rows[0].raw_text?.trim() ?? "";
    if (!raw) {
      return NextResponse.json(
        { error: "missing_raw_text", message: "O submission não possui raw_text para extrair." },
        { status: 400 }
      );
    }

    // 2) Chama a IA (compatível com duas assinaturas comuns)
    let facts: unknown;
    try {
      // tente assinatura moderna: { raw_text }
      facts = await extractFacts({ raw_text: raw } as any);
      // se vier algo claramente inválido, tenta assinatura antiga
      if (facts == null) {
        facts = await extractFacts({ personal: {}, purpose: "", raw_text: raw } as any);
      }
    } catch (_e) {
      // fallback: assinatura antiga
      facts = await extractFacts({ personal: {}, purpose: "", raw_text: raw } as any);
    }

    // Segurança básica: precisa ser objeto JSON serializável
    if (facts == null || typeof facts !== "object") {
      return NextResponse.json(
        { error: "invalid_facts_payload", message: "A resposta de extração veio vazia ou inválida." },
        { status: 422 }
      );
    }

    // 3) Persiste e retorna atualizado
    const updated = await query(
      `UPDATE submissions
         SET extracted_facts = $2::jsonb,
             updated_at      = NOW()
       WHERE id = $1
       RETURNING id, raw_text, extracted_facts, classification, followup_questions, followup_answers, final_decision, created_at, updated_at`,
      [id, JSON.stringify(facts)]
    );

    return NextResponse.json(updated[0]);
  } catch (err: any) {
    // Loga o erro completo no server para facilitar debug
    console.error("extract POST error:", err);
    // Erros de quota/keys da OpenAI geralmente são 401/429; devolvemos como 502/500 com pista
    const msg = String(err?.message || "");
    if (/quota|billing|insufficient|rate|429/i.test(msg)) {
      return NextResponse.json(
        { error: "upstream_openai_error", message: msg },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
