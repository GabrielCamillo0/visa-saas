// src/domain/services/generate-questions.ts
import { callJSON } from "@/lib/openai";
import type { ExtractFacts } from "@/domain/schemas/extract-facts.schema";

type Candidate = { visa: string; confidence?: number; rationale?: string };
type Classification = { candidates?: Candidate[]; selected?: string | null };

export type QuestionPayload = string[] | { questions?: unknown };

export type GenerateQOpts = {
  maxQuestions?: number;     // default 10 (qualidade > quantidade)
  minQuestions?: number;     // default 5
  language?: "pt" | "en";    // default "pt"
};

function resolveModel(): string {
  const m = process.env.OPENAI_MODEL?.trim();
  return m && m.length > 0 ? m : "gpt-5";
}
function supportsTemperature(model: string): boolean {
  return !/^gpt-5\b/i.test(model);
}

/**
 * Gera perguntas específicas e evita repetir o que já foi respondido no formulário.
 * - Min 10 perguntas (configurável), máx 14.
 * - Filtra por “já respondido” usando flags derivadas de `facts` e `facts.signals`.
 * - Se faltar quantidade, completa com fallback sem duplicar/contradizer o que já sabemos.
 */
export async function generateValidationQuestions(
  facts: ExtractFacts,
  classification: Classification,
  opts?: GenerateQOpts
): Promise<{ questions: string[] }> {
  const lang: "pt" | "en" = opts?.language ?? "pt";
  const minQ = Math.max(1, opts?.minQuestions ?? 5);
  const maxQ = Math.max(minQ, opts?.maxQuestions ?? 10);

  const purpose = (facts?.purpose ?? "").toString().toLowerCase();
  const signals = (facts as any)?.signals ?? undefined;

  // ===== Known flags extracted from facts =====
  const flags = buildKnownFlags(facts);

  // Top candidates (até 6)
  const ranked = Array.isArray(classification?.candidates)
    ? [...classification.candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    : [];
  const top = ranked.slice(0, 6);

  const model = resolveModel();
  const temperature = supportsTemperature(model) ? 0.25 : undefined; // mais consistente para perguntas alinhadas aos critérios

  const sys = [
    "Você é um analista de elegibilidade de vistos dos EUA. Gere perguntas de validação que preencham LACUNAS nos dados do candidato.",
    "",
    "REGRAS OBRIGATÓRIAS:",
    "1. Gere perguntas APENAS para os vistos que estão em 'top_candidates'. NÃO pergunte sobre vistos que não estejam na lista de candidatos.",
    "2. Cada pergunta deve ser decisiva para UM dos vistos em top_candidates e cuja resposta ainda NÃO esteja em 'facts' ou 'known_flags'. Não repita o que já foi respondido.",
    "3. Início de CADA pergunta: código do visto entre colchetes, ex.: [EB2_NIW], [E2], [H1B], [L1], [O1], [EB5], [DV], [F1], [B2], [K1], [IR1].",
    `4. Idioma: ${lang === "pt" ? "português" : "inglês"}. Uma pergunta por item; sem numeração; só JSON.`,
    `5. Gere entre ${minQ} e ${maxQ} perguntas. Prefira perguntas de ALTO impacto para os vistos candidatos.`,
    "6. Resposta: { \"questions\": [ \"...\", \"...\" ] }.",
    "",
    "CRITÉRIOS POR VISTO (pergunte só o que faltar e só para vistos em top_candidates):",
    "- EB2_NIW: impacto nacional, posicionamento, evidências (cartas, publicações, prêmios), dispensa de labor cert.",
    "- EB1A: extraordinária capacidade (prêmios, associações, papel crítico, autoria, salário alto).",
    "- EB1B/EB1C: pesquisador de destaque ou gerente/executivo multinacional; 1 ano na empresa no exterior (EB1C).",
    "- EB5: valor do investimento, origem lícita dos fundos, TEA vs investimento direto.",
    "- E2/E1: país do tratado, valor investido, risco e substancialidade, comércio substancial (E1).",
    "- H1B: grau exigido pelo cargo, correspondência formação–cargo, oferta do empregador.",
    "- L1: relação matriz/filial, 1 ano contínuo na empresa estrangeira, cargo e funções.",
    "- O1: evidências de extraordinária capacidade (prêmios, mídia, júri, contribuições).",
    "- DV: país de chargeability (nascimento), educação/experiência qualificada.",
    "- FAMILY/IR1/CR1/K1: parentesco com cidadão/LPR, documentos civis, status do peticionário.",
    "- F1/M1: plano de estudos, I-20, comprovação de fundos.",
    "- B1/B2: vínculos de retorno, itinerário, motivo da viagem.",
  ].join("\n");

  const user = {
    purpose,
    facts,
    signals,
    known_flags: flags,
    top_candidates: top,
    instruction:
      "Gere perguntas APENAS para vistos que estejam em top_candidates; cada pergunta deve preencher uma lacuna decisiva para um desses vistos e NÃO repetir facts/signals. Saída: { \"questions\": string[] }.",
  };

  let questions: string[] = [];
  try {
    const raw = await callJSON<QuestionPayload>({
      system: sys,
      user,
      model,
      ...(typeof temperature === "number" ? { temperature } : {}),
      validate: (data): QuestionPayload => data as QuestionPayload,
      verboseLog: process.env.NODE_ENV !== "production",
      timeoutMs: Number(process.env.AI_TIMEOUT_QUESTIONS_MS ?? 90_000),
      maxRetries: 0,
    });

    // Normaliza e FILTRA por "já respondido"
    const rawQs = normalizeQuestions(raw, { maxQ });
    const filtered = rawQs.filter((q) => !isAlreadyAnswered(q, flags));
    questions = dedupe(filtered).slice(0, maxQ);
  } catch (e) {
    console.warn("[generate-questions] model failed, falling back:", e);
    questions = [];
  }

  // Se ainda faltam perguntas, completa com fallback sem repetir/colidir
  if (questions.length < minQ) {
    const need = minQ - questions.length;
    const fb = fallbackQuestions(facts, top, { minQ: need, maxQ: need, lang });
    const fbFiltered = fb.filter((q) => !isAlreadyAnswered(q, flags));
    questions = dedupe([...questions, ...fbFiltered]).slice(0, maxQ);
  }

  // Se AINDA faltar, adiciona perguntas de “profundidade documental” (não repetitivas)
  if (questions.length < minQ) {
    const pads = depthQuestions(top, lang).filter(
      (q) => !isAlreadyAnswered(q, flags) && !questions.some((x) => eqi(x, q))
    );
    questions = dedupe([...questions, ...pads]).slice(0, maxQ);
  }

  return { questions };
}

/* -------------------- Flags conhecidas a partir de facts -------------------- */
/** Produz um mapa simples de “já respondido” a partir de facts/signals. */
function buildKnownFlags(facts: ExtractFacts) {
  const s = (facts as any)?.signals || {};
  const personal = (facts as any)?.personal || {};

  const has = (v: any) => v === true || v === "true" || v === 1;

  const flags = {
    // genéricos
    has_sponsor: !!facts?.has_us_sponsor || has(s.has_us_sponsor) || has(s.has_sponsor) || !!s.job_offer,
    job_offer: !!s.job_offer,
    degree_level: (facts as any)?.education ? String((facts as any).education).toLowerCase() : undefined,
    years_exp: Number.isFinite((facts as any)?.work_experience_years) ? (facts as any).work_experience_years : undefined,
    nationality: (personal?.nationality ? String(personal.nationality).toLowerCase() : undefined),
    country_of_birth: s.country_of_birth || personal?.country_of_birth || undefined,

    // F-1 / M-1
    has_i20: has(s.has_i20),
    has_funding: has(s.has_funding) || !!s.funding_amount,

    // EB-5
    eb5_budget: s.eb5_budget ?? s.investment_amount ?? undefined,
    has_lawful_source_docs: has(s.lawful_source_docs),

    // E-2 / E-1
    e2_treaty_passport_country: s.e2_treaty_passport_country || s.treaty_country || undefined,
    e2_invest_amount: s.e2_invest_amount || s.investment_amount || undefined,

    // DV
    dv_eligible_hint: has(s.dv_eligible) || !!s.dv_country_eligible,

    // O-1
    o1_evidence: has(s.o1_awards) || has(s.media_coverage) || has(s.judging) || has(s.major_contributions),

    // L-1
    l1_one_year: has(s.l1_one_year),
    l1_qualifying_relationship: has(s.l1_qualifying_relationship),
  };

  return flags;
}

/* -------------------- Normalização / filtros -------------------- */

function normalizeQuestions(input: QuestionPayload, cfg: { maxQ: number }): string[] {
  let arr: string[] = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (input && Array.isArray((input as any).questions)) {
    arr = (input as any).questions as string[];
  }
  return (arr || [])
    .map((q) => (typeof q === "string" ? q.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, cfg.maxQ);
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of arr) {
    const k = q.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(q);
    }
  }
  return out;
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function eqi(a: string, b: string) {
  return fold(a) === fold(b);
}

/** Heurística leve: se a pergunta trata de um tópico já confirmado nos flags, pulamos. */
function isAlreadyAnswered(question: string, f: ReturnType<typeof buildKnownFlags>): boolean {
  const q = fold(question);

  // F-1: I-20 / funding
  if (/\b(f-1|f1)\b.*\b(i[-\s]?20|sevp)/.test(q) && f.has_i20) return true;
  if (/\b(f-1|f1)\b.*\b(funding|recursos|comprovante|financial)/.test(q) && f.has_funding) return true;

  // EB-5: orçamento / origem lícita
  if (/\beb[-\s_]?5\b/.test(q) && /\b(800|1\.05|1,05|investimento|budget|origem licita|source of funds)\b/.test(q)) {
    if (f.eb5_budget || f.has_lawful_source_docs) return true;
  }

  // E-2 / E-1: passaporte de país com tratado / valor investimento
  if (/\be[-\s_]?2\b/.test(q) && /\b(passaporte|treaty|tratado|pais)\b/.test(q) && !!f.e2_treaty_passport_country) {
    return true;
  }
  if (/\be[-\s_]?2\b/.test(q) && /\b(invest|investir|valor|montante|amount)\b/.test(q) && !!f.e2_invest_amount) {
    return true;
  }

  // DV: país de nascimento / elegibilidade
  if (/\bdv\b|diversity/.test(q) && (f.country_of_birth || f.dv_eligible_hint)) {
    return true;
  }

  // H-1B / PERM / sponsor / job offer
  if (/\b(h[-\s_]?1b|perm|job offer|oferta de emprego|empregador|peticionar|sponsor)\b/.test(q) && (f.has_sponsor || f.job_offer)) {
    return true;
  }

  // O-1: evidências marcantes
  if (/\bo[-\s_]?1\b/.test(q) && /\b(pr[êe]mio|award|m[ií]dia|media|j[úu]ri|judging|extraordinary|impact)\b/.test(q) && f.o1_evidence) {
    return true;
  }

  // L-1: 1 ano / relação qualificada
  if (/\bl[-\s_]?1\b/.test(q) && /\b(1 ano|one year)\b/.test(q) && f.l1_one_year) return true;
  if (/\bl[-\s_]?1\b/.test(q) && /\b(relacao|relação|qualifying|mesmo grupo|grupo empresarial)\b/.test(q) && f.l1_qualifying_relationship) {
    return true;
  }

  // Genérico sponsor
  if (/\b(requires sponsor|sponsor|empregador|job offer)\b/.test(q) && (f.has_sponsor || f.job_offer)) return true;

  return false;
}

/* -------------------- Fallbacks e padding -------------------- */

type FBFn = (facts: ExtractFacts, push: (q: string) => void, lang: "pt" | "en") => void;

const PER_VISA_FALLBACK: Record<string, FBFn> = {
  EB2_NIW: (facts, push, lang) => {
    const p = (s: string) => push(`[EB2_NIW] ${s}`);
    p(lang === "pt"
      ? "Quais evidências de impacto você possui (publicações, liderança, prêmios, patentes, impacto comercial, cartas independentes)?"
      : "Which impact evidence can you provide (publications, leadership, awards, patents, commercial impact, independent letters)?");
    p(lang === "pt"
      ? "Qual é o plano de atuação nos EUA e por que tem mérito e importância nacionais (setor, problema, benefício)?"
      : "What is your U.S. proposed endeavor and why is it nationally important (sector, problem, benefit)?");
    p(lang === "pt"
      ? "Que recursos e rede você possui para avançar o plano (parcerias, clientes, funding, tração)?"
      : "What resources and network do you have to advance the endeavor (partners, customers, funding, traction)?");
  },
  EB5: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB5] ${s}`);
    p(lang === "pt"
      ? "Você pretende investir via centro regional (TEA) ou investimento direto com criação de 10 empregos?"
      : "Will you pursue a regional center (TEA) or direct investment creating 10 jobs?");
    p(lang === "pt"
      ? "Você já possui documentação para comprovar a origem lícita dos recursos (impostos, extratos, contratos)?"
      : "Do you have documentation to prove the lawful source of funds (tax returns, bank statements, contracts)?");
  },
  E2: (_facts, push, lang) => {
    const p = (s: string) => push(`[E2] ${s}`);
    p(lang === "pt"
      ? "O investimento será em negócio novo ou aquisição, e qual o plano operacional (funções, contratos, projeções)?"
      : "Is the investment for a new venture or acquisition, and what is the operational plan (roles, contracts, projections)?");
    p(lang === "pt"
      ? "Como você demonstrará risco e substancialidade do investimento (compromisso irrevogável dos fundos, despesas já realizadas)?"
      : "How will you demonstrate investment at risk and substantiality (irrevocable commitment of funds, expenses already made)?");
  },
  E1: (_facts, push, lang) => {
    const p = (s: string) => push(`[E1] ${s}`);
    p(lang === "pt"
      ? "Há fluxo substancial de comércio principal entre o país do tratado e os EUA (percentual aproximado e volume)?"
      : "Is there substantial trade principally between the treaty country and the U.S. (approximate share and volume)?");
  },
  DV: (_facts, push, lang) => {
    const p = (s: string) => push(`[DV] ${s}`);
    p(lang === "pt"
      ? "Você atende aos requisitos de escolaridade (ensino médio) ou experiência qualificada conforme as regras da DV?"
      : "Do you meet the education (high school) or qualifying work experience requirements under DV rules?");
  },
  O1: (_facts, push, lang) => {
    const p = (s: string) => push(`[O1] ${s}`);
    p(lang === "pt"
      ? "Quais critérios O-1 você cumpre hoje (prêmio de grande prestígio, matérias relevantes, liderança, júri, autoria, salário alto)?"
      : "Which O-1 criteria do you meet (major awards, notable media, leadership, judging, authorship, high salary)?");
  },
  H1B: (_facts, push, lang) => {
    const p = (s: string) => push(`[H1B] ${s}`);
    p(lang === "pt"
      ? "A ocupação exige bacharel específico e sua formação corresponde ao requisito do cargo?"
      : "Does the role require a specific bachelor's and does your education match that requirement?");
  },
  L1: (_facts, push, lang) => {
    const p = (s: string) => push(`[L1] ${s}`);
    p(lang === "pt"
      ? "Qual a relação entre as empresas (matriz/filial/afiliada) e qual seu cargo e responsabilidades nos últimos 3 anos?"
      : "What is the relationship between entities (parent/sub/affiliate) and your role & duties in the last 3 years?");
  },
  FAMILY: (_facts, push, lang) => {
    const p = (s: string) => push(`[FAMILY] ${s}`);
    p(lang === "pt"
      ? "Qual o grau de parentesco com o cidadão/residente e que documentos civis você possui para comprovar?"
      : "What is the relationship to the citizen/LPR and which civil documents do you have to prove it?");
  },
  IR1: (_facts, push, lang) => {
    const p = (s: string) => push(`[IR1] ${s}`);
    p(lang === "pt"
      ? "O cônjuge é cidadão americano e o casamento já tem mais de 2 anos? Quais documentos civis você tem (certidão, prova de relacionamento)?"
      : "Is your spouse a U.S. citizen and has the marriage lasted over 2 years? What civil documents do you have (certificate, relationship evidence)?");
  },
  CR1: (_facts, push, lang) => {
    const p = (s: string) => push(`[CR1] ${s}`);
    p(lang === "pt"
      ? "O cônjuge é cidadão americano e o casamento tem menos de 2 anos? Há prova de relacionamento bona fide (fotos, viagens, contas conjuntas)?"
      : "Is your spouse a U.S. citizen and has the marriage been under 2 years? Do you have bona fide relationship evidence (photos, trips, joint accounts)?");
  },
  K1: (_facts, push, lang) => {
    const p = (s: string) => push(`[K1] ${s}`);
    p(lang === "pt"
      ? "Você e o(a) noivo(a) cidadão(ã) americano(a) se encontraram pessoalmente nos últimos 2 anos? Há evidências do relacionamento (fotos, mensagens, intenção de casar)?"
      : "Have you and your U.S. citizen fiancé(e) met in person in the last 2 years? Do you have relationship evidence (photos, messages, intent to marry)?");
  },
  EB1A: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB1A] ${s}`);
    p(lang === "pt"
      ? "Quais critérios de extraordinária capacidade você atende (prêmio major, associação, papel crítico, autoria, contribuição, salário alto)?"
      : "Which extraordinary ability criteria do you meet (major award, association, critical role, authorship, contribution, high salary)?");
  },
  EB1B: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB1B] ${s}`);
    p(lang === "pt"
      ? "O empregador nos EUA é universidade ou instituição de pesquisa e você tem ao menos 3 anos de experiência em pesquisa/ensino?"
      : "Is the U.S. employer a university or research institution and do you have at least 3 years of research/teaching experience?");
  },
  EB1C: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB1C] ${s}`);
    p(lang === "pt"
      ? "Você trabalhou 1 ano nos últimos 3 como gerente/executivo na empresa no exterior e a entidade nos EUA existe há pelo menos 1 ano?"
      : "Have you worked 1 year in the last 3 as manager/executive in the foreign entity and has the U.S. entity existed for at least 1 year?");
  },
  B2: (_facts, push, lang) => {
    const p = (s: string) => push(`[B2] ${s}`);
    p(lang === "pt"
      ? "Quais vínculos (emprego, estudos, família, patrimônio) e fundos você pode demonstrar para comprovar retorno?"
      : "Which ties (job, studies, family, assets) and funds can you show to evidence your return?");
  },
  B1: (_facts, push, lang) => {
    const p = (s: string) => push(`[B1] ${s}`);
    p(lang === "pt"
      ? "Quais atividades de negócio pretende realizar e quais convites/agenda já possui?"
      : "Which business activities will you perform and which invitations/agenda do you already have?");
  },
  F1: (_facts, push, lang) => {
    const p = (s: string) => push(`[F1] ${s}`);
    p(lang === "pt"
      ? "Qual o plano acadêmico (curso, campus, duração) e como comprovará recursos suficientes para o período?"
      : "What is your academic plan (program, campus, duration) and how will you evidence sufficient funds?");
  },
  M1: (_facts, push, lang) => {
    const p = (s: string) => push(`[M1] ${s}`);
    p(lang === "pt"
      ? "O curso é vocacional reconhecido e há recursos/vínculos para retorno ao término?"
      : "Is it a recognized vocational program and do you have funds/ties to return upon completion?");
  },
  J1: (_facts, push, lang) => {
    const p = (s: string) => push(`[J1] ${s}`);
    p(lang === "pt"
      ? "Há sponsor (DS-2019) e você está ciente da possível exigência de 2 anos no país de origem (§212(e))?"
      : "Do you have a program sponsor (DS-2019) and are you aware of the possible 2-year home requirement (§212(e))?");
  },
  EB2_PERM: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB2_PERM] ${s}`);
    p(lang === "pt"
      ? "O empregador concorda com PERM e os requisitos do cargo são compatíveis com seu grau e experiência?"
      : "Will the employer run PERM and do the job requirements match your degree/experience?");
  },
  EB3: (_facts, push, lang) => {
    const p = (s: string) => push(`[EB3] ${s}`);
    p(lang === "pt"
      ? "A posição é 'skilled/professional' e o empregador compreende prazos/custos do processo?"
      : "Is the role 'skilled/professional' and does the employer understand timelines/costs of the process?");
  },
};

function fallbackQuestions(
  facts: ExtractFacts,
  top: Candidate[],
  cfg: { minQ: number; maxQ: number; lang: "pt" | "en" }
): string[] {
  const qs: string[] = [];
  const push = (q: string) => {
    const t = q.replace(/\s+/g, " ").trim();
    if (!t) return;
    if (!qs.some((x) => eqi(x, t)) && qs.length < cfg.maxQ) qs.push(t);
  };

  for (const c of top) {
    const fn = PER_VISA_FALLBACK[c.visa?.toUpperCase()];
    if (fn) fn(facts, push, cfg.lang);
    if (qs.length >= cfg.maxQ) break;
  }

  // Garantir mínimo
  while (qs.length < cfg.minQ) {
    push(
      cfg.lang === "pt"
        ? "[EB2_NIW/O1] Você possui cartas de especialistas independentes que atestem seu impacto e qualificação?"
        : "[EB2_NIW/O1] Do you have independent expert letters attesting to your impact and qualifications?"
    );
    if (qs.length >= cfg.minQ) break;
    push(
      cfg.lang === "pt"
        ? "[E2/EB5] Você já dispõe de documentação robusta para comprovar a origem lícita dos recursos?"
        : "[E2/EB5] Do you already have robust documentation to prove lawful source of funds?"
    );
    if (qs.length >= cfg.minQ) break;
    push(
      cfg.lang === "pt"
        ? "[DV] Há alguma estratégia de chargeability via cônjuge/pais que aumente elegibilidade?"
        : "[DV] Is there any chargeability strategy via spouse/parents that increases eligibility?"
    );
  }

  return qs.slice(0, cfg.maxQ);
}

/** Perguntas de “profundidade” que normalmente não duplicam uma confirmação binária. */
function depthQuestions(top: Candidate[], lang: "pt" | "en"): string[] {
  const out: string[] = [];
  const push = (q: string) => { if (!out.some((x) => eqi(x, q))) out.push(q); };

  if (top.some((c) => c.visa === "EB2_NIW")) {
    push(
      lang === "pt"
        ? "[EB2_NIW] Quais métricas objetivas você pode anexar ao plano (KPIs, cartas de apoio institucionais, pilotos, MOUs)?"
        : "[EB2_NIW] Which objective metrics can you attach to the plan (KPIs, institutional support letters, pilots, MOUs)?"
    );
  }
  if (top.some((c) => c.visa === "E2")) {
    push(
      lang === "pt"
        ? "[E2] Você possui contratos preliminares, plano financeiro e cronograma de despesas que demonstram comprometimento substancial?"
        : "[E2] Do you have preliminary contracts, a financial plan, and spending timeline showing substantial commitment?"
    );
  }
  if (top.some((c) => c.visa === "EB5")) {
    push(
      lang === "pt"
        ? "[EB5] Você já avaliou o risco/regulatório do projeto (regional center vs. direto) e possui advogado/assessor financeiro definidos?"
        : "[EB5] Have you evaluated project risk/regulatory (regional center vs. direct) and do you have legal/financial advisors engaged?"
    );
  }
  if (top.some((c) => c.visa === "B2")) {
    push(
      lang === "pt"
        ? "[B2] Há documentação de vínculos (emprego/estudos/patrimônio) e reservas que sustentem o itinerário?"
        : "[B2] Do you have documentation of ties (job/studies/assets) and reservations supporting the itinerary?"
    );
  }
  return out;
}
