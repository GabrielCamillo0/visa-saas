import { z } from "zod";

/** Objetos auxiliares (reutilizáveis) */
const JobOfferDetailsSchema = z.object({
  position: z.string().min(2).max(200).optional(),
  industry: z.string().min(2).max(200).optional(),
  salary_usd_year: z.number().int().nonnegative().optional(),
  employer_size: z.string().min(1).max(100).optional(),
  is_multinational: z.boolean().optional(),
});

const ExtraordinaryEvidenceSchema = z.object({
  awards: z.array(z.string().min(2)).optional(),
  media_mentions: z.number().int().nonnegative().optional(),
  conference_speaking: z.boolean().optional(),
  peer_review_jury: z.boolean().optional(),
  original_contributions: z.string().min(2).optional(),
});

const NiwProngsSchema = z.object({
  national_importance: z.string().min(2).optional(),
  well_positioned: z.string().min(2).optional(),
  benefit_outweighs_labor_cert: z.string().min(2).optional(),
});

const PermReadinessSchema = z.object({
  occupation: z.string().min(2).optional(),              // SOC code/title se tiver
  degree_requirement: z.string().min(1).optional(),       // "Bachelor" | "Master" | etc.
  prevailing_wage_level: z.string().min(1).optional(),    // "Level I | II | III | IV"
});

const TreatyEligibleSchema = z.object({
  e1: z.boolean().optional(),
  e2: z.boolean().optional(),
});

const ImmigrationHistorySchema = z.object({
  overstay_or_violations: z.boolean().optional(),
  prior_us_visas: z.array(z.string().min(1)).optional(),
});

const FamilyTiesSchema = z.object({
  immediate_relative_us_citizen: z.boolean().optional(), // cônjuge/pais/filhos USC
});

const EntrepreneurshipSchema = z.object({
  owns_business: z.boolean().optional(),
  business_details: z.string().min(2).optional(),
});

/** signals: bloco enriquecido (opcional, mas agora parte do schema principal) */
const SignalsSchema = z.object({
  field_of_expertise: z.string().min(2).optional(),
  has_job_offer: z.boolean().optional(),
  job_offer_details: JobOfferDetailsSchema.optional(),
  extraordinary_evidence: ExtraordinaryEvidenceSchema.optional(),
  niw_prongs: NiwProngsSchema.optional(),
  perm_readiness: PermReadinessSchema.optional(),
  chargeability_country: z.string().min(2).optional(),
  treaty_eligible: TreatyEligibleSchema.optional(),
  investment_capacity_usd: z.number().int().nonnegative().optional(),
  multinational_experience_years: z.number().int().nonnegative().optional(),
  portfolio_links: z.array(z.string().url()).optional(),
  english_level: z.string().min(1).optional(), // B1/B2/C1... ou livre
  travel_history: z.array(z.string().min(2)).optional(),
  immigration_history: ImmigrationHistorySchema.optional(),
  family_ties_us: FamilyTiesSchema.optional(),
  entrepreneurship: EntrepreneurshipSchema.optional(),
});

/** schema principal */
export const ExtractFactsSchema = z.object({
  personal: z
    .object({
      full_name: z.string().min(2).max(200).optional(),
      nationality: z.string().min(2).max(120).optional(),
      date_of_birth: z.string().min(4).max(20).optional(), // manter string p/ flex
    })
    .partial()
    .optional(),

  // propósito agora limitado (sem "other/transit")
  purpose: z.enum(["study", "work", "business", "tourism", "immigration"]),

  education: z.string().min(2).optional(),
  work_experience_years: z.number().int().nonnegative().optional(),
  has_us_sponsor: z.boolean().optional(),

  // bloco enriquecido
  signals: SignalsSchema.optional(),
});

export type ExtractFacts = z.infer<typeof ExtractFactsSchema>;
