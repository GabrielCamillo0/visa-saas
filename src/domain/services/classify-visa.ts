// src/domain/services/classify-visa.ts
import { callJSON, AIError } from "@/lib/openai";
import {
  VisaCandidatesSchema,
  type VisaCandidates,
} from "@/domain/schemas/visa-candidates.schema";
import type { ExtractFacts } from "@/domain/schemas/extract-facts.schema";

/**
 * Classifica os vistos a partir dos fatos extraídos.
 * - Força saída JSON válida (sem “consertar” resposta).
 * - Valida com Zod (se inválido, lança).
 * - Normaliza candidatos e garante `selected` consistente.
 * - Sem fallback silencioso: qualquer erro é lançado para a camada HTTP tratar.
 */
export async function classifyVisa(facts: ExtractFacts): Promise<VisaCandidates> {
  const system = [
    "Você é um sistema de classificação de vistos dos EUA.",
    "Responda APENAS em JSON válido, sem explicações nem texto extra.",
    "Formato do objeto:",
    "{",
    '  "candidates": [ { "visa": string, "confidence": number, "rationale": string? }, ... ],',
    '  "selected": string?',
    "}",
    "Regras:",
    "- 'confidence' deve estar entre 0 e 1.",
    "- 'selected' (se presente) DEVE ser um dos 'visa' listados em 'candidates'.",
    "- Não inclua comentários fora do JSON.",
  ].join("\n");

  const user = {
    extracted_facts: facts,
    goal: "Classificar os melhores tipos de visto para o caso, com justificativa e confiança.",
  };

  // Chamada direta: sem mock, sem fallback; validação via Zod
  const raw = await callJSON<VisaCandidates>({
    system,
    user,
    temperature: 0.2,
    // se quiser mais estabilidade entre execuções, pode ativar:
    // seed: 7,
    validate: (u) => VisaCandidatesSchema.parse(u),
  });

  // Normalização defensiva (bounds e unicidade)
  const cleaned = normalizeAndPick(raw);

  // Garantir que haja ao menos 1 candidato; se não, falhar explicitamente
  if (!cleaned.candidates || cleaned.candidates.length === 0) {
    throw new AIError("Modelo retornou zero candidatos de visto.", "NO_CANDIDATES");
  }

  return cleaned;
}

/** Normaliza confidences (0..1), remove duplicatas por `visa` e garante `selected` válido. */
function normalizeAndPick(data: VisaCandidates): VisaCandidates {
  // 1) sanitize lista
  const seen = new Set<string>();
  const candidates = (data.candidates ?? [])
    .filter((c) => c && typeof c.visa === "string" && c.visa.trim().length > 0)
    .map((c) => ({
      visa: c.visa.trim(),
      confidence: clamp01(typeof c.confidence === "number" ? c.confidence : 0),
      rationale: typeof c.rationale === "string" ? c.rationale.trim() : undefined,
    }))
    .filter((c) => {
      if (seen.has(c.visa)) return false;
      seen.add(c.visa);
      return true;
    });

  // 2) escolher selected coerente
  const selectedFromModel =
    typeof data.selected === "string" && candidates.some((c) => c.visa === data.selected)
      ? data.selected
      : undefined;

  const selected =
    selectedFromModel ??
    (candidates.length > 0
      ? [...candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0].visa
      : undefined);

  return { candidates, selected };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
