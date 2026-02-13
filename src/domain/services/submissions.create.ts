// src/domain/services/submissions.create.ts
"use server";

import { query } from "@/lib/db";
import { extractFacts } from "@/domain/services/extract-facts";
import { classifyVisa } from "@/domain/services/classify-visa";
import { generateValidationQuestions } from "@/domain/services/generate-questions";

/** Colunas seguras para retornar ao caller (whitelist). */
const SAFE_COLUMNS = new Set([
  "id",
  "user_id",
  "raw_text",
  "applicant_name",
  "applicant_phone",
  "extracted_facts",     // jsonb
  "classification",      // jsonb
  "followup_questions",  // jsonb
  "followup_answers",    // jsonb
  "final_decision",      // jsonb
  "status",
  "created_at",
  "updated_at",
]);

type Column = typeof SAFE_COLUMNS extends Set<infer T> ? T : never;

function buildSelect(columns?: Column[] | "all"): string {
  if (columns === "all") return "*";
  const defaults: Column[] = [
    "id",
    "user_id",
    "raw_text",
    "applicant_name",
    "applicant_phone",
    "status",
    "created_at",
    "updated_at",
    "extracted_facts",
    "classification",
    "followup_questions",
  ];
  const cols = (columns ?? defaults) as string[];
  const picked = cols.filter((c) => SAFE_COLUMNS.has(c as Column));
  return picked.length ? picked.join(", ") : defaults.join(", ");
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Gera ID (16 chars) compatível com Node/Edge sem deps externas. */
function makeId(len = 16): string {
  const g: any = globalThis as any;
  if (g.crypto?.getRandomValues) {
    const bytes = new Uint8Array(len);
    g.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export type CreateSubmissionOptions = {
  id?: string;              // Força um ID específico (raro)
  status?: string;          // Status inicial (padrão: 'INTAKE')
  applicantName?: string | null;  // Nome completo do candidato
  applicantPhone?: string | null; // Telefone do candidato
  minTextLen?: number;      // Mínimo de caracteres exigidos no raw_text (padrão 20)
  allowEmptyText?: boolean; // Permite texto vazio/curto
  columns?: Column[] | "all";
  autoProcess?: boolean;    // Roda pipeline automática (padrão: true)
  initial?: {
    extracted_facts?: unknown;
    classification?: unknown;
    followup_questions?: unknown; // array ou { questions: string[] }
    followup_answers?: unknown;
    final_decision?: unknown;
  };
};

/** ===== Status seguros (devem existir no ENUM do seu DB) =====
 * Ajuste conforme o que já foi criado no banco.
 * Se quiser mais valores, adicione primeiro ao ENUM no Postgres.
 */
const ALLOWED_STATUSES = new Set(
  (process.env.SUBMISSION_ALLOWED_STATUSES ?? "INTAKE,READY,ERROR")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

/** Atualiza status somente se for permitido pelo ENUM; ignora falhas. */
async function safeSetStatus(id: string, next: string) {
  const val = (next || "").toUpperCase();
  if (!ALLOWED_STATUSES.has(val)) {
    // Não tente setar valor que o ENUM não aceita
    return;
  }
  try {
    await query(`UPDATE submissions SET status=$2, updated_at=NOW() WHERE id=$1`, [id, val]);
  } catch (e) {
    // Silencia para não quebrar a pipeline; só loga
    console.warn("[createSubmission] status update ignored (enum mismatch):", val, e);
  }
}

/** Tenta gravar um texto/JSON com o motivo do erro (opcional).
 * Se a coluna não existir, apenas loga. Troque 'system_notes' por uma coluna sua (TEXT/JSONB).
 */
async function safeSetErrorNote(id: string, note: unknown) {
  try {
    await query(
      `UPDATE submissions
         SET system_notes=$2, updated_at=NOW()
       WHERE id=$1`,
      [id, typeof note === "string" ? note : JSON.stringify(note)]
    );
  } catch {
    // Sem coluna? ignore.
  }
}

/**
 * Cria um registro em `submissions`. Se `autoProcess` habilitado e houver texto suficiente,
 * roda automaticamente: extractFacts → classifyVisa → generateValidationQuestions.
 * Usa APENAS statuses permitidos no ENUM para evitar 22P02.
 */
export async function createSubmission(
  userId: string,
  rawText?: string | null,
  opts?: CreateSubmissionOptions
) {
  if (!userId || typeof userId !== "string") {
    throw new Error("createSubmission: userId is required.");
  }

  // Normaliza texto
  const text =
    typeof rawText === "string"
      ? rawText.replace(/\r\n/g, "\n").trim()
      : null;

  // Valida tamanho mínimo (a menos que permitido)
  const minLen = Math.max(0, opts?.minTextLen ?? 20);
  if (!opts?.allowEmptyText) {
    const len = (text ?? "").length;
    if (len < minLen) {
      throw new Error(`createSubmission: raw_text too short (got ${len}, need >= ${minLen}).`);
    }
  }

  const id = (opts?.id && String(opts.id)) || makeId();
  const initialStatus = (opts?.status ?? "INTAKE").toUpperCase();
  const status = ALLOWED_STATUSES.has(initialStatus) ? initialStatus : "INTAKE";
  const select = buildSelect(opts?.columns);

  // Campos JSON iniciais (opcionais)
  const init = opts?.initial ?? {};
  const extracted_facts_init = init.extracted_facts ?? null;
  const classification_init = init.classification ?? null;
  const followup_questions_init = init.followup_questions ?? null;
  const followup_answers_init = init.followup_answers ?? null;
  const final_decision_init = init.final_decision ?? null;

  const applicantName = (opts?.applicantName != null && String(opts.applicantName).trim()) ? String(opts.applicantName).trim() : null;
  const applicantPhone = (opts?.applicantPhone != null && String(opts.applicantPhone).trim()) ? String(opts.applicantPhone).trim() : null;

  // 1) INSERT
  const rows = await query<{ [k: string]: any }>(
    `INSERT INTO submissions (
        id, user_id, raw_text, applicant_name, applicant_phone, status,
        extracted_facts, classification, followup_questions, followup_answers, final_decision
     )
     VALUES ($1,$2,$3,$4,$5,$6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
     RETURNING ${select}`,
    [
      id,
      userId,
      text ?? null,
      applicantName,
      applicantPhone,
      status,
      extracted_facts_init ? JSON.stringify(extracted_facts_init) : null,
      classification_init ? JSON.stringify(classification_init) : null,
      followup_questions_init ? JSON.stringify(followup_questions_init) : null,
      followup_answers_init ? JSON.stringify(followup_answers_init) : null,
      final_decision_init ? JSON.stringify(final_decision_init) : null,
    ]
  );

  const shouldProcess = (opts?.autoProcess ?? true) && (text?.length ?? 0) >= minLen;
  if (!shouldProcess) {
    return rows[0] ?? { id };
  }

  // 2) Pipeline automática — sem tocar no ENUM com valores não permitidos
  let facts: any = extracted_facts_init ?? null;
  let classification: any = classification_init ?? null;
  let followupQuestions: any = followup_questions_init ?? null;

  try {
    // Extract
    if (!facts) {
      facts = await extractFacts(text || "");
      await query(
        `UPDATE submissions
           SET extracted_facts=$2::jsonb, updated_at=NOW()
         WHERE id=$1`,
        [id, JSON.stringify(facts)]
      );
    }

    // Classify
    if (!classification) {
      classification = await classifyVisa(facts);
      await query(
        `UPDATE submissions
           SET classification=$2::jsonb, updated_at=NOW()
         WHERE id=$1`,
        [id, JSON.stringify(classification)]
      );
    }

    // Questions
    if (!followupQuestions) {
      const raw = (await generateValidationQuestions(facts, classification)) as
        | string[]
        | { questions?: unknown };

      const questions: string[] = Array.isArray(raw)
        ? raw.filter((x) => typeof x === "string" && x.trim().length > 0)
        : Array.isArray(raw?.questions)
        ? (raw.questions as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0
          )
        : [];

      followupQuestions = { questions };
      await query(
        `UPDATE submissions
           SET followup_questions=$2::jsonb, followup_answers=NULL, updated_at=NOW()
         WHERE id=$1`,
        [id, JSON.stringify(followupQuestions)]
      );
    }

    // Sucesso → status READY (se permitido)
    await safeSetStatus(id, "READY");
  } catch (err) {
    console.error("[createSubmission] pipeline error:", err);
    // Grava nota do erro (se houver coluna) e marca status ERROR (se permitido)
    await safeSetErrorNote(id, { step: "pipeline", error: String((err as any)?.message || err) });
    await safeSetStatus(id, "ERROR");
  }

  // 3) Retorna linha atualizada
  const finalRows = await query<{ [k: string]: any }>(
    `SELECT ${select} FROM submissions WHERE id=$1 LIMIT 1`,
    [id]
  );
  return finalRows[0] ?? { id };
}
