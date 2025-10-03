// src/domain/services/extract-facts.ts
import { callJSON } from "@/lib/openai";
import { ExtractFactsSchema, type ExtractFacts } from "@/domain/schemas/extract-facts.schema";

/**
 * Extrai fatos objetivos. Sem fallback silencioso.
 * Restringe `purpose` a: "study" | "work" | "business" | "tourism" | "immigration".
 * Aplica correção determinística quando o texto indicar outro propósito mais forte.
 */
export async function extractFacts(rawText: string | null | undefined): Promise<ExtractFacts> {
  const text = typeof rawText === "string" ? rawText : "";

  const system = [
    "Você é um extrator de fatos para elegibilidade de vistos dos EUA.",
    "Responda APENAS em JSON válido, sem explicações nem texto fora do objeto.",
    "Formato obrigatório do objeto:",
    "{",
    '  "personal": { "full_name": string?, "nationality": string?, "date_of_birth": string? },',
    '  "purpose": "study" | "work" | "business" | "tourism" | "immigration",',
    '  "education": string?,',
    '  "work_experience_years": number?,',
    '  "has_us_sponsor": boolean?',
    "}",
    "Regras IMPORTANTES:",
    '- O campo "purpose" deve ser OBRIGATORIAMENTE um entre: "study" | "work" | "business" | "tourism" | "immigration".',
    '- NÃO use "other" nem "transit".',
    '- Use "immigration" quando a intenção principal for morar no país / migrar / residência permanente (ex.: green card, mudar de país).',
    '- Use "study" quando houver sinais claros de estudo (curso, escola, college, universidade, F-1, I-20 etc.).',
    '- Use "work" quando houver sinais claros de trabalho/emprego (empregador, job offer, H-1B etc.).',
    '- Use "business" quando o objetivo principal for reuniões/feiras/atividades de negócios de curto prazo.',
    '- Use "tourism" quando for visita/lazer/turismo e não houver sinais fortes dos demais.',
    "- Campos desconhecidos devem ser OMITIDOS (nunca null). Números e booleanos devem ser tipos JSON corretos.",
  ].join("\n");

  const user = {
    raw_text: text,
    goal: "Extrair fatos objetivos relevantes para enquadramento de visto (sem interpretações livres).",
  };

  // 1) chama o modelo e valida com Zod após sanitização
  const validated = await callJSON<ExtractFacts>({
    system,
    user,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    validate: (data) => ExtractFactsSchema.parse(sanitizeFactsLike(data)),
    verboseLog: process.env.NODE_ENV !== "production",
  });

  // 2) correção determinística do purpose quando o texto indicar algo mais forte
  const inferred = hardInferPurpose(text);
  if (inferred && shouldOverridePurpose(validated.purpose, inferred)) {
    return { ...validated, purpose: inferred };
  }

  return validated;
}

/** Decide se devemos sobrescrever o purpose do modelo pelo inferido. */
function shouldOverridePurpose(
  modelPurpose: ExtractFacts["purpose"],
  inferred: ExtractFacts["purpose"]
): boolean {
  if (!inferred) return false;
  if (modelPurpose === inferred) return false;
  // Prioridade: immigration > study > work > business > tourism
  const prio: Record<NonNullable<ExtractFacts["purpose"]>, number> = {
    immigration: 5,
    study: 4,
    work: 3,
    business: 2,
    tourism: 1,
  };
  return (prio[inferred] ?? -1) > (prio[modelPurpose ?? "tourism"] ?? -1);
}

/** Lowercase + remove diacríticos para comparar em ASCII puro. */
function fold(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

/** Inferência determinística por palavras-chave (PT/EN), já com fold(). */
function hardInferPurpose(text: string): ExtractFacts["purpose"] | undefined {
  const f = fold(text);
  const hasAny = (terms: string[]) => terms.some((t) => f.includes(t));

  // MIGRAÇÃO / RESIDÊNCIA
  const immigrationTerms = [
    "morar nos estados unidos",
    "mudar de pais",
    "mudar para os eua",
    "migrar",
    "migracao",
    "imigrar",
    "imigracao",
    "residencia permanente",
    "green card",
    "ajuste de status",
    "residente permanente",
    "permanent resident",
  ];
  if (hasAny(immigrationTerms)) return "immigration";

  // ESTUDO
  const studyTerms = [
    "estudar",
    "estudo",
    "curso",
    "faculdade",
    "universidade",
    "college",
    "escola",
    "matricula",
    "f-1",
    "f1",
    "i-20",
    "i20",
    "student visa",
    "language school",
    "programacao a noite",
    "mestrado",
    "doutorado",
    "phd",
    "graduacao",
    "bachelor",
    "undergrad",
    "campus",
  ];
  if (hasAny(studyTerms)) return "study";

  // TRABALHO
  const workTerms = [
    "trabalhar",
    "trabalho",
    "emprego",
    "empregador",
    "job offer",
    "oferta de trabalho",
    "contrato de trabalho",
    "h-1b",
    "h1b",
    "l-1",
    "l1",
    "o-1",
    "o1",
  ];
  if (hasAny(workTerms)) return "work";

  // NEGÓCIOS
  const businessTerms = [
    "negocio",
    "negocios",
    "reuniao",
    "feira",
    "conference",
    "meeting",
    "visita a clientes",
    "b-1",
    "b1",
    "workshop corporativo",
    "treinamento corporativo",
  ];
  if (hasAny(businessTerms)) return "business";

  // TURISMO
  const tourismTerms = [
    "turismo",
    "turista",
    "passear",
    "visitar",
    "lazer",
    "parques",
    "museus",
    "jogos de basquete",
    "sightseeing",
    "b-2",
    "b2",
    "holiday",
    "vacation",
  ];
  if (hasAny(tourismTerms)) return "tourism";

  return undefined;
}

/**
 * Sanitiza objeto “parecido” com ExtractFacts:
 * - remove nulls
 * - normaliza strings (trim/vazio -> omit)
 * - normaliza números (coerce string/float para inteiro >= 0)
 * - normaliza booleanos
 * - mantém só chaves esperadas
 * - força `purpose` a estar no conjunto permitido; valores fora viram `undefined`
 */
function sanitizeFactsLike(input: unknown): Partial<ExtractFacts> {
  const obj = isObj(input) ? (input as any) : {};

  const personalIn = isObj(obj.personal) ? obj.personal : {};
  const personal = pickStringObject(personalIn, ["full_name", "nationality", "date_of_birth"]);

  const purpose = normalizePurposeStrict(obj.purpose);
  const education = strOrUndef(obj.education);
  const work_experience_years = normalizeYears(obj.work_experience_years);
  const has_us_sponsor = boolOrUndef(obj.has_us_sponsor);

  const out: Partial<ExtractFacts> = {
    personal,
    purpose,
    education,
    work_experience_years,
    has_us_sponsor,
  };

  // remove chaves indefinidas
  Object.keys(out).forEach((k) => {
    if ((out as any)[k] === undefined) delete (out as any)[k];
  });

  // remove personal vazio
  if (out.personal && Object.keys(out.personal).length === 0) {
    delete out.personal;
  }

  return out;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function strOrUndef(v: unknown): string | undefined {
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : undefined;
  }
  return undefined;
}

function pickStringObject(src: unknown, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(src)) return out;
  for (const k of keys) {
    const val = (src as any)[k];
    const s = strOrUndef(val);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

/** Restringe AO CONJUNTO permitido; fora disso -> undefined. Usa fold() para comparar. */
function normalizePurposeStrict(v: unknown): ExtractFacts["purpose"] | undefined {
  const s = typeof v === "string" ? fold(v) : "";

  // mapeia sinônimos/variações para o conjunto estrito (apenas ASCII)
  const map: Record<string, ExtractFacts["purpose"]> = {
    // study
    study: "study",
    estudante: "study",
    estudo: "study",
    curso: "study",
    faculdade: "study",
    universidade: "study",
    college: "study",
    escola: "study",

    // work
    work: "work",
    trabalho: "work",
    trabalhar: "work",
    emprego: "work",

    // business
    business: "business",
    negocios: "business",
    reuniao: "business",
    meeting: "business",
    conference: "business",

    // tourism
    tourism: "tourism",
    turista: "tourism",
    turismo: "tourism",
    viagem: "tourism",
    visitar: "tourism",
    lazer: "tourism",

    // immigration
    immigration: "immigration",
    migracao: "immigration",
    imigracao: "immigration",
    imigrar: "immigration",
    "mudar de pais": "immigration",
    "morar nos estados unidos": "immigration",
    "residencia permanente": "immigration",
    "green card": "immigration",
  };

  // match exato após fold
  if (map[s]) return map[s];

  // heurística curta: palavra-chave contida (após fold)
  if (s.includes("immigration")) return "immigration";
  if (s.includes("study")) return "study";
  if (s.includes("work")) return "work";
  if (s.includes("business")) return "business";
  if (s.includes("tourism")) return "tourism";

  // qualquer outra coisa (incl. "other", "transit") => undefined
  return undefined;
}

function normalizeYears(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d+)([\.,]\d+)?$/);
    if (m) return Math.max(0, Math.floor(Number(m[1])));
    const m2 = v.toLowerCase().match(/(\d+)\s*anos?/);
    if (m2) return Math.max(0, Math.floor(Number(m2[1])));
  }
  return undefined;
}

function boolOrUndef(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = fold(v);
    if (["true", "yes", "sim", "y", "1"].includes(s)) return true;
    if (["false", "no", "nao", "não", "n", "0"].includes(s)) return false;
  }
  return undefined;
}
