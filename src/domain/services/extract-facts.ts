// src/domain/services/extract-facts.ts
import { callJSON } from "@/lib/openai";
import { ExtractFactsSchema, type ExtractFacts } from "@/domain/schemas/extract-facts.schema";

/**
 * Extraction pipeline (enriched schema = PRINCIPAL):
 * 1) Rejeita entradas triviais (evita respostas repetidas com texto vazio).
 * 2) Aplica heurística local p/ sugerir "purpose" ao modelo (hint não-vinculante).
 * 3) Pede JSON estrito ao modelo (sem prose, sem null).
 * 4) Pós-processa: remove null/vazios, normaliza tipos/enum e valida no Zod.
 * 5) Se a heurística for mais forte que o "purpose" do modelo, sobrescreve.
 */
export async function extractFacts(rawText: string | null | undefined): Promise<ExtractFacts> {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  // 1) Guarda: texto mínimo
  if (text.length < 20) {
    console.warn("[extractFacts] Rejected: raw_text too short.", { len: text.length, sample: text.slice(0, 60) });
    throw new Error("Submission text is too short for extraction.");
  }

  // 2) Heurística local (dá um empurrão no modelo, mas não obriga)
  const hint = hardInferPurpose(text); // "immigration" | "study" | "work" | "business" | "tourism" | undefined

  const system = [
    "Você é um extrator de fatos para elegibilidade de vistos dos EUA.",
    "Responda APENAS em JSON válido, sem explicações nem texto fora do objeto.",
    "Formato OBRIGATÓRIO do objeto:",
    "{",
    '  "personal": { "full_name": string?, "nationality": string?, "date_of_birth": string? },',
    '  "purpose": "study" | "work" | "business" | "tourism" | "immigration",',
    '  "education": string?,',
    '  "work_experience_years": number?,',
    '  "has_us_sponsor": boolean?,',
    '  "signals": {',
    '     "field_of_expertise": string?,',
    '     "has_job_offer": boolean?,',
    '     "job_offer_details": { "position": string?, "industry": string?, "salary_usd_year": number?, "employer_size": string?, "is_multinational": boolean? }?,',
    '     "extraordinary_evidence": { "awards": string[]?, "media_mentions": number?, "conference_speaking": boolean?, "peer_review_jury": boolean?, "original_contributions": string? }?,',
    '     "niw_prongs": { "national_importance": string?, "well_positioned": string?, "benefit_outweighs_labor_cert": string? }?,',
    '     "perm_readiness": { "occupation": string?, "degree_requirement": string?, "prevailing_wage_level": string? }?,',
    '     "chargeability_country": string?,',
    '     "treaty_eligible": { "e1": boolean?, "e2": boolean? }?,',
    '     "investment_capacity_usd": number?,',
    '     "multinational_experience_years": number?,',
    '     "portfolio_links": string[]?,',
    '     "english_level": string?,',
    '     "travel_history": string[]?,',
    '     "immigration_history": { "overstay_or_violations": boolean?, "prior_us_visas": string[]? }?,',
    '     "family_ties_us": { "immediate_relative_us_citizen": boolean? }?,',
    '     "entrepreneurship": { "owns_business": boolean?, "business_details": string? }?',
    "  }?",
    "}",
    "Regras IMPORTANTES:",
    '- O campo "purpose" deve ser um entre: "study" | "work" | "business" | "tourism" | "immigration".',
    "- Nunca use null; se não souber, omita o campo.",
    "- Números devem ser número JSON; booleanos devem ser boolean JSON.",
    "- Não assuma 'tourism' por omissão; só use se o texto indicar lazer/visita.",
  ].join("\n");

  const user = {
    raw_text: text,
    purpose_hint: hint ?? null, // dica não-obrigatória
    goal: "Extrair fatos objetivos e sinais relevantes para classificação de visto.",
  };

  // 3) Chamada ao modelo (evita temperature em gpt-5*, que ignora/erra esse parâmetro)
  const model = process.env.OPENAI_MODEL || "gpt-5";
  const temperature = model.startsWith("gpt-5") ? undefined : 0.2;

  const raw = await callJSON<unknown>({
    system,
    user,
    model,
    temperature,
    // 4) Sanitiza antes de validar no Zod
    validate: (data) => ExtractFactsSchema.parse(postSanitize(data)),
    verboseLog: process.env.NODE_ENV !== "production",
    timeoutMs: Number(process.env.AI_TIMEOUT_EXTRACT_MS ?? 120_000),
    maxRetries: 0,
  });

  const facts = raw as ExtractFacts;

  // 5) Override determinístico do purpose quando a heurística for mais forte
  const inferred = hint;
  if (inferred && shouldOverridePurpose(facts.purpose, inferred)) {
    return { ...facts, purpose: inferred };
  }

  return facts;
}

/* =================== Helpers =================== */

function shouldOverridePurpose(modelPurpose: ExtractFacts["purpose"], inferred: ExtractFacts["purpose"]): boolean {
  if (!inferred) return false;
  if (modelPurpose === inferred) return false;
  return purposePriority(inferred) > purposePriority(modelPurpose ?? "tourism");
}

function purposePriority(p: NonNullable<ExtractFacts["purpose"]>): number {
  const prio: Record<NonNullable<ExtractFacts["purpose"]>, number> = {
    immigration: 5,
    study: 4,
    work: 3,
    business: 2,
    tourism: 1,
  };
  return prio[p] ?? 0;
}

/** ASCII fold (minimiza erros com acentos/maiúsculas). */
function fold(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Heurística determinística por palavras-chave (PT/EN). */
function hardInferPurpose(text: string): ExtractFacts["purpose"] | undefined {
  const f = fold(text);
  const hasAny = (terms: string[]) => terms.some((t) => f.includes(t));

  const immigrationTerms = [
    "morar nos estados unidos", "mudar de pais", "mudar para os eua",
    "migrar", "migracao", "imigrar", "imigracao", "residencia permanente",
    "green card", "ajuste de status", "residente permanente", "permanent resident",
  ];
  if (hasAny(immigrationTerms)) return "immigration";

  const studyTerms = [
    "estudar", "estudo", "curso", "faculdade", "universidade", "college", "escola",
    "matricula", "f-1", "f1", "i-20", "i20", "student visa", "language school",
    "programacao a noite", "mestrado", "doutorado", "phd", "graduacao", "bachelor",
    "undergrad", "campus",
  ];
  if (hasAny(studyTerms)) return "study";

  const workTerms = [
    "trabalhar", "trabalho", "emprego", "empregador", "job offer", "oferta de trabalho",
    "contrato de trabalho", "h-1b", "h1b", "l-1", "l1", "o-1", "o1",
  ];
  if (hasAny(workTerms)) return "work";

  const businessTerms = [
    "negocio", "negocios", "reuniao", "feira", "conference", "meeting", "visita a clientes",
    "b-1", "b1", "workshop corporativo", "treinamento corporativo",
  ];
  if (hasAny(businessTerms)) return "business";

  const tourismTerms = [
    "turismo", "turista", "passear", "visitar", "lazer", "parques", "museus",
    "jogos de basquete", "sightseeing", "b-2", "b2", "holiday", "vacation",
  ];
  if (hasAny(tourismTerms)) return "tourism";

  return undefined;
}

/* ---------- Sanitização pós-modelo (antes do Zod) ---------- */

function postSanitize(input: unknown): Partial<ExtractFacts> {
  const obj = isObj(input) ? input as any : {};

  // personal
  const personalIn = isObj(obj.personal) ? obj.personal : {};
  const personal = pickStringObject(personalIn, ["full_name", "nationality", "date_of_birth"]);
  if (personal && Object.keys(personal).length === 0) delete (obj as any).personal;
  else obj.personal = personal;

  // purpose (normaliza variações PT/EN para enum canônico)
  const normalizedPurpose = normalizePurposeStrict(obj.purpose);
  if (normalizedPurpose) obj.purpose = normalizedPurpose;
  else delete obj.purpose;

  // campos simples
  const education = toStrOrUndef(obj.education);
  if (education) obj.education = education; else delete obj.education;

  const years = toYears(obj.work_experience_years);
  if (years !== undefined) obj.work_experience_years = years;
  else delete obj.work_experience_years;

  const sponsor = toBool(obj.has_us_sponsor);
  if (sponsor !== undefined) obj.has_us_sponsor = sponsor;
  else delete obj.has_us_sponsor;

  // signals (coerções internas)
  if (isObj(obj.signals)) {
    const s = obj.signals as any;

    s.field_of_expertise = toStrOrUndef(s.field_of_expertise);

    s.has_job_offer = toBool(s.has_job_offer);
    if (isObj(s.job_offer_details)) {
      const j = s.job_offer_details as any;
      j.position = toStrOrUndef(j.position);
      j.industry = toStrOrUndef(j.industry);
      j.salary_usd_year = toNumberOrUndef(j.salary_usd_year);
      j.employer_size = toStrOrUndef(j.employer_size);
      j.is_multinational = toBool(j.is_multinational);
      pruneEmpty(j);
      if (Object.keys(j).length === 0) delete s.job_offer_details;
    }

    if (isObj(s.extraordinary_evidence)) {
      const e = s.extraordinary_evidence as any;
      e.awards = toStringArray(e.awards);
      e.media_mentions = toIntOrUndef(e.media_mentions);
      e.conference_speaking = toBool(e.conference_speaking);
      e.peer_review_jury = toBool(e.peer_review_jury);
      e.original_contributions = toStrOrUndef(e.original_contributions);
      pruneEmpty(e);
      if (Object.keys(e).length === 0) delete s.extraordinary_evidence;
    }

    if (isObj(s.niw_prongs)) {
      const n = s.niw_prongs as any;
      n.national_importance = toStrOrUndef(n.national_importance);
      n.well_positioned = toStrOrUndef(n.well_positioned);
      n.benefit_outweighs_labor_cert = toStrOrUndef(n.benefit_outweighs_labor_cert);
      pruneEmpty(n);
      if (Object.keys(n).length === 0) delete s.niw_prongs;
    }

    if (isObj(s.perm_readiness)) {
      const p = s.perm_readiness as any;
      p.occupation = toStrOrUndef(p.occupation);
      p.degree_requirement = toStrOrUndef(p.degree_requirement);
      p.prevailing_wage_level = toStrOrUndef(p.prevailing_wage_level);
      pruneEmpty(p);
      if (Object.keys(p).length === 0) delete s.perm_readiness;
    }

    s.chargeability_country = toStrOrUndef(s.chargeability_country);

    if (isObj(s.treaty_eligible)) {
      const t = s.treaty_eligible as any;
      t.e1 = toBool(t.e1);
      t.e2 = toBool(t.e2);
      pruneEmpty(t);
      if (Object.keys(t).length === 0) delete s.treaty_eligible;
    }

    s.investment_capacity_usd = toNumberOrUndef(s.investment_capacity_usd);
    s.multinational_experience_years = toIntOrUndef(s.multinational_experience_years);
    s.portfolio_links = toStringArray(s.portfolio_links);
    s.english_level = toStrOrUndef(s.english_level);
    s.travel_history = toStringArray(s.travel_history);

    if (isObj(s.immigration_history)) {
      const ih = s.immigration_history as any;
      ih.overstay_or_violations = toBool(ih.overstay_or_violations);
      ih.prior_us_visas = toStringArray(ih.prior_us_visas);
      pruneEmpty(ih);
      if (Object.keys(ih).length === 0) delete s.immigration_history;
    }

    if (isObj(s.family_ties_us)) {
      const ft = s.family_ties_us as any;
      ft.immediate_relative_us_citizen = toBool(ft.immediate_relative_us_citizen);
      pruneEmpty(ft);
      if (Object.keys(ft).length === 0) delete s.family_ties_us;
    }

    if (isObj(s.entrepreneurship)) {
      const en = s.entrepreneurship as any;
      en.owns_business = toBool(en.owns_business);
      en.business_details = toStrOrUndef(en.business_details);
      pruneEmpty(en);
      if (Object.keys(en).length === 0) delete s.entrepreneurship;
    }

    pruneEmpty(s);
    if (Object.keys(s).length === 0) delete obj.signals;
  } else {
    delete obj.signals;
  }

  // remove nulls/undefined/strings vazias recursivamente
  const cleaned = stripNulls(obj);
  return cleaned as Partial<ExtractFacts>;
}

/* ---------- pequenas utilidades ---------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function toStrOrUndef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

function toNumberOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toIntOrUndef(v: unknown): number | undefined {
  const n = toNumberOrUndef(v);
  if (n === undefined) return undefined;
  return Math.max(0, Math.floor(n));
}

function toYears(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d+)([\.,]\d+)?$/);
    if (m) return Math.max(0, Math.floor(Number(m[1].replace(",", "."))));
    const m2 = v.toLowerCase().match(/(\d+)\s*anos?/);
    if (m2) return Math.max(0, Math.floor(Number(m2[1])));
  }
  return undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = fold(v);
    if (["true", "yes", "sim", "y", "1"].includes(s)) return true;
    if (["false", "no", "nao", "não", "n", "0"].includes(s)) return false;
  }
  return undefined;
}

function toStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((s) => s.length > 0);
  return arr.length ? arr : undefined;
}

function pickStringObject(src: unknown, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(src)) return out;
  for (const k of keys) {
    const s = toStrOrUndef((src as any)[k]);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

/** Normaliza purpose para o conjunto aceito; variações PT/EN viram os 5 valores canônicos. */
function normalizePurposeStrict(v: unknown): ExtractFacts["purpose"] | undefined {
  const s = typeof v === "string" ? fold(v) : "";
  const map: Record<string, ExtractFacts["purpose"]> = {
    // study
    study: "study", estudante: "study", estudo: "study", curso: "study",
    faculdade: "study", universidade: "study", college: "study", escola: "study",

    // work
    work: "work", trabalho: "work", trabalhar: "work", emprego: "work",

    // business
    business: "business", negocios: "business", reuniao: "business", meeting: "business", conference: "business",

    // tourism
    tourism: "tourism", turista: "tourism", turismo: "tourism", viagem: "tourism", visitar: "tourism", lazer: "tourism",

    // immigration
    immigration: "immigration", migracao: "immigration", imigracao: "immigration", imigrar: "immigration",
    "mudar de pais": "immigration", "morar nos estados unidos": "immigration", "residencia permanente": "immigration",
    "green card": "immigration",
  };
  if (map[s]) return map[s];

  if (s.includes("immigration")) return "immigration";
  if (s.includes("study")) return "study";
  if (s.includes("work")) return "work";
  if (s.includes("business")) return "business";
  if (s.includes("tourism")) return "tourism";
  return undefined;
}

/** Remove null/undefined/"" recursivamente. */
function stripNulls<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripNulls) as any;
  if (isObj(v)) {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === null || val === undefined) continue;
      const vv = stripNulls(val as any);
      if (vv === "" || vv === null || vv === undefined) continue;
      out[k] = vv;
    }
    return out;
  }
  return v;
}

/** Remove chaves vazias de um objeto mutavelmente. */
function pruneEmpty(o: any) {
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === null || v === undefined) { delete o[k]; continue; }
    if (typeof v === "string" && v.trim().length === 0) { delete o[k]; continue; }
    if (Array.isArray(v) && v.length === 0) { delete o[k]; continue; }
    if (isObj(v) && Object.keys(v).length === 0) { delete o[k]; continue; }
  }
}
