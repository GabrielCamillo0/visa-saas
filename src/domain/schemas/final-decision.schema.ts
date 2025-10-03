// src/domain/schemas/final-decision.schema.ts
import { z } from "zod";

/**
 * Decisão final sobre o visto do candidato.
 * Inclui visto sugerido, confiança, plano de ação e observações.
 */
export const FinalDecisionSchema = z.object({
  selected_visa: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  action_plan: z.array(z.string()),
  documents_checklist: z.array(z.string()),
  risks_and_flags: z.array(z.string()).optional(),
  suggested_timeline: z.string().optional(),
  costs_note: z.string().optional(),
});

export type FinalDecision = z.infer<typeof FinalDecisionSchema>;

// ❌ REMOVIDO: Zod não tem `.toJSON()`
// export const FinalDecisionJSONSchema = FinalDecisionSchema.toJSON();
