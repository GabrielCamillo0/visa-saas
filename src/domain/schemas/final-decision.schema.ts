// src/domain/schemas/final-decision.schema.ts
import { z } from "zod";

const TopVisaSchema = z.object({
  visa: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

const ActionStepSchema = z.union([
  z.string(),
  z.object({ step: z.string(), url: z.string().url().optional() }),
]);

const PathStepSchema = z.union([
  z.string(),
  z.object({ step: z.string(), url: z.string().url().optional() }),
]);

/** Quando a pessoa não se enquadra em nenhum visto (confiança < 40%), o caminho para se qualificar. */
export const PathToQualifySchema = z.object({
  summary: z.string(),
  steps: z.array(PathStepSchema),
});

/**
 * Decisão final sobre o visto do candidato.
 * Se qualifies_for_visa === false (ex.: confiança melhor visto < 40%), não aponta visto e traz path_to_qualify.
 */
export const FinalDecisionSchema = z.object({
  selected_visa: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
  /** Se false, não sugerir nenhum visto; exibir path_to_qualify (ex.: quando confiança < 40%). */
  qualifies_for_visa: z.boolean().optional(),
  /** Caminho elaborado para a pessoa se qualificar a um visto (quando qualifies_for_visa === false). */
  path_to_qualify: PathToQualifySchema.optional(),
  /** Os 2 vistos com mais confiança (só quando qualifies_for_visa !== false). */
  top_visas: z.array(TopVisaSchema).max(2).optional(),
  alternatives: z.array(z.string()).optional(),
  /** Cada item pode ser string ou { step, url? }. Vazio quando qualifies_for_visa === false. */
  action_plan: z.array(ActionStepSchema),
  documents_checklist: z.array(z.string()),
  risks_and_flags: z.array(z.string()).optional(),
  suggested_timeline: z.string().optional(),
  costs_note: z.string().optional(),
});

export type FinalDecision = z.infer<typeof FinalDecisionSchema>;
export type ActionStep = z.infer<typeof ActionStepSchema>;
export type PathToQualify = z.infer<typeof PathToQualifySchema>;

// ❌ REMOVIDO: Zod não tem `.toJSON()`
// export const FinalDecisionJSONSchema = FinalDecisionSchema.toJSON();
