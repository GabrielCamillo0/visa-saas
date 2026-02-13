// src/components/QuestionsForm.tsx  (client)
"use client";

import * as React from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";

const AnswersSchema = z.object({
  answers: z.array(z.string().min(1)).min(1),
});

type Props = {
  submissionId: string;
  questions: string[];
  initialAnswers?: string[];
};

export default function QuestionsForm({ submissionId, questions, initialAnswers = [] }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<string[]>(
    questions.map((_, i) => initialAnswers[i] ?? "")
  );
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    // se as perguntas mudarem (ex: após novo /questions), re-sincroniza
    setAnswers(questions.map((_, i) => initialAnswers[i] ?? ""));
  }, [questions.join("|")]); // depende da lista

  function setAnswerAt(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg(null);

    const parsed = AnswersSchema.safeParse({ answers });
    if (!parsed.success) {
      setStatus("error");
      setErrorMsg("Preencha todas as respostas antes de enviar.");
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${submissionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: parsed.data.answers }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Erro ${res.status}`);
      }

      setStatus("saved");
      router.refresh(); // recarrega e já mostra a decisão final (gerada automaticamente)
      document.getElementById("decisao-final")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Erro ao salvar respostas.");
    } finally {
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="space-y-1">
          <label className="block text-sm font-medium text-[var(--text-main)]">
            {i + 1}. {q}
          </label>
          <textarea
            className="input min-h-[80px] resize-y"
            rows={3}
            value={answers[i] ?? ""}
            onChange={(e) => setAnswerAt(i, e.target.value)}
            placeholder="Digite sua resposta..."
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="btn-primary disabled:opacity-60"
        >
          {status === "saving" ? "Salvando..." : "Enviar respostas"}
        </button>
        {status === "saved" && <span className="text-[var(--success-soft)] text-sm">Respostas salvas!</span>}
        {status === "error" && <span className="text-[var(--danger)] text-sm">{errorMsg}</span>}
      </div>
    </form>
  );
}
