// src/domain/schemas/visa-candidates.schema.ts
import { z } from "zod";
import { VISA_META, prettyVisaLabel } from "@/domain/constants/visas";

// -------------------------------
// Normalização de códigos
// -------------------------------
const KNOWN_CODES = Object.keys(VISA_META);

function normalizeVisaCode(input?: string): string {
  if (!input) return "";
  let s = input.toUpperCase().trim();

  // Remover espaços e pontuações comuns
  s = s.replace(/\s+/g, "");
  s = s.replace(/-/g, "");
  s = s.replace(/\//g, "");

  // Aliases comuns -> chave do nosso dicionário
  if (s === "B1B2") s = "B1B2";
  if (s === "C1D") s = "C1D";

  // EB-2 NIW, EB2 NIW, EB2_NIW -> EB2_NIW
  s = s.replace(/\bEB[-\s]?2\s*NIW\b/g, "EB2_NIW");

  // EB-1A/EB1A etc já se comportam bem sem hífen por nossa tabela (EB1A, EB1B, EB1C)
  // Outras classes como H1B, H2A, O1A, etc. também.

  return s;
}

export const VisaCodeSchema = z
  .string({ required_error: "visa code required" })
  .min(1)
  .transform((v) => normalizeVisaCode(v));

// -------------------------------
// Candidate
// -------------------------------
export const VisaCandidateSchema = z
  .object({
    visa: VisaCodeSchema,                  // aceita desconhecido (com fallback)
    confidence: z.number().min(0).max(1), // 0..1
    rationale: z.string().max(5000).optional(),
  })
  .transform((c) => {
    const known = KNOWN_CODES.includes(c.visa);
    const label = prettyVisaLabel(c.visa);
    return { ...c, known, label };
  });

export type VisaCandidate = z.infer<typeof VisaCandidateSchema>;

// -------------------------------
// Lista de candidatos + selected
// - dedup por 'visa'
// - clamp 1..10 (ou ajuste se quiser 10 exatos)
// - selected consistente; se inválido/ausente, escolhe maior confiança
// -------------------------------
function dedupeByVisa(list: VisaCandidate[]): VisaCandidate[] {
  const seen = new Set<string>();
  const out: VisaCandidate[] = [];
  for (const c of list) {
    if (c.visa && !seen.has(c.visa)) {
      seen.add(c.visa);
      out.push(c);
    }
  }
  return out;
}

export const VisaCandidatesSchemaBase = z.object({
  candidates: z.array(VisaCandidateSchema).min(1).max(50),
  selected: z.string().optional(),
});

export const VisaCandidatesSchema = VisaCandidatesSchemaBase.transform((obj) => {
  // remove duplicados, limita a 10
  const deduped = dedupeByVisa(obj.candidates).slice(0, 10);

  // se 'selected' estiver presente, normaliza e verifica
  const selNorm = obj.selected ? normalizeVisaCode(obj.selected) : undefined;
  const hasSel = selNorm ? deduped.some((c) => c.visa === selNorm) : false;

  // se não há selected válido, escolhe o de maior confiança
  let selected = hasSel
    ? (selNorm as string)
    : (deduped.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]?.visa ?? undefined);

  return { candidates: deduped, selected };
});

export type VisaCandidates = z.infer<typeof VisaCandidatesSchema>;

// -------------------------------
// Helpers úteis na UI/regra de negócio
// -------------------------------

/** Garante exatamente 10 itens (preenche com placeholders se necessário).
 *  Use SOMENTE na UI, se você quiser um grid fixo de 10 slots.
 */
export function padToTen(cands: VisaCandidate[]): VisaCandidate[] {
  const base = cands.slice(0, 10);
  while (base.length < 10) {
    base.push({
      visa: `—`,
      confidence: 0,
      label: "—",
      known: false,
      rationale: undefined,
    } as VisaCandidate);
  }
  return base;
}
