// src/domain/services/classify-visa.ts
import { callJSON } from "@/lib/openai";
import {
  VisaCandidatesSchema,
  type VisaCandidates,
  type VisaCandidate,
} from "@/domain/schemas/visa-candidates.schema";

/** Formato interno antes do parse (sem known/label). */
type VisaCandidateRaw = { visa: string; confidence: number; rationale: string };
import type { ExtractFacts } from "@/domain/schemas/extract-facts.schema";

/** ===== model / temperature ===== */
function resolveModel(): string {
  const m = process.env.OPENAI_MODEL?.trim();
  return m && m.length > 0 ? m : "gpt-5";
}
function supportsTemperature(model: string): boolean {
  // gpt-5* geralmente só aceita temperatura default
  return !/^gpt-5\b/i.test(model);
}

/** ===== tamanho da resposta ===== */
function resolveReturnCount(): number {
  const n = Number(process.env.CLASSIFY_RETURN_COUNT ?? 6);
  return Math.min(Math.max(1, Math.floor(n)), 30); // 1..30 (padrão 6)
}

/** ===== regras sobre sponsor ===== */
const SPONSOR_REQUIRED = new Set([
  // Work/Temp que pedem petitioner/employer/agent
  "H1B","H2A","H2B","H3","O1","O2","P1","P2","P3","P4","R1","Q1","TN","E3","L1","J1",
  // Employment-based immigrant com PERM/employer
  "EB1B","EB1C","EB2_PERM","EB3",
  // Family-based
  "FAMILY","IR1","CR1","K1","K3","V","F1_FAMILY","F2_FAMILY","F3_FAMILY","F4_FAMILY",
]);
function isSponsorRequired(code: string): boolean {
  return SPONSOR_REQUIRED.has(code.toUpperCase());
}

/** Sugere categorias de visto mais relevantes dado o purpose (evita desperdício de slots). */
function purposeToRelevantVisas(purpose: string | null | undefined): string[] {
  const p = (purpose ?? "").toLowerCase();
  if (p === "study") return ["F1", "M1", "J1", "B2", "F1_FAMILY"];
  if (p === "work") return ["EB2_NIW", "O1", "H1B", "L1", "EB1A", "EB2_PERM", "EB3", "E2", "TN", "E3", "B1"];
  if (p === "business") return ["E1", "E2", "B1", "L1", "EB5", "O1", "H1B"];
  if (p === "tourism") return ["B2", "B1", "F1_FAMILY"];
  if (p === "immigration") return ["EB2_NIW", "EB5", "EB1A", "DV", "FAMILY", "IR1", "CR1", "EB2_PERM", "EB3", "E2"];
  return [];
}

/** ===== API ===== */
export async function classifyVisa(facts: ExtractFacts): Promise<VisaCandidates> {
  const COUNT = resolveReturnCount();
  const purposeHint = purposeToRelevantVisas(facts?.purpose);

  const system = [
    "Você é um classificador de vistos dos EUA. Sua saída é usada para sugerir vistos e gerar perguntas. APONTE APENAS VISTOS QUE FAÇAM SENTIDO para o perfil e o propósito da pessoa.",
    "",
    "REGRAS OBRIGATÓRIAS:",
    "1. Base a classificação APENAS nos fatos extraídos (personal, purpose, education, work_experience_years, has_us_sponsor, signals). Não invente dados.",
    "2. INCLUA SOMENTE vistos coerentes com o purpose e o perfil:",
    "   - purpose=tourism → apenas B2, B1 (e B1 só se houver motivo de negócios). NUNCA sugira EB5, H1B, F1, etc.",
    "   - purpose=study → F1, M1, J1, B2. NUNCA sugira vistos de trabalho permanente ou investimento.",
    "   - purpose=business → B1, E1, E2, L1 (se multinacional). EB5 só se houver sinal de investimento. Evite vistos de imigração familiar.",
    "   - purpose=work → H1B, L1, O1, E2, TN, E3, EB2_NIW, EB1A, EB2_PERM, EB3. Só inclua H1B/EB2_PERM/EB3 se houver oferta de emprego ou forte perfil; EB2_NIW/EB1A/E2 para quem não tem sponsor.",
    "   - purpose=immigration → EB2_NIW, EB1A, EB5, DV, E2, FAMILY, IR1, CR1, K1, EB2_PERM, EB3. Priorize conforme sinais: família nos EUA → FAMILY/IR1/CR1/K1; investimento → EB5/E2; sem sponsor → EB2_NIW/EB1A/DV/E2.",
    "3. NÃO inclua vistos claramente irrelevantes (ex.: DV para quem não tem país de chargeability elegível; IR1/CR1 sem cônjuge cidadão; L1 sem experiência em multinacional).",
    "4. Para cada candidato, 'rationale' deve citar fatos que apoiam ou enfraquecem. confidence (0..1): quão bem os fatos preenchem o visto. Dados faltando = menor confiança.",
    "5. Priorize no topo vistos que NÃO exigem patrocinador quando os fatos permitirem. Marque vistos que exigem sponsor com '(requires sponsor)' na rationale.",
    "",
    "FORMATO (somente JSON):",
    '{ "candidates": [ { "visa": "CODIGO", "confidence": 0.0 a 1.0, "rationale": "CODIGO — justificativa com base nos fatos" }, ... ], "selected": "CODIGO" }',
    "",
    "CÓDIGOS VÁLIDOS (use exatamente): B1, B2, F1, M1, J1, H1B, H2A, H2B, H3, L1, O1, O2, E1, E2, TN, E3, P1-P4, R1, Q1, I, U, T, K1, K3, V, IR1, CR1, F1_FAMILY-F4_FAMILY, FAMILY, EB1A, EB1B, EB1C, EB2_NIW, EB2_PERM, EB3, EB4, EB5, DV.",
    `- Retorne EXATAMENTE ${COUNT} candidatos, TODOS coerentes com purpose e perfil. Ordenados por relevância/confiança.`,
    "- 'selected' = o visto mais recomendado (geralmente o primeiro).",
  ].join("\n");

  const user = {
    extracted_facts: facts,
    purpose: facts?.purpose ?? null,
    signals: facts?.signals ?? undefined,
    relevant_visas_hint: purposeHint.length > 0 ? purposeHint : undefined,
    instruction: `Classifique APENAS vistos que façam sentido para o purpose e o perfil. ${purposeHint.length > 0 ? `Priorize entre: ${purposeHint.join(", ")}; inclua outros só se os fatos justificarem.` : ""} NÃO sugira vistos irrelevantes (ex.: turismo → só B2/B1). Retorne exatamente ${COUNT} candidatos em JSON. Inicie cada rationale com "CODIGO — ". Marque "(requires sponsor)" quando o visto exigir patrocinador.`,
  };

  const model = resolveModel();
  const temp = supportsTemperature(model) ? 0.15 : undefined;

  const raw = await callJSON<unknown>({
    system,
    user,
    model,
    ...(typeof temp === "number" ? { temperature: temp } : {}),
    validate: (data) => sanitizeCandidatesLike(data, COUNT),
    verboseLog: process.env.NODE_ENV !== "production",
    timeoutMs: Number(process.env.AI_TIMEOUT_CLASSIFY_MS ?? 120_000),
    maxRetries: 0,
  });

  const parsed = VisaCandidatesSchema.parse(raw);

  // Reordenar: independentes primeiro, patrocinados no fim
  const reordered = reorderBySponsor(parsed, COUNT);

  // Garantir selected coerente
  const finalized = finalizeSelection(reordered);

  // Opcional: força >=0.80 no topo (configurável)
  const require80 = String(process.env.CLASSIFY_REQUIRE_TOP80 ?? "true").toLowerCase() !== "false";
  if (require80 && finalized.candidates[0] && (finalized.candidates[0].confidence ?? 0) < 0.8) {
    finalized.candidates[0].confidence = 0.8;
  }

  return finalized;
}

/** ===== reorder: independentes primeiro, sponsor no fim ===== */
function reorderBySponsor(data: VisaCandidates, max: number): VisaCandidates {
  const arr = Array.isArray(data.candidates) ? data.candidates.slice(0, max) : [];
  const independents: VisaCandidate[] = [];
  const sponsored: VisaCandidate[] = [];

  for (const c of arr) {
    if (isSponsorRequired(c.visa)) {
      const hasTag = (c.rationale ?? "").toLowerCase().includes("requires sponsor");
      const tag: string = hasTag
        ? (c.rationale ?? "(requires sponsor)")
        : c.rationale
          ? `${c.rationale} (requires sponsor)`
          : "(requires sponsor)";
      sponsored.push({ ...c, rationale: tag });
    } else {
      independents.push(c);
    }
  }

  independents.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  sponsored.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const candidates = [...independents, ...sponsored].slice(0, max);
  return { candidates, selected: data.selected };
}

/** ===== seleção ===== */
function finalizeSelection(data: VisaCandidates): VisaCandidates {
  if (!data.candidates?.length) {
    return { candidates: [], selected: "" };
  }
  const hasSelected = data.selected && data.candidates.some((c) => c.visa === data.selected);
  if (hasSelected) return data;
  const top = [...data.candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  return { candidates: data.candidates, selected: top?.visa ?? "" };
}

/* ===== Normalização ===== */

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
type MapRow = { re: RegExp; code: string };

/** Catálogo amplo para normalizar rótulos livres do modelo */
const TABLE: MapRow[] = [
  // Visitor
  { re: /\bb[-\s_]?1\b(?!.*b[-\s_]?2)|\bb1\b|business visitor/, code: "B1" },
  { re: /\bb[-\s_]?2\b|\bb2\b|tourist|visitor\b(?!.*business)/, code: "B2" },

  // Students / Exchange
  { re: /\bf[-\s_]?1\b|\bf1\b|academic student|i-20|i20/, code: "F1" },
  { re: /\bm[-\s_]?1\b|\bm1\b|vocational student/, code: "M1" },
  { re: /\bj[-\s_]?1\b|\bj1\b|exchange visitor|ds-2019|ds2019/, code: "J1" },

  // H set
  { re: /\bh[-\s_]?1b\b|\bh1b\b|specialty occupation/, code: "H1B" },
  { re: /\bh[-\s_]?2a\b|\bh2a\b/, code: "H2A" },
  { re: /\bh[-\s_]?2b\b|\bh2b\b/, code: "H2B" },
  { re: /\bh[-\s_]?3\b|\bh3\b/, code: "H3" },

  // L/O/P/TN/E/I/R/Q
  { re: /\bl[-\s_]?1\b|\bl1\b|intracompany transfer/, code: "L1" },
  { re: /\bo[-\s_]?1\b|\bo1\b|extraordinary ability.*(nonimmig|temporary)?/, code: "O1" },
  { re: /\bo[-\s_]?2\b|\bo2\b/, code: "O2" },
  { re: /\bp[-\s_]?1\b|\bp1\b|athlete|entertainment team/, code: "P1" },
  { re: /\bp[-\s_]?2\b|\bp2\b/, code: "P2" },
  { re: /\bp[-\s_]?3\b|\bp3\b/, code: "P3" },
  { re: /\bp[-\s_]?4\b|\bp4\b/, code: "P4" },
  { re: /\btn\b|usmca/, code: "TN" },
  { re: /\be[-\s_]?3\b|\be3\b|australian specialty occupation/, code: "E3" },
  { re: /\be[-\s_]?1\b|\be1\b|treaty trader/, code: "E1" },
  { re: /\be[-\s_]?2\b|\be2\b|treaty investor|investidor tratado/, code: "E2" },
  { re: /\bmedia\b|press|journalist\b|\bi\b(?![-\s_]?140)/, code: "I" },
  { re: /\br[-\s_]?1\b|\br1\b|religious worker/, code: "R1" },
  { re: /\bq[-\s_]?1\b|\bq1\b|cultural exchange/, code: "Q1" },

  // Humanitarian / victims
  { re: /\bu\b(?![-\s_]?s|scis|scis)|u[-\s_]?visa|victim of crime/, code: "U" },
  { re: /\bt\b(?![-\s_]?p|ps)|t[-\s_]?visa|traffick/, code: "T" },

  // Fiancé / family NIV-like
  { re: /\bk[-\s_]?1\b|\bk1\b|fiance/i, code: "K1" },
  { re: /\bk[-\s_]?3\b|\bk3\b/, code: "K3" },
  { re: /\bv\b(?=\b|[-_])/, code: "V" },

  // Family-based IV
  { re: /\bir[-\s_]?1\b|\bcr[-\s_]?1\b|spouse of us citizen|c[oô]njuge.*cidad[aã]o/, code: "IR1" },
  { re: /\bcr[-\s_]?1\b/, code: "CR1" },
  { re: /\bf1 family\b|family preference 1|unmarried sons daughters citizens/, code: "F1_FAMILY" },
  { re: /\bf2 family\b|spouses children of lpr/, code: "F2_FAMILY" },
  { re: /\bf3 family\b|married sons daughters citizens/, code: "F3_FAMILY" },
  { re: /\bf4 family\b|siblings of citizens/, code: "F4_FAMILY" },

  // Employment-based IV
  { re: /\beb[-\s_]?1a\b|extraordinary ability.*(immigrant|green card)|eb1a/, code: "EB1A" },
  { re: /\beb[-\s_]?1b\b|outstanding researcher|eb1b/, code: "EB1B" },
  { re: /\beb[-\s_]?1c\b|multinational manager|eb1c/, code: "EB1C" },
  { re: /\beb[-\s_]?2\s*niw\b|(?:^|\b)niw\b|national interest waiver|eb2[-\s_]?niw/, code: "EB2_NIW" },
  { re: /\beb[-\s_]?2\b(?!.*niw)|eb2 perm|perm.*eb[-\s_]?2|eb[-\s_]?2.*perm|i[-\s_]?140.*eb[-\s_]?2/, code: "EB2_PERM" },
  { re: /\beb[-\s_]?3\b|skilled|professional|other worker|eb3/, code: "EB3" },
  { re: /\beb[-\s_]?4\b|special immigrant|religious.*immigrant/, code: "EB4" },
  { re: /\beb[-\s_]?5\b|investor.*(immigrant|green card)|regional center/, code: "EB5" },

  // Diversity
  { re: /\bdv\b|diversity(?: |-)?visa|lottery|loteria/, code: "DV" },

  // Bucket genérico de família
  { re: /family[-\s_]?based|c[oô]njuge|espos[ao]|filh[oa]|irma[oa]|parente/, code: "FAMILY" },
];

const KNOWN = new Set([
  "B1","B2",
  "F1","M1","J1",
  "H1B","H2A","H2B","H3",
  "L1","O1","O2","P1","P2","P3","P4","TN","E3","E1","E2","I","R1","Q1",
  "U","T",
  "K1","K3","V",
  "IR1","CR1","F1_FAMILY","F2_FAMILY","F3_FAMILY","F4_FAMILY","FAMILY",
  "EB1A","EB1B","EB1C","EB2_NIW","EB2_PERM","EB3","EB4","EB5",
  "DV",
]);

function normalizeVisaToCode(raw: unknown): { code: string | null } {
  if (typeof raw !== "string") return { code: null };
  const s = raw.trim();
  if (!s) return { code: null };
  const folded = stripDiacritics(s.toLowerCase());

  for (const row of TABLE) if (row.re.test(folded)) return { code: row.code };

  const direct = s.toUpperCase();
  if (KNOWN.has(direct)) return { code: direct };

  const simple = direct.replace(/\s+/g, "_").replace(/-/g, "_").replace(/[()]/g, "");
  if (KNOWN.has(simple)) return { code: simple };

  return { code: null };
}

/** ===== sanitize (SEM FALLBACKS) ===== */
function sanitizeCandidatesLike(
  input: unknown,
  count: number
): { candidates: VisaCandidateRaw[]; selected?: string } {
  const obj = isObj(input) ? (input as any) : {};
  const inArr: unknown[] = Array.isArray(obj.candidates) ? obj.candidates : [];

  const cleaned: VisaCandidateRaw[] = inArr
    .map((item): VisaCandidateRaw | null => {
      const { code } = normalizeVisaToCode((item as any)?.visa);
      if (!code) return null;

      let rationale = toStrOpt((item as any)?.rationale);
      if (!rationale || rationale.trim().length === 0) rationale = code;
      // Garante início com "CODE — ..."
      if (!rationale.trim().toUpperCase().startsWith(code)) {
        rationale = `${code} — ${rationale}`;
      }

      const confidence = toConfidence((item as any)?.confidence);
      return { visa: code, confidence, rationale };
    })
    .filter((x): x is VisaCandidateRaw => x != null);

  // Remove duplicados e ordena
  const uniq = dedupeByVisaRaw(cleaned).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  // Corta para o tamanho pedido — SEM completar via fallback
  const trimmed = uniq.slice(0, count);

  const selected =
    isNonEmptyString(obj.selected) && trimmed.some((c) => c.visa === obj.selected)
      ? obj.selected
      : trimmed[0]?.visa;

  return { candidates: trimmed, selected };
}

/** ===== helpers ===== */
function dedupeByVisaRaw(arr: VisaCandidateRaw[]): VisaCandidateRaw[] {
  const seen = new Set<string>();
  const out: VisaCandidateRaw[] = [];
  for (const c of arr) {
    const key = c.visa.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function isNonEmptyString(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}
function toStrOpt(v: unknown): string | undefined {
  return isNonEmptyString(v) ? v.trim() : undefined;
}
function toConfidence(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return clamp01(v <= 1 ? v : v / 100);
  if (typeof v === "string") {
    const s = v.trim();
    const pct = s.match(/^(\d{1,3})(\.\d+)?\s*%$/);
    if (pct) return clamp01(Number(pct[1] + (pct[2] || "")) / 100);
    const n = Number(s.replace(",", "."));
    if (Number.isFinite(n)) return clamp01(n <= 1 ? n : n / 100);
  }
  return 0;
}
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
