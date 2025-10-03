// src/domain/schemas/validation-questions.schema.ts
import { z } from "zod";

/**
 * Perguntas de validação (follow-ups) que a IA deve gerar.
 * Mantemos tolerante (default []) para não quebrar o fluxo.
 */
export const ValidationQuestionsSchema = z.object({
  questions: z.array(z.string().min(3)).default([]), // ideal: 5 perguntas
});

export type ValidationQuestions = z.infer<typeof ValidationQuestionsSchema>;

// ❌ REMOVIDO: Zod não possui .toJSON()
// export const ValidationQuestionsJSONSchema = ValidationQuestionsSchema.toJSON();
