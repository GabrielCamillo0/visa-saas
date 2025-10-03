"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export default function FinalizeButton({
  id,
  disabledReason,
}: {
  id: string;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function finalize() {
    setLoading(true);
    try {
      const res = await fetch(`/api/submissions/${id}/finalize`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Erro ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !!disabledReason;

  return (
    <div>
      <button
        onClick={finalize}
        className="px-4 py-2 rounded-md bg-emerald-600 text-white disabled:opacity-60"
        disabled={disabled}
        title={disabledReason ?? "Finalizar decisão"}
      >
        {loading ? "Finalizando..." : "Finalizar decisão"}
      </button>
      {disabledReason && (
        <p className="text-xs text-gray-600 mt-2">
          Você precisa concluir: {disabledReason}.
        </p>
      )}
    </div>
  );
}
