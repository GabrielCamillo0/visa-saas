"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export default function ClassifyButton({ id }: { id: string }) {
  const r = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function go() {
    if (loading) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/submissions/${id}/classify`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Erro ${res.status}`);
      r.refresh();
    } catch (e: any) { setErr(e?.message || "falha ao classificar"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-1">
      <button onClick={go} disabled={loading} className="px-3 py-2 rounded bg-indigo-600 text-white">
        {loading ? "Classificando..." : "Classificar"}
      </button>
      {err && <div className="text-xs text-red-700">{err}</div>}
    </div>
  );
}
