// src/domain/services/finalize-decision.ts
import { callJSON } from "@/lib/openai";
import { FinalDecisionSchema, type FinalDecision } from "@/domain/schemas/final-decision.schema";

const OFFICIAL_LINKS = [
  "DS-160 (visto não imigrante): https://ceac.state.gov/genniv/",
  "Agendar entrevista / USTravelDocs: https://www.ustraveldocs.com/",
  "Formulários USCIS: https://www.uscis.gov/forms",
  "CEAC (imigrantes / NVC): https://ceac.state.gov/",
  "Diversity Visa (DV): https://dvlottery.state.gov/",
  "I-20 (F-1): emitido pela instituição de ensino",
  "Pagamento de taxa de visto (MRV): https://www.ustraveldocs.com/",
];

const CONFIDENCE_THRESHOLD_NO_VISA = 0.4; // abaixo disso = não se enquadra em nenhum visto

function getBestConfidence(classification: unknown): number {
  const candidates = (classification as any)?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return 0;
  const confidences = candidates.map((c: any) => (typeof c.confidence === "number" ? c.confidence : 0));
  return Math.max(0, ...confidences);
}

export async function finalizeDecision(
  facts: Record<string, unknown>,
  answers: { answers: string[] } | string[] | null | undefined,
  classification?: unknown
): Promise<FinalDecision> {
  const bestConfidence = getBestConfidence(classification);
  const noQualifyingVisa = bestConfidence < CONFIDENCE_THRESHOLD_NO_VISA;

  const normalizedAnswers =
    Array.isArray((answers as any)?.answers) ? (answers as any).answers
    : Array.isArray(answers) ? answers
    : [];

  if (noQualifyingVisa) {
    return finalizeNoQualifyingVisa(facts, normalizedAnswers, classification);
  }

  const system = [
    "Com base nos fatos, nas respostas do usuário e na classificação de vistos:",
    "Responda APENAS em JSON válido. Inclua os 2 vistos com MAIS confiança para a pessoa em top_visas.",
    "",
    "FORMATO JSON:",
    "{",
    '  "selected_visa": string,  // visto principal (melhor opção)',
    '  "confidence": number,',
    '  "rationale"?: string,',
    '  "top_visas": [ { "visa": string, "confidence": number, "rationale"?: string }, ... ],  // exatamente 2 itens',
    '  "alternatives"?: string[],',
    '  "action_plan": [ { "step": "texto completo da etapa", "url": "https://..." ou null }, ... ],  // MÍNIMO 10 ETAPAS (veja regras abaixo)',
    '  "documents_checklist": string[],  // MÍNIMO 8 ITENS DETALHADOS (veja regras abaixo)',
    '  "risks_and_flags"?: string[],',
    '  "suggested_timeline"?: string,',
    '  "costs_note"?: string',
    "}",
    "",
    "--- REGRAS PARA O PLANO DE AÇÃO (action_plan) ---",
    "O plano deve ser BEM ELABORADO para a pessoa NÃO ter dúvidas. Gere entre 10 e 18 etapas.",
    "- Cada 'step' deve ser uma frase ou parágrafo curto COMPLETO: explique O QUE fazer, EM QUE ORDEM, e O QUE esperar (ex.: prazos, confirmações).",
    "- Inclua etapas para: (1) conferir elegibilidade e requisitos específicos do visto; (2) reunir documentos (referir ao checklist); (3) preencher formulários oficiais (nome do formulário e link quando houver); (4) pagar taxas (valor aproximado e onde pagar); (5) agendar entrevista/consulado; (6) preparar para a entrevista (o que levar, o que esperar); (7) dia da entrevista; (8) após a decisão (retirada do passaporte, ETA, etc.).",
    "- Use o campo 'url' em cada etapa quando existir site oficial (veja a lista de links abaixo). O texto em 'step' deve ser autocontido; o link é complementar.",
    "- Escreva em português, claro e direto, como um guia passo a passo.",
    "",
    "--- REGRAS PARA O CHECKLIST DE DOCUMENTOS (documents_checklist) ---",
    "O checklist deve ser DETALHADO para a pessoa saber exatamente o que juntar. Gere entre 8 e 15 itens.",
    "- Cada item deve ser uma frase completa: descreva O documento (nome oficial), O QUE ele deve conter ou atestar, VALIDADE ou PRAZO quando relevante (ex.: passaporte com 6 meses além da viagem), e ONDE obter se não for óbvio.",
    "- Inclua: passaporte (validade mínima); comprovantes de vínculos (trabalho, estudos, família, bens); comprovação financeira quando aplicável; documentos específicos do visto (ex.: I-20 para F-1, carta do empregador para H-1B); fotos conforme especificação do consulado; e qualquer outro exigido para o visto em questão.",
    "- Escreva em português. Exemplo de item BOM: 'Passaporte válido com pelo menos 6 meses além da data prevista de saída dos EUA; deve ter pelo menos uma página em branco para o visto.' Exemplo RUIM: 'Passaporte'.",
    "",
    "Links oficiais para usar no action_plan (inclua a URL no objeto da etapa quando fizer sentido):",
    ...OFFICIAL_LINKS.map((l) => `- ${l}`),
    "",
    "Certifique-se de que selected_visa e top_visas estejam coerentes com os fatos e com classification.candidates.",
  ].join("\n");

  const user = {
    extracted_facts: facts,
    answers: normalizedAnswers,
    classification,
    instruction_reminder:
      "Gere action_plan com 10 a 18 etapas bem detalhadas (cada step = texto completo, sem deixar dúvidas) e documents_checklist com 8 a 15 itens descritivos (cada item = frase completa explicando o documento e requisitos). Inclua URLs oficiais nas etapas do plano quando aplicável.",
  };

  const raw = await callJSON<unknown>({
    system,
    user,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
  });

  const parsed = FinalDecisionSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const fallback: FinalDecision = {
      selected_visa: (raw as any)?.selected_visa ?? "N/A",
      confidence: Number((raw as any)?.confidence) || 0,
      rationale: (raw as any)?.rationale,
      top_visas: normalizeTopVisas(raw),
      action_plan: normalizeActionPlan((raw as any)?.action_plan),
      documents_checklist: Array.isArray((raw as any)?.documents_checklist) ? (raw as any).documents_checklist : [],
    };
    return fallback;
  }

  const data = parsed.data;
  if (!data.top_visas?.length && (raw as any)?.selected_visa) {
    data.top_visas = [{ visa: (raw as any).selected_visa, confidence: (raw as any).confidence ?? data.confidence, rationale: data.rationale }];
  }
  data.action_plan = normalizeActionPlan(data.action_plan);
  return data;
}

/** Gera decisão quando a pessoa NÃO se enquadra em nenhum visto (confiança < 40%): não aponta visto e elabora caminho para se qualificar. */
async function finalizeNoQualifyingVisa(
  facts: Record<string, unknown>,
  answers: string[],
  classification: unknown
): Promise<FinalDecision> {
  const system = [
    "A pessoa NÃO se enquadra em nenhum visto no momento (a confiança do melhor candidato ficou abaixo de 40%).",
    "NÃO sugira nenhum visto. Em vez disso, elabore um CAMINHO para ela conseguir, no futuro, se enquadrar em um visto mais acessível.",
    "Responda APENAS em JSON válido no formato:",
    "{",
    '  "rationale": string,  // explique em 1–2 parágrafos por que não há visto adequado agora e qual o cenário geral (ex.: falta de requisitos, documentação, experiência). Seja claro e respeitoso.',
    '  "path_to_qualify": {',
    '    "summary": string,  // resumo em 2–4 frases do caminho recomendado (ex.: qual visto mais fácil buscar, em quanto tempo, o que priorizar)',
    '    "steps": [ { "step": "descrição completa da etapa", "url": "https://..." ou null }, ... ]  // entre 8 e 15 etapas BEM DETALHADAS',
    "  }",
    "}",
    "",
    "REGRAS PARA path_to_qualify.steps:",
    "- Cada etapa deve ser uma frase ou parágrafo curto COMPLETO: o que fazer, em que ordem, prazos típicos e onde buscar informação.",
    "- Sugira passos concretos: ex. melhorar inglês (nível e como comprovar), obter experiência profissional, conseguir oferta de emprego, juntar capital para investimento (E-2/EB-5), cursar programa que emita I-20 (F-1), verificar elegibilidade para DV no próximo ano, etc.",
    "- Inclua links oficiais quando fizer sentido (DS-160, USCIS, USTravelDocs, CEAC, DV, cursos de inglês reconhecidos, etc.).",
    "- Foque em vistos mais acessíveis que possam fazer sentido no perfil (B2, F-1, E-2, DV, trabalho com sponsor, etc.) e o que falta para se qualificar.",
    "- Escreva em português, de forma encorajadora e prática.",
    "",
    "Links úteis:",
    ...OFFICIAL_LINKS.map((l) => `- ${l}`),
  ].join("\n");

  const user = {
    extracted_facts: facts,
    answers,
    classification,
    instruction_reminder:
      "NÃO aponte nenhum visto. Gere path_to_qualify com summary claro e steps entre 8 e 15 etapas detalhadas, com URLs quando aplicável, para a pessoa seguir e um dia se qualificar a um visto.",
  };

  const raw = await callJSON<unknown>({
    system,
    user,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.25,
  });

  const r = raw as any;
  const pathToQualify = r?.path_to_qualify;
  const summary = typeof pathToQualify?.summary === "string" ? pathToQualify.summary : "";
  const rawSteps = Array.isArray(pathToQualify?.steps) ? pathToQualify.steps : [];
  const steps = normalizeActionPlan(rawSteps);

  const decision: FinalDecision = {
    selected_visa: "Nenhum",
    confidence: 0,
    rationale: typeof r?.rationale === "string" ? r.rationale : "Com o perfil atual não há um visto com adequação suficiente. Siga o caminho abaixo para se preparar.",
    qualifies_for_visa: false,
    path_to_qualify: {
      summary: summary || "Siga as etapas abaixo para fortalecer seu perfil e um dia se qualificar a um visto.",
      steps,
    },
    action_plan: [],
    documents_checklist: [],
  };

  return decision;
}

function normalizeTopVisas(raw: unknown): FinalDecision["top_visas"] {
  const arr = (raw as any)?.top_visas;
  if (!Array.isArray(arr)) return undefined;
  return arr
    .slice(0, 2)
    .map((x: any) => ({
      visa: typeof x?.visa === "string" ? x.visa : String(x?.visa ?? ""),
      confidence: typeof x?.confidence === "number" ? x.confidence : 0,
      rationale: typeof x?.rationale === "string" ? x.rationale : undefined,
    }))
    .filter((x: { visa: string }) => x.visa.length > 0);
}

const STEP_LINK_KEYWORDS: Array<{ keywords: RegExp | string[]; url: string }> = [
  { keywords: [/ds-160|ds160|formulário não imigrante/i], url: "https://ceac.state.gov/genniv/" },
  { keywords: [/agendar|entrevista|consulado|embaixada|ustraveldocs/i], url: "https://www.ustraveldocs.com/" },
  { keywords: [/uscis|formulário uscis|i-130|i-140|i-485/i], url: "https://www.uscis.gov/forms" },
  { keywords: [/ceac|nvc|imigrante|visa imigrante/i], url: "https://ceac.state.gov/" },
  { keywords: [/diversity|dv lottery|loteria/i], url: "https://dvlottery.state.gov/" },
  { keywords: [/taxa|fee|pagamento|mrv/i], url: "https://www.ustraveldocs.com/" },
];

function normalizeActionPlan(
  plan: unknown
): Array<{ step: string; url?: string } | string> {
  if (!Array.isArray(plan)) return [];
  return plan.map((item: unknown) => {
    if (typeof item === "string") {
      const step = item;
      const link = STEP_LINK_KEYWORDS.find((l) =>
        Array.isArray(l.keywords)
          ? l.keywords.some((k) => step.toLowerCase().includes(String(k).toLowerCase()))
          : (l.keywords as RegExp).test(step)
      );
      return link ? { step, url: link.url } : step;
    }
    if (item && typeof item === "object" && "step" in item) {
      const s = (item as any).step;
      let url = (item as any).url;
      const step = typeof s === "string" ? s : String(s ?? "");
      if (typeof url !== "string" && step) {
        const link = STEP_LINK_KEYWORDS.find((l) =>
          Array.isArray(l.keywords)
            ? l.keywords.some((k) => step.toLowerCase().includes(String(k).toLowerCase()))
            : (l.keywords as RegExp).test(step)
        );
        if (link) url = link.url;
      }
      return { step, url: typeof url === "string" ? url : undefined };
    }
    return String(item);
  });
}
