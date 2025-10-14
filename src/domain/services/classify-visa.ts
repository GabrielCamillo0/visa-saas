// src/domain/services/classify-visa.ts
import { callJSON } from "@/lib/openai";
import {
  VisaCandidatesSchema,
  type VisaCandidates,
  type VisaCandidate,
} from "@/domain/schemas/visa-candidates.schema";
import type { ExtractFacts } from "@/domain/schemas/extract-facts.schema";

/** ===== modelo / temperatura ===== */
function resolveModel(): string {
  const m = process.env.OPENAI_MODEL?.trim();
  return m && m.length > 0 ? m : "gpt-5";
}
function supportsTemperature(model: string): boolean {
  // Modelos gpt-5* normalmente rejeitam temperature != default
  return !/^gpt-5\b/i.test(model);
}

/** ===== API ===== */
/**
 * Classificador de vistos que SEMPRE devolve 5 candidatos.
 * - Normaliza nomes livres (ex.: "EB-2 NIW") para códigos canônicos (ex.: "EB2_NIW").
 * - Garante visa não-vazio, confidence em 0..1, remove duplicados, ordena e preenche até 10.
 * - selected = topo por confiança; mantém se vier válido do modelo.
 */
export async function classifyVisa(facts: ExtractFacts): Promise<VisaCandidates> {
  const purpose = `${facts?.purpose ?? ""}`.toLowerCase();

  const system = [
    "Você é um sistema de classificação de vistos dos EUA.",
    "Responda APENAS em JSON válido, sem explicações nem texto extra.",
    "Formato OBRIGATÓRIO do objeto:",
    "{",
    '  "candidates": [ { "visa": string, "confidence": number, "rationale": string? }, ... ],',
    '  "selected": string?',
    "}",
    "Regras:",
    "- Devolva EXATAMENTE 10 itens em 'candidates'.",
    '- Cada item DEVE ter "visa" não vazio (ex.: "B1", "B2", "F1", "H1B", "EB2_NIW", "EB1A" etc.).',
    "- 'confidence' deve estar em 0..1 (ex.: 0.83).",
    "- 'selected' (se presente) DEVE ser um dos 'visa' listados em 'candidates' e preferencialmente o de maior confiança.",
  ].join("\n");

  const user = {
    extracted_facts: facts,
    goal:
      "Classificar os melhores tipos de visto para o caso, com justificativa e confiança. Retorne exatamente 5 candidatos e retorne visto no comeco da explicacao.",
  };

  const model = resolveModel();
  const temp = supportsTemperature(model) ? 0.2 : undefined;

  const raw = await callJSON<unknown>({
    system,
    user,
    model,
    ...(typeof temp === "number" ? { temperature: temp } : {}),
    validate: (data) => sanitizeCandidatesLike(data, purpose),
    verboseLog: process.env.NODE_ENV !== "production",
    timeoutMs: Number(process.env.AI_TIMEOUT_CLASSIFY_MS ?? 90_000),
    maxRetries: 0,
  });

  const parsed = VisaCandidatesSchema.parse(raw);
  const finalized = finalizeSelection(parsed);

  // Opcional: garantir confiança >= 0.80 no topo (ativado por padrão)
  const require80 = String(process.env.CLASSIFY_REQUIRE_TOP80 ?? "true").toLowerCase() !== "false";
  if (require80 && finalized.candidates[0] && (finalized.candidates[0].confidence ?? 0) < 0.8) {
    finalized.candidates[0].confidence = 0.8;
  }

  return finalized;
}

/** ===== seleção coerente ===== */
function finalizeSelection(data: VisaCandidates): VisaCandidates {
  if (!data.candidates?.length) return { candidates: [], selected: undefined };
  const hasSelected =
    data.selected && data.candidates.some((c) => c.visa === data.selected);
  if (hasSelected) return data;

  const top = [...data.candidates].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
  )[0];
  return { candidates: data.candidates, selected: top?.visa };
}

/* ===== Normalização de códigos ===== */

function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeVisaToCode(raw: unknown): { code: string | null } {
  if (typeof raw !== "string") return { code: null };
  const s = raw.trim();
  if (!s) return { code: null };

  const folded = stripDiacritics(s.toLowerCase());

  const table: Array<{ re: RegExp; code: string }> = [
    { re: /\beb[-\s_]?1a\b|extraordinary ability|eb1a/, code: "EB1A" },
    { re: /\beb[-\s_]?1b\b|outstanding researcher|eb1b/, code: "EB1B" },
    { re: /\beb[-\s_]?2\s*niw\b|(?:^|\b)niw\b|national interest waiver|eb2[-\s_]?niw/, code: "EB2_NIW" },
    { re: /\beb[-\s_]?2\b(?!.*niw)|eb2 perm|perm.*eb[-\s_]?2|eb[-\s_]?2.*perm/, code: "EB2_PERM" },
    { re: /\beb[-\s_]?3\b|skilled|professional|eb3/, code: "EB3" },
    { re: /\beb[-\s_]?5\b|investor|eb5/, code: "EB5" },
    { re: /\b(ir|cr)\b|family[-\s_]?based|conjuge|c[oô]njuge|espos[ao]|familia/, code: "FAMILY" },
    { re: /\bdv\b|diversity(?: |-)?visa|loteria/, code: "DV" },
    { re: /\bh[-\s_]?1b\b|h1b/, code: "H1B" },
    { re: /\bo[-\s_]?1\b|o1/, code: "O1" },
    { re: /\bl[-\s_]?1\b|l1/, code: "L1" },
    { re: /\bf[-\s_]?1\b|f1/, code: "F1" },
    { re: /\bm[-\s_]?1\b|m1/, code: "M1" },
    { re: /\bj[-\s_]?1\b|j1/, code: "J1" },
    { re: /\bb[-\s_]?1\b(?!.*b[-\s_]?2)|\bb1\b/, code: "B1" },
    { re: /\bb[-\s_]?2\b|\bb2\b/, code: "B2" },
    { re: /\btn\b/, code: "TN" },
    { re: /\be[-\s_]?2\b|\be2\b|tratado de investimento|investidor tratado/, code: "E2" },
    { re: /\be[-\s_]?1\b|\be1\b/, code: "E1" },
  ];

  for (const row of table) {
    if (row.re.test(folded)) return { code: row.code };
  }

  const KNOWN = new Set([
    "EB1A","EB1B","EB2_NIW","EB2_PERM","EB3","EB5","FAMILY","DV",
    "H1B","O1","L1","F1","M1","J1","B1","B2","TN","E1","E2",
  ]);

  const direct = s.toUpperCase();
  if (KNOWN.has(direct)) return { code: direct };

  const simple = direct.replace(/\s+/g, "_").replace(/-/g, "_").replace(/[()]/g, "");
  if (KNOWN.has(simple)) return { code: simple };

  return { code: null };
}

/** ===== normalização pós-modelo ===== */
function sanitizeCandidatesLike(input: unknown, purpose: string): VisaCandidates {
  const obj = isObj(input) ? (input as any) : {};
  const inArr: unknown[] = Array.isArray(obj.candidates) ? obj.candidates : [];

  const cleaned: VisaCandidate[] = inArr
    .map((item) => {
      const { code } = normalizeVisaToCode((item as any)?.visa);
      if (!code) return null;
      const confidence = toConfidence((item as any)?.confidence);
      const rationale = toStrOpt((item as any)?.rationale);
      return { visa: code, confidence, rationale };
    })
    .filter((x): x is VisaCandidate => !!x);

  const uniq = dedupeByVisa(cleaned);
  uniq.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  const filled = padToTen(uniq, purpose);

  const selected =
    isNonEmptyString(obj.selected) && filled.some((c) => c.visa === obj.selected)
      ? obj.selected
      : filled[0]?.visa;

  return { candidates: filled.slice(0, 10), selected };
}

/** ===== helpers ===== */
function dedupeByVisa(arr: VisaCandidate[]): VisaCandidate[] {
  const seen = new Set<string>();
  const out: VisaCandidate[] = [];
  for (const c of arr) {
    const key = c.visa.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

type Fallback = { visa: string; confidence: number; rationale?: string };

const FALLBACKS_BY_PURPOSE: Record<string, Fallback[]> = {
  immigration: [
    { visa: "EB2_NIW", confidence: 0.62, rationale: "Autopetição com mérito/benefício nacional." },
    { visa: "EB2_PERM", confidence: 0.56, rationale: "Oferta + PERM; bacharel + experiência." },
    { visa: "EB3", confidence: 0.5, rationale: "Oferta + PERM para função qualificada/profissional." },
    { visa: "EB1A", confidence: 0.45, rationale: "Habilidade extraordinária; alto nível de evidências." },
    { visa: "EB1B", confidence: 0.4, rationale: "Pesquisador/professor destacado." },
    { visa: "EB5", confidence: 0.35, rationale: "Residência por investimento; origem lícita dos fundos." },
    { visa: "FAMILY", confidence: 0.3, rationale: "Base familiar (IR/CR) quando aplicável." },
    { visa: "DV", confidence: 0.2, rationale: "Loteria de diversidade — depende de elegibilidade anual." },
    { visa: "O1", confidence: 0.28, rationale: "Temporário; ponte para EB1A/EB2 em alguns casos." },
    { visa: "L1", confidence: 0.22, rationale: "Transferência intraempresa, se aplicável." },
  ],
  study: [
    { visa: "F1", confidence: 0.7, rationale: "Acadêmico com I-20, vínculos e funding." },
    { visa: "M1", confidence: 0.4, rationale: "Vocacional/técnico." },
    { visa: "J1", confidence: 0.35, rationale: "Intercâmbio/treinamento com sponsor." },
    { visa: "B2", confidence: 0.25, rationale: "Cursos recreativos de curta duração." },
    { visa: "H1B", confidence: 0.2, rationale: "Trabalho em ocupação especializada (futuro)." },
    { visa: "O1", confidence: 0.18 },
    { visa: "B1", confidence: 0.15 },
    { visa: "E2", confidence: 0.14 },
    { visa: "TN", confidence: 0.12 },
    { visa: "L1", confidence: 0.1 },
  ],
  work: [
    { visa: "H1B", confidence: 0.62, rationale: "Grau superior/área especializada + empregador." },
    { visa: "L1", confidence: 0.45, rationale: "Transferência multinacional." },
    { visa: "O1", confidence: 0.4, rationale: "Habilidade extraordinária; sem cap anual." },
    { visa: "TN", confidence: 0.35 },
    { visa: "E2", confidence: 0.3 },
    { visa: "E1", confidence: 0.25 },
    { visa: "J1", confidence: 0.2 },
    { visa: "B1", confidence: 0.18 },
    { visa: "B2", confidence: 0.12 },
    { visa: "EB2_NIW", confidence: 0.2 },
  ],
  business: [
    { visa: "B1", confidence: 0.7, rationale: "Reuniões, conferências, prospecção (sem trabalho nos EUA)." },
    { visa: "E1", confidence: 0.35 },
    { visa: "E2", confidence: 0.32 },
    { visa: "O1", confidence: 0.25 },
    { visa: "B2", confidence: 0.2 },
    { visa: "H1B", confidence: 0.18 },
    { visa: "L1", confidence: 0.16 },
    { visa: "TN", confidence: 0.14 },
    { visa: "F1", confidence: 0.12 },
    { visa: "DV", confidence: 0.1 },
  ],
  tourism: [
    { visa: "B2", confidence: 0.75, rationale: "Visita/lazer/saúde; sem estudo com crédito ou trabalho." },
    { visa: "B1", confidence: 0.35 },
    { visa: "F1", confidence: 0.2 },
    { visa: "J1", confidence: 0.18 },
    { visa: "M1", confidence: 0.16 },
    { visa: "H1B", confidence: 0.14 },
    { visa: "O1", confidence: 0.12 },
    { visa: "TN", confidence: 0.1 },
    { visa: "E2", confidence: 0.1 },
    { visa: "DV", confidence: 0.08 },
  ],
};

function padToTen(arr: VisaCandidate[], purpose: string): VisaCandidate[] {
  const out = [...arr];
  const pool = FALLBACKS_BY_PURPOSE[purpose] || FALLBACKS_BY_PURPOSE["immigration"];

  for (const fb of pool) {
    if (out.length >= 10) break;
    if (out.some((c) => c.visa === fb.visa)) continue;
    out.push({ visa: fb.visa, confidence: clamp01(fb.confidence), rationale: fb.rationale });
  }

  // Se ainda tiver <10, duplica cauda com leve decaimento
  while (out.length < 10 && out.length > 0) {
    const c = out[out.length - 1];
    out.push({ ...c, confidence: Math.max(0.1, (c.confidence ?? 0) * 0.95) });
  }

  return out.slice(0, 10);
}

/** ===== minis ===== */
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
