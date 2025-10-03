// src/domain/schemas/extract-facts.schema.ts
import { z } from "zod";

/** Allowed purposes (strict, no "other" and no "transit") */
export const PurposeEnum = z.enum([
  "study",
  "work",
  "business",
  "tourism",
  "immigration",
]);

/** Personal block (all optional, trimmed when present) */
const PersonalSchema = z
  .object({
    full_name: z.string().min(1).trim().optional(),
    nationality: z.string().min(1).trim().optional(),
    date_of_birth: z.string().min(1).trim().optional(),
  })
  .partial()
  .refine(
    (obj) => Object.keys(obj).length === 0 || Object.values(obj).some(Boolean),
    { message: "personal must be omitted or contain at least one field" }
  );

/**
 * ExtractFacts:
 * - `purpose` is OPTIONAL but when present must be one of PurposeEnum
 * - no nulls anywhere; optional means “omit if unknown”
 * - years is non-negative integer
 */
export const ExtractFactsSchema = z.object({
  personal: PersonalSchema.optional(),
  purpose: PurposeEnum.optional(),
  education: z.string().min(1).trim().optional(),
  work_experience_years: z.number().int().nonnegative().optional(),
  has_us_sponsor: z.boolean().optional(),
});

export type ExtractFacts = z.infer<typeof ExtractFactsSchema>;
export type Purpose = z.infer<typeof PurposeEnum>;
