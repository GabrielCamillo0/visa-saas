// app/dashboard/submissions/[id]/_FinalizeButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  disabledReason: string | null;
};

export default function FinalizeButton({ id, disabledReason }: Props) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function finalize() {
    if (loading || disabledReason) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/submissions/${id}/finalize`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Erro ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErrorMsg((e as Error).message || "Erro ao finalizar decisão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={finalize}
        className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-60"
        disabled={loading || !!disabledReason}
        title={disabledReason ?? "Finalizar decisão"}
      >
        {loading ? "Finalizando..." : "Finalizar decisão"}
      </button>

      {disabledReason && (
        <p className="text-xs text-gray-600">
          Você precisa concluir: {disabledReason}.
        </p>
      )}

      {errorMsg && (
        <p className="text-sm text-red-700">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
