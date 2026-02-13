// app/dashboard/submissions/[id]/_PipelineButtons.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Step = "classify" | "questions";

export default function PipelineButtons({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Step | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => {
      // cancela fetch em andamento ao desmontar
      abortRef.current?.abort();
    };
  }, []);

  async function hit(step: Step) {
    if (busy) return; // evita cliques duplos
    setBusy(step);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/submissions/${id}/${step}`, {
        method: "POST",
        signal: abortRef.current.signal,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Erro ${res.status}`);
      }

      // força revalidação dos dados do server component
      router.refresh();
    } catch (e) {
      if ((e as any)?.name === "AbortError") return;
      console.error(e);
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const disabled = !!busy;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => hit("classify")}
        className="btn-primary disabled:opacity-60"
        disabled={disabled}
        aria-busy={busy === "classify"}
        title="Classifica o caso em possíveis vistos"
      >
        {busy === "classify" ? "Classificando..." : "1) Classificar"}
      </button>
      <button
        onClick={() => hit("questions")}
        className="btn-primary disabled:opacity-60"
        disabled={disabled}
        aria-busy={busy === "questions"}
        title="Gera 5 perguntas de validação"
      >
        {busy === "questions" ? "Gerando..." : "2) Gerar 5 perguntas"}
      </button>
    </div>
  );
}
