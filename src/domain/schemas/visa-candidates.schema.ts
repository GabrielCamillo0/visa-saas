import { z } from "zod";

export const VisaCandidateSchema = z.object({
  visa: z.string(),                       // ex.: "B-2", "F-1"
  confidence: z.number().min(0).max(1),   // 0..1
  rationale: z.string().optional(),       // por que foi sugerido
});

export const VisaCandidatesSchema = z.object({
  candidates: z.array(VisaCandidateSchema).default([]),
  selected: z.string().optional(), // o visa escolhido dentre os candidates
});

export type VisaCandidate = z.infer<typeof VisaCandidateSchema>;
export type VisaCandidates = z.infer<typeof VisaCandidatesSchema>;

// ❌ REMOVIDO: Zod não possui .toJSON()
// export const VisaCandidatesJSONSchema = VisaCandidatesSchema.toJSON();
