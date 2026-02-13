import Link from "next/link";

export default function Pricing() {
  return (
    <div className="container-app py-10 sm:py-16">
      <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">Planos</h1>
      <p className="text-[var(--text-muted)] mb-8">Escolha o plano ideal para sua necessidade.</p>

      <div className="grid gap-6 sm:grid-cols-2 max-w-3xl">
        <div className="section-card rounded-xl">
          <h2 className="text-xl font-semibold text-[var(--text-main)]">Basic</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">X submissões/mês</p>
          <Link href="/signup" className="btn-secondary mt-4 inline-block">
            Começar
          </Link>
        </div>
        <div className="section-card rounded-xl border-[var(--primary)]/40">
          <h2 className="text-xl font-semibold text-[var(--text-main)]">Pro</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Submissões ilimitadas</p>
          <Link href="/signup" className="btn-primary mt-4 inline-block">
            Assinar Pro
          </Link>
        </div>
      </div>
    </div>
  );
}