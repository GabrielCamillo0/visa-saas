"use client";

import * as React from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  questions: string[];
  initialAnswers?: string[];
};

// Schema só para checar que há strings não vazias (o tamanho igual ao de questions é validado no componente)
const AnswersSchema = z.object({
  answers: z.array(z.string().min(1, "Obrigatória")).min(1, "Informe ao menos 1 resposta."),
});

export default function QuestionsForm({
  submissionId,
  questions,
  initialAnswers = [],
}: Props) {
  const router = useRouter();

  // Mantém o array sempre com o comprimento exato de questions
  const normalizedInitial = React.useMemo(() => {
    const out = Array.from({ length: questions.length }, (_, i) => initialAnswers[i] ?? "");
    return out;
  }, [questions, initialAnswers]);

  const [answers, setAnswers] = React.useState<string[]>(normalizedInitial);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<boolean[]>(() => questions.map(() => false));
  const [submittedOnce, setSubmittedOnce] = React.useState(false);

  // refs para autofocus do primeiro campo vazio ao abrir/submeter
  const textareasRef = React.useRef<Array<HTMLTextAreaElement | null>>([]);

  // Sync quando perguntas mudarem
  React.useEffect(() => {
    setAnswers(normalizedInitial);
    setTouched(questions.map(() => false));
  }, [normalizedInitial, questions]);

  // Draft em localStorage
  const draftKey = `answers:${submissionId}`;
  React.useEffect(() => {
    // Se não há respostas iniciais preenchidas, tenta carregar rascunho
    const allEmpty = normalizedInitial.every((a) => !a);
    if (allEmpty) {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(draftKey) : null;
      if (raw) {
        try {
          const parsed: string[] = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === questions.length) {
            setAnswers(parsed);
          }
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(draftKey, JSON.stringify(answers));
    }
  }, [answers, draftKey]);

  function setAnswerAt(index: number, value: string) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function markTouched(index: number) {
    setTouched((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }

  // Utilitário: trim em todas e validações
  function getTrimmed(): string[] {
    return answers.map((a) => a.trim());
  }

  function firstEmptyIndex(arr: string[]): number {
    return arr.findIndex((a) => !a);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedOnce(true);
    setStatus("saving");
    setErrorMsg(null);

    // Mantém comprimento idêntico ao de questions
    if (answers.length !== questions.length) {
      setStatus("error");
      setErrorMsg(`Número de respostas (${answers.length}) diferente do de perguntas (${questions.length}).`);
      return;
    }

    const trimmed = getTrimmed();

    // Zod validará "não vazio", mas também garantimos aqui o mesmo comprimento
    const parsed = AnswersSchema.safeParse({ answers: trimmed });
    if (!parsed.success) {
      setStatus("error");
      setErrorMsg("Preencha todas as respostas antes de enviar.");

      // foca no primeiro vazio
      const idx = firstEmptyIndex(trimmed);
      if (idx >= 0 && textareasRef.current[idx]) {
        textareasRef.current[idx]?.focus();
      }
      // Marca todos como tocados para exibir mensagens
      setTouched(questions.map(() => true));
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${submissionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: parsed.data.answers }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || `Erro ${res.status}`);
      }

      setStatus("saved");
      // limpa rascunho já que salvou ok
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      // dá refresh para a página refletir o que o server retornou
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Erro ao salvar respostas.");
    } finally {
      // volta para idle depois de alguns segundos
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  // Botão deve ficar desabilitado se estiver salvando ou houver campos vazios
  const hasEmpty = getTrimmed().some((a) => !a);
  const disableSubmit = status === "saving" || hasEmpty;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {questions.map((q, i) => {
        const value = answers[i] ?? "";
        const showFieldError = (submittedOnce || touched[i]) && value.trim().length === 0;
        return (
          <div key={i} className="space-y-1">
            <label className="block text-sm font-medium">
              {i + 1}. {q}
            </label>
            <textarea
              ref={(el) => (textareasRef.current[i] = el)}
              className={`w-full border rounded-md p-2 text-sm focus:outline-none focus:ring-2 ${
                showFieldError ? "border-red-500 focus:ring-red-500" : "focus:ring-blue-500"
              }`}
              rows={3}
              value={value}
              onChange={(e) => setAnswerAt(i, e.target.value)}
              onBlur={() => markTouched(i)}
              placeholder="Digite sua resposta..."
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{value.trim().length} caractere(s)</span>
              {showFieldError && <span className="text-xs text-red-600">Obrigatória</span>}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disableSubmit}
          className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
          title={hasEmpty ? "Preencha todas as respostas" : "Enviar respostas"}
        >
          {status === "saving" ? "Salvando..." : "Enviar respostas"}
        </button>

        <button
          type="button"
          onClick={() => {
            setAnswers(questions.map(() => ""));
            setTouched(questions.map(() => false));
            setSubmittedOnce(false);
            setErrorMsg(null);
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(draftKey);
            }
            // foco no primeiro campo
            setTimeout(() => textareasRef.current[0]?.focus(), 0);
          }}
          className="px-3 py-2 rounded-md border"
        >
          Limpar
        </button>

        {status === "saved" && <span className="text-green-700 text-sm">Respostas salvas!</span>}
        {status === "error" && <span className="text-red-700 text-sm">{errorMsg}</span>}
      </div>
    </form>
  );
}
