// src/domain/services/finalize-decision.ts
import { callJSON } from "@/lib/openai";
import { FinalDecisionSchema, type FinalDecision } from "@/domain/schemas/final-decision.schema";

export async function finalizeDecision(
  facts: Record<string, unknown>,
  answers: { answers: string[] } | string[] | null | undefined,
  classification?: unknown
): Promise<FinalDecision> {
  const system = [
    "Com base nos fatos, nas respostas do usuário e na classificação de vistos:",
    "Responda APENAS em JSON válido no formato:",
    "{",
    '  "selected_visa": string,',
    '  "confidence": number,',
    '  "rationale"?: string,',
    '  "alternatives"?: string[],',
    '  "action_plan": string[],',
    '  "documents_checklist": string[],',
    '  "risks_and_flags"?: string[],',
    '  "suggested_timeline"?: string,',
    '  "costs_note"?: string',
    "}",
    "Certifique-se de que o visto selecionado esteja coerente com os fatos.",
  ].join("\n");

  const normalizedAnswers =
    Array.isArray((answers as any)?.answers) ? (answers as any).answers
    : Array.isArray(answers) ? answers
    : [];

  const user = {
    extracted_facts: facts,
    answers: normalizedAnswers,
    classification,
  };

  const raw = await callJSON<unknown>({
    system,
    user,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
  });

  return FinalDecisionSchema.parse(raw ?? {});
}
