"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function ActionsClient({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(path: string, label: string) {
    try {
      setBusy(label);
      setError(null);
      const res = await fetch(`/api/submissions/${submissionId}/${path}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Erro ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Falhou.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border rounded-md p-4 space-y-3">
      <h2 className="font-medium">Pipeline</h2>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => run("extract", "Extract")}
          disabled={!!busy}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {busy === "Extract" ? "Extraindo..." : "1) Extrair fatos"}
        </button>
        <button
          onClick={() => run("classify", "Classify")}
          disabled={!!busy}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {busy === "Classify" ? "Classificando..." : "2) Classificar"}
        </button>
        <button
          onClick={() => run("questions", "Questions")}
          disabled={!!busy}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {busy === "Questions" ? "Gerando..." : "3) Gerar 5 perguntas"}
        </button>

        {/* Refazer passo */}
        <div className="flex items-center gap-2 ml-4">
          <select
            className="border rounded px-2 py-2 text-sm"
            onChange={(e) => run(`redo?step=${encodeURIComponent(e.target.value)}`, "Redo")}
            defaultValue=""
            disabled={!!busy}
            title="Refazer um passo e limpar os seguintes"
          >
            <option value="" disabled>Refazer…</option>
            <option value="extract">Refazer: Extrair fatos</option>
            <option value="classify">Refazer: Classificar</option>
            <option value="questions">Refazer: Gerar perguntas</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
