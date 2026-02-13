"use client";

import { useState } from "react";
import Link from "next/link";

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/lemonsqueezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Erro ao iniciar checkout.");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Resposta inválida do servidor.");
    } catch (e: any) {
      setError(e?.message ?? "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text-main)]">Assinatura</h1>
      <p className="text-[var(--text-muted)]">
        Assine com Lemon Squeezy para desbloquear todos os recursos do Visa SaaS.
      </p>

      <div className="section-card rounded-xl">
        <h2 className="font-medium text-lg text-[var(--text-main)]">Plano Pro</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Acesso completo às submissões, análises e suporte.
        </p>
        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={handleCheckout}
          className="mt-4 w-full btn-primary py-3 disabled:opacity-60"
        >
          {loading ? "Redirecionando..." : "Assinar com Lemon Squeezy"}
        </button>
      </div>

      <p className="text-xs text-[var(--text-subtle)]">
        Você será redirecionado ao checkout seguro do Lemon Squeezy. O pagamento é processado por eles.
      </p>

      <Link href="/dashboard" className="text-sm text-[var(--primary)] hover:underline inline-flex items-center gap-1">
        ← Voltar ao dashboard
      </Link>
    </div>
  );
}
