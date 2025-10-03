"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export default function RedoButton({ id, step }: { id: string; step: "facts" | "classify" | "questions" }) {
  const r = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function redo() {
    if (loading) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/submissions/${id}/redo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Erro ${res.status}`);
      r.refresh();
    } catch (e: any) { setErr(e?.message || "falha ao refazer"); }
    finally { setLoading(false); }
  }

  const label = step === "facts" ? "Refazer fatos"
    : step === "classify" ? "Refazer classificação"
    : "Refazer perguntas";

  return (
    <div className="space-y-1">
      <button onClick={redo} disabled={loading} className="px-3 py-2 rounded bg-gray-700 text-white">
        {loading ? "Refazendo..." : label}
      </button>
      {err && <div className="text-xs text-red-700">{err}</div>}
    </div>
  );
}
