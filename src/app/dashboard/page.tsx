"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { id: string; status: string; applicant_name?: string | null; created_at: string };

export default function DashboardHome() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    fetch("/api/submissions")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text-main)]">Minhas submissões</h1>
        <Link
          href="/dashboard/submissions/new"
          className="btn-primary shrink-0 inline-flex items-center justify-center gap-2"
        >
          Nova submissão
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="section-card rounded-xl text-center py-12">
          <p className="text-[var(--text-muted)]">Nenhuma submissão ainda.</p>
          <Link href="/dashboard/submissions/new" className="btn-primary mt-4 inline-flex">
            Criar primeira submissão
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/dashboard/submissions/${it.id}`}
                className="section-card block rounded-xl hover:border-[var(--primary)]/40 transition"
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="font-medium text-[var(--text-main)]">
                    {it.applicant_name || `Submissão #${it.id.slice(0, 8)}`}
                  </span>
                  <span className="badge-success text-xs">{it.status}</span>
                  <span className="text-sm text-[var(--text-subtle)] ml-auto">
                    {it.created_at ? new Date(it.created_at).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}