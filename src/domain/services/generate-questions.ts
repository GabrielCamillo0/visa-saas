// src/domain/services/generate-questions.ts
import { callJSON, AIError } from "@/lib/openai";
import { z } from "zod";
import { ValidationQuestionsSchema } from "@/domain/schemas/validation-questions.schema";
import type { ExtractFacts } from "@/domain/schemas/extract-facts.schema";
import type { VisaCandidates } from "@/domain/schemas/visa-candidates.schema";

/**
 * Zod estrito para a saída final deste serviço (sempre string[], 3–10).
 * Usamos além do ValidationQuestionsSchema para reforçar as invariantes.
 */
const OutSchema = z
  .array(z.string().min(3))
  .min(3, "Precisamos de pelo menos 3 perguntas")
  .max(10, "No máximo 10 perguntas");

/**
 * Gera de 3 a 10 perguntas objetivas para validar o enquadramento do visto.
 * - NUNCA usa fallback “padrão” silencioso.
 * - Se a IA falhar/retornar inválido, lança erro (422/500 na rota).
 */
export async function generateValidationQuestions(
  facts: ExtractFacts,
  classification: VisaCandidates
): Promise<string[]> {
  const system = [
    "Você é um assistente de imigração do consolado e voce ira formula perguntas de validação para confirmar o tipo de visto dos EUA que a pessoa se enquadra.",
    "Responda APENAS em JSON válido (um único objeto).",
    'Formato EXATO: { "questions": [string, ...] } — entre 3 e 10 perguntas.',
    "Regras:",
    "- Elimine ambiguidade e confirme requisitos do visto selecionado.",
    "- Perguntas curtas e objetivas (uma por item, sem múltiplas perguntas no mesmo item).",
    "- Evite pedir documentos; foque em FATOS (duração, funding, vínculos, admissão, histórico de entradas, etc.).",
    "- Não inclua comentários fora do JSON. Não inclua chaves extras.",
  ].join("\n");

  // Sanitiza payload p/ reduzir ruído (remove campos vazios/undefined)
  const user = {
    extracted_facts: pruneShallow(facts),
    classification: pruneShallow(classification),
    guidance:
      "Gere de 3 a 10 perguntas objetivas para validar o enquadramento. Retorne somente o JSON no formato especificado.",
  };

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  // 1ª tentativa
  try {
    const raw = await callJSON<unknown>({
      system,
      user,
      model,
      temperature: 0.2,
    });
    return coerceAndValidate(raw);
  } catch (err) {
    // Se foi erro de quota, propaga como AIError (para 429/5xx na rota)
    if (err instanceof AIError && err.code === "INSUFFICIENT_QUOTA") throw err;

    // Retry único com ajustes leves (temperatura/modelo)
    try {
      const raw2 = await callJSON<unknown>({
        system,
        user,
        model: model === "gpt-4o-mini" ? "gpt-4o" : model,
        temperature: 0.0,
      });
      return coerceAndValidate(raw2);
    } catch (err2) {
      // Consolida erro com contexto mínimo
      const reason =
        err2 instanceof AIError
          ? `${err2.code ?? "OPENAI_ERROR"}: ${err2.message}`
          : (err2 as Error)?.message ?? "Erro desconhecido ao gerar perguntas";
      throw new Error(
        `[generateValidationQuestions] Falha ao obter JSON válido do modelo. Motivo: ${reason}`
      );
    }
  }
}

/** Converte raw -> string[], normaliza/garante 3–10, caso contrário lança erro. */
function coerceAndValidate(raw: unknown): string[] {
  // Primeiro valida contra o schema de contrato da feature
  const parsed = ValidationQuestionsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new Error(
      `[generateValidationQuestions] JSON incompatível com schema ValidationQuestions: ${parsed.error.message}`
    );
  }

  // Normaliza perguntas
  const list = normalize(parsed.data.questions);

  // Aplica guard rail final 3–10
  const final = OutSchema.parse(list);
  return final;
}

/** Trim, remove duplicadas (case sensitive), filtra curtas e corta em 10. */
function normalize(arr: string[]): string[] {
  const cleaned = (arr ?? [])
    .map((q) => (q ?? "").toString().trim())
    .filter((q) => q.length >= 3);

  const seen = new Set<string>();
  const uniq = cleaned.filter((q) => (seen.has(q) ? false : (seen.add(q), true)));
  return uniq.slice(0, 10);
}

/** Remove chaves com undefined/null/"" em nível raso (evita ruído no prompt). */
function pruneShallow<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== "object") return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out as T;
}
