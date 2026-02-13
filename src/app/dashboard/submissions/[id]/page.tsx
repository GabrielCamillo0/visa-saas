// app/dashboard/submissions/[id]/page.tsx  (SERVER)
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import QuestionsForm from "@/components/QuestionsForm";
import PipelineButtons from "./_PipelineButtons";
import FinalizeButton from "./_FinalizeButton";

// ---- Normalizadores defensivos ---------------------------------------------

function extractQuestions(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0
    );
  }
  const q = (input as any)?.questions;
  if (Array.isArray(q)) {
    return q.filter(
      (s: unknown): s is string => typeof s === "string" && s.trim().length > 0
    );
  }
  return [];
}

function extractAnswers(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((s): s is string => typeof s === "string");
  }
  const a = (input as any)?.answers;
  if (Array.isArray(a)) {
    return a.filter((s: unknown): s is string => typeof s === "string");
  }
  return [];
}

// ---- Tipos -----------------------------------------------------------------

type Submission = {
  id: string;
  status: string;
  applicant_name?: string | null;
  applicant_phone?: string | null;
  created_at?: string;
  extracted_facts?: any | null;
  classification?: {
    candidates: Array<{
      visa_code: string;
      title: string;
      confidence: number;
      rationale?: string;
    }>;
  } | null;
  followup_questions?: unknown; // pode ser string[] ou {questions:string[]}
  followup_answers?: unknown;   // pode ser string[] ou {answers:string[]}
  final_decision?: {
    selected_visa: string;
    confidence: number;
    rationale?: string;
    qualifies_for_visa?: boolean;
    path_to_qualify?: { summary: string; steps: Array<string | { step: string; url?: string }> };
    top_visas?: Array<{ visa: string; confidence: number; rationale?: string }>;
    alternatives?: string[];
    action_plan: Array<string | { step: string; url?: string }>;
    documents_checklist: string[];
    risks_and_flags?: string[];
    suggested_timeline?: string;
    costs_note?: string;
  } | null;
};

// ---- Data loader (server-side: usa cookies do request, evita 401 na API) ----

async function getSubmission(
  id: string
): Promise<Submission | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const rows = await query<Submission>(
    `
    SELECT
      id,
      status,
      applicant_name,
      applicant_phone,
      created_at,
      extracted_facts,
      classification,
      followup_questions,
      followup_answers,
      final_decision,
      created_at,
      updated_at
    FROM submissions
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, user.id]
  );
  return rows[0] ?? null;
}

// ---- Page ------------------------------------------------------------------

export default async function SubmissionPage({
  params,
}: {
  params: { id: string };
}) {
  const sub = await getSubmission(params.id);
  if (!sub) return notFound();

  const hasFacts = !!sub.extracted_facts;
  const hasClassification =
    !!sub.classification &&
    Array.isArray(sub.classification.candidates) &&
    sub.classification.candidates.length > 0;

  const questions = extractQuestions(sub.followup_questions);
  const answers = extractAnswers(sub.followup_answers);

  const hasQuestions = questions.length > 0;
  const hasAnswers = answers.length > 0;
  const hasFinal = !!sub.final_decision;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-main)]">{sub.applicant_name || `Submissão #${sub.id.slice(0, 8)}`}</h1>
          {sub.created_at && (
            <p className="text-sm text-[var(--text-subtle)] mt-0.5">
              Criada em {new Date(sub.created_at).toLocaleDateString("pt-BR")} às {new Date(sub.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/dashboard" className="text-[var(--primary)] hover:underline">
            Submissões
          </Link>
          <Link href="/dashboard/submissions/new" className="text-[var(--primary)] hover:underline">
            Nova
          </Link>
        </nav>
      </header>

      <section className="section-card">
        <div className="text-sm text-[var(--text-muted)]">
          Status: <b className="text-[var(--text-main)]">{sub.status}</b>
        </div>
      </section>

      {/* Ações do pipeline (extração de fatos é automática; só classificar e perguntas são acionáveis) */}
      <PipelineButtons id={sub.id} />

      {/* Classificação */}
      <section className="section-card">
        <h2 className="font-medium mb-3 text-[var(--text-main)]">1) Classificação (vistos candidatos)</h2>
        {hasClassification ? (
          <div className="space-y-3">
            {sub.classification!.candidates.map((c, i) => (
              <div key={i} className="rounded-lg border border-[var(--border-default)] p-3 bg-[var(--bg-muted)]/50">
                <div className="font-medium text-[var(--text-main)]">
                  {c.title}{" "}
                  <span className="text-xs text-[var(--text-subtle)]">({c.visa_code})</span>
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  Confiança: {(c.confidence * 100).toFixed(0)}%
                </div>
                {c.rationale && (
                  <p className="text-sm text-[var(--text-muted)] mt-1">{c.rationale}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Sem classificação ainda. Clique em <b>Classificar</b>.
          </p>
        )}
      </section>

      {/* Perguntas + Respostas */}
      <section className="section-card">
        <h2 className="font-medium mb-3 text-[var(--text-main)]">2) Perguntas de validação</h2>

        {hasQuestions ? (
          <>
            <h3 className="font-medium mb-3 text-[var(--text-main)]">Responda abaixo</h3>
            <QuestionsForm
              submissionId={sub.id}
              questions={questions}
              initialAnswers={answers}
            />
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Clique em <b>Gerar 5 perguntas</b> para criar as perguntas.
          </p>
        )}
      </section>

      {/* Finalização (preenchida automaticamente após enviar as respostas) */}
      <section id="decisao-final" className="section-card">
        <h2 className="font-medium mb-3 text-[var(--text-main)]">3) Decisão final</h2>
        <FinalizeButton
          id={sub.id}
          disabledReason={
            !hasFacts
              ? "Faltam fatos"
              : !hasClassification
              ? "Falta classificação"
              : !hasAnswers
              ? "Responda as perguntas"
              : null
          }
        />

        {hasFinal ? (
          <div className="space-y-3 mt-3">
            {/* Não se enquadra em nenhum visto (confiança < 40%) */}
            {sub.final_decision!.qualifies_for_visa === false ? (
              <>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                  <div className="font-medium text-amber-200">Você não se enquadra em nenhum visto no momento</div>
                  <p className="mt-2 text-sm text-amber-100/90">
                    Com o perfil atual não há um visto com adequação suficiente. Não estamos apontando nenhum visto específico. Em vez disso, elaboramos um caminho para você se preparar e, no futuro, se qualificar a um visto mais acessível.
                  </p>
                </div>
                {sub.final_decision!.rationale && (
                  <p className="text-sm text-[var(--text-muted)]">{sub.final_decision!.rationale}</p>
                )}
                {sub.final_decision!.path_to_qualify && (
                  <div className="space-y-2">
                    <div className="font-medium text-sm text-[var(--text-main)]">Caminho para se qualificar a um visto</div>
                    <p className="text-sm text-[var(--text-muted)]">{sub.final_decision!.path_to_qualify.summary}</p>
                    <ul className="list-disc ml-6 text-sm space-y-1 text-[var(--text-muted)]">
                      {sub.final_decision!.path_to_qualify.steps.map((it, i) => {
                        const step = typeof it === "string" ? it : it.step;
                        const url = typeof it === "string" ? null : it.url;
                        return (
                          <li key={i}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                                {step}
                              </a>
                            ) : (
                              step
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Os 2 vistos com mais confiança */}
                {sub.final_decision!.top_visas?.length ? (
                  <div>
                    <div className="font-medium text-sm mb-2 text-[var(--text-main)]">Vistos recomendados (maior confiança)</div>
                    <div className="space-y-2">
                      {sub.final_decision!.top_visas.map((v, i) => (
                        <div key={i} className="rounded-lg border border-[var(--border-default)] p-3 bg-[var(--bg-muted)]/50">
                          <div className="font-medium text-[var(--text-main)]">
                            {i + 1}º {v.visa} — {(v.confidence * 100).toFixed(0)}% confiança
                          </div>
                          {v.rationale && (
                            <p className="text-sm text-[var(--text-muted)] mt-1">{v.rationale}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">
                    <b className="text-[var(--text-main)]">Visto selecionado:</b> {sub.final_decision!.selected_visa} —{" "}
                    <b>Confiança:</b>{" "}
                    {(sub.final_decision!.confidence * 100).toFixed(0)}%
                  </div>
                )}
                {sub.final_decision!.rationale && (
                  <p className="text-sm text-[var(--text-muted)]">{sub.final_decision!.rationale}</p>
                )}
                {sub.final_decision!.action_plan?.length ? (
                  <div>
                    <div className="font-medium text-sm mb-2 text-[var(--text-main)]">Plano de ação</div>
                    <ul className="list-disc ml-6 text-sm space-y-1 text-[var(--text-muted)]">
                      {sub.final_decision!.action_plan.map((it, i) => {
                        const step = typeof it === "string" ? it : it.step;
                        const url = typeof it === "string" ? null : it.url;
                        return (
                          <li key={i}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                                {step}
                              </a>
                            ) : (
                              step
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {sub.final_decision!.documents_checklist?.length ? (
                  <div>
                    <div className="font-medium text-sm mb-2 text-[var(--text-main)]">Checklist de documentos</div>
                    <ul className="list-disc ml-6 text-sm text-[var(--text-muted)]">
                      {sub.final_decision!.documents_checklist.map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] mt-2">
            A decisão final é gerada automaticamente após você enviar as respostas das perguntas.
          </p>
        )}
      </section>
    </div>
  );
}
