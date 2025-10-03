// src/app/api/submissions/[id]/redo/route.ts
import { NextResponse } from "next/server";
import { withTx } from "@/lib/db";
import { extractFacts } from "@/domain/services/extract-facts";
import { classifyVisa } from "@/domain/services/classify-visa";
import { generateValidationQuestions } from "@/domain/services/generate-questions";

type Step = "facts" | "classify" | "questions";

function downstreamOf(step: Step): Step[] {
  if (step === "facts") return ["classify", "questions"];
  if (step === "classify") return ["questions"];
  return [];
}

type SubRow = {
  id: string;
  raw_text: string | null;
  extracted_facts: any | null;
  classification: any | null;
  followup_questions: { questions: string[] } | null;
  followup_answers: { answers: string[] } | null;
  final_decision: any | null;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const body = await req.json().catch(() => ({}));
  const step = body?.step as Step | undefined;

  if (!step || !["facts", "classify", "questions"].includes(step)) {
    return NextResponse.json(
      { error: "informe step: 'facts' | 'classify' | 'questions'" },
      { status: 400 }
    );
  }

  try {
    const submission = await withTx(async (client: any) => {
      // 1) Lock do submission
      const res = await client.query(
        `SELECT id, raw_text, extracted_facts, classification, followup_questions, followup_answers, final_decision
           FROM submissions
          WHERE id = $1
          FOR UPDATE`,
        [id]
      );
      if (res.rowCount === 0) throw new Error("submission não encontrado");
      const sub: SubRow = res.rows[0];

      // 2) Limpa dependentes + final_decision
      const toClear = downstreamOf(step);
      const clearCols: string[] = [`final_decision = NULL`];
      if (toClear.includes("classify")) clearCols.push(`classification = NULL`);
      if (toClear.includes("questions")) clearCols.push(`followup_questions = NULL`, `followup_answers = NULL`);

      if (clearCols.length) {
        await client.query(
          `UPDATE submissions
              SET ${clearCols.join(", ")},
                  updated_at = NOW()
            WHERE id = $1`,
          [id]
        );
      }

      // 3) Refaz o passo
      if (step === "facts") {
        const raw = sub.raw_text ?? "";
        const facts = await extractFacts({ personal: {}, purpose: "", raw_text: raw } as any);
        await client.query(
          `UPDATE submissions
              SET extracted_facts = $2::jsonb,
                  updated_at      = NOW()
            WHERE id = $1`,
          [id, JSON.stringify(facts)]
        );
      }

      if (step === "classify") {
        const currentFacts =
          sub.extracted_facts ??
          (await client.query(`SELECT extracted_facts FROM submissions WHERE id=$1`, [id])).rows[0]?.extracted_facts;

        if (!currentFacts) throw new Error("extracted_facts ausente — refaça 'facts' primeiro.");

        const classification = await classifyVisa(currentFacts);
        await client.query(
          `UPDATE submissions
              SET classification = $2::jsonb,
                  updated_at     = NOW()
            WHERE id = $1`,
          [id, JSON.stringify(classification)]
        );
      }

      if (step === "questions") {
        const latest = await client.query(
          `SELECT extracted_facts, classification FROM submissions WHERE id=$1`,
          [id]
        );
        const facts = latest.rows[0]?.extracted_facts;
        const classification = latest.rows[0]?.classification;

        if (!facts) throw new Error("extracted_facts ausente — refaça 'facts' primeiro.");
        if (!classification) throw new Error("classification ausente — refaça 'classify' primeiro.");

        const rawQs: any = await generateValidationQuestions(facts, classification);
        const list: string[] = Array.isArray(rawQs)
          ? rawQs
          : Array.isArray(rawQs?.questions)
          ? rawQs.questions
          : [];

        if (list.length === 0) throw new Error("não foi possível gerar perguntas");

        const payload = { questions: list };
        await client.query(
          `UPDATE submissions
              SET followup_questions = $2::jsonb,
                  followup_answers   = NULL,
                  updated_at         = NOW()
            WHERE id = $1`,
          [id, JSON.stringify(payload)]
        );
      }

      // 4) Retorna o submission atualizado
      const final = await client.query(
        `SELECT id, raw_text, extracted_facts, classification, followup_questions, followup_answers, final_decision
           FROM submissions
          WHERE id = $1`,
        [id]
      );

      return final.rows[0] as SubRow;
    });

    return NextResponse.json({ ok: true, submission });
  } catch (e: any) {
    console.error("redo error", e);
    const message = e?.message || "erro interno";
    const status = /não encontrado|ausente|primeiro|gerar perguntas/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
