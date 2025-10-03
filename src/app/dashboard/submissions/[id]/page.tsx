// app/dashboard/submissions/[id]/page.tsx  (SERVER)
import { notFound } from "next/navigation";
import Link from "next/link";
import JSONBlock from "./_JSONBlock";
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
  raw_text: string | null;
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
    alternatives?: string[];
    action_plan: string[];
    documents_checklist: string[];
    risks_and_flags?: string[];
    suggested_timeline?: string;
    costs_note?: string;
  } | null;
};

// ---- Data loader -----------------------------------------------------------

async function getSubmission(id: string): Promise<Submission | null> {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""; // se vazio, usa caminho relativo

  const url = base ? `${base}/api/submissions/${id}` : `/api/submissions/${id}`;
  const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
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
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Submission #{sub.id}</h1>
        <nav className="text-sm">
          <Link href="/dashboard" className="underline">
            Submissões
          </Link>
          <Link href="/dashboard/submissions/new" className="underline ml-3">
            Nova
          </Link>
        </nav>
      </header>

      <section className="border rounded-md p-4">
        <div className="text-sm text-gray-600">
          Status: <b>{sub.status}</b>
        </div>
        {sub.raw_text && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm underline">
              Ver texto enviado
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
              {sub.raw_text}
            </pre>
          </details>
        )}
      </section>

      {/* Ações do pipeline (client component separado) */}
      <PipelineButtons id={sub.id} />

      {/* Fatos extraídos */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-2">1) Fatos extraídos</h2>
        {hasFacts ? (
          <JSONBlock data={sub.extracted_facts} />
        ) : (
          <p className="text-sm text-gray-600">
            Ainda não há fatos. Clique em <b>Extrair fatos</b>.
          </p>
        )}
      </section>

      {/* Classificação */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-2">2) Classificação (vistos candidatos)</h2>
        {hasClassification ? (
          <div className="space-y-2">
            {sub.classification!.candidates.map((c, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium">
                  {c.title}{" "}
                  <span className="text-xs text-gray-500">({c.visa_code})</span>
                </div>
                <div className="text-sm">
                  Confiança: {(c.confidence * 100).toFixed(0)}%
                </div>
                {c.rationale && (
                  <p className="text-sm text-gray-700 mt-1">{c.rationale}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Sem classificação ainda. Clique em <b>Classificar</b>.
          </p>
        )}
      </section>

      {/* Perguntas + Respostas */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">3) Perguntas de validação (5)</h2>

        {hasQuestions ? (
          <>
            <div className="mb-3">
              {/* útil para depurar o payload salvo */}
              <JSONBlock data={sub.followup_questions} collapsed />
            </div>

            <h3 className="font-medium mb-2">Responda abaixo</h3>
            <QuestionsForm
              submissionId={sub.id}
              questions={questions}
              initialAnswers={answers}
            />

            {hasAnswers && (
              <details className="mt-4">
                <summary className="cursor-pointer underline text-sm">
                  Ver respostas salvas
                </summary>
                <JSONBlock data={sub.followup_answers} />
              </details>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Clique em <b>Gerar 5 perguntas</b> para criar as perguntas.
          </p>
        )}
      </section>

      {/* Finalização */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">4) Decisão final</h2>
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
            <div className="text-sm">
              <b>Visto selecionado:</b> {sub.final_decision!.selected_visa} —{" "}
              <b>Confiança:</b>{" "}
              {(sub.final_decision!.confidence * 100).toFixed(0)}%
            </div>
            {sub.final_decision!.rationale && (
              <p className="text-sm text-gray-700">
                {sub.final_decision!.rationale}
              </p>
            )}
            {sub.final_decision!.action_plan?.length ? (
              <div>
                <div className="font-medium text-sm">Plano de ação</div>
                <ul className="list-disc ml-6 text-sm">
                  {sub.final_decision!.action_plan.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {sub.final_decision!.documents_checklist?.length ? (
              <div>
                <div className="font-medium text-sm">Checklist de documentos</div>
                <ul className="list-disc ml-6 text-sm">
                  {sub.final_decision!.documents_checklist.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <details className="mt-2">
              <summary className="cursor-pointer underline text-sm">
                Ver JSON completo
              </summary>
              <JSONBlock data={sub.final_decision} />
            </details>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mt-2">Ainda sem decisão final.</p>
        )}
      </section>
    </div>
  );
}
