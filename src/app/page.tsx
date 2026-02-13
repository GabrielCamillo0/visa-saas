import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <section className="container-app py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-[var(--text-main)]">
            Entenda qual visto dos EUA faz sentido para você
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-[var(--text-muted)] leading-relaxed">
            O Visa SaaS analisa seu perfil, objetivo de viagem e documentos para recomendar os vistos mais adequados e montar um plano de ação com links oficiais — sem ser uma página de submissões, e sim um guia claro para o seu próximo passo.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="btn-primary inline-flex items-center justify-center gap-2 py-3 px-8 text-base">
              Começar agora
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link href="/login" className="btn-secondary inline-flex items-center justify-center py-3 px-8 text-base">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* O que é o Visa SaaS */}
      <section className="border-t border-[var(--border-default)]">
        <div className="container-app py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-main)] text-center mb-10">
            O que é o Visa SaaS?
          </h2>
          <div className="mx-auto max-w-2xl space-y-6 text-[var(--text-muted)] leading-relaxed">
            <p>
              O <strong className="text-[var(--text-main)]">Visa SaaS</strong> é uma ferramenta que ajuda você a entender melhor o universo de vistos dos Estados Unidos. Em vez de se perder em dezenas de categorias (turismo, estudo, trabalho, investimento, família, loteria, etc.), você descreve seu perfil e objetivo, e o sistema sugere os vistos que mais fazem sentido para o seu caso.
            </p>
            <p>
              O foco não é substituir um advogado ou o consulado: é organizar suas ideias, mostrar opções coerentes com sua situação e indicar um caminho prático — incluindo links para formulários oficiais e próximos passos — para você dar andamento com mais clareza.
            </p>
          </div>
        </div>
      </section>

      {/* Propósito */}
      <section className="border-t border-[var(--border-default)] bg-[var(--bg-surface)]/50">
        <div className="container-app py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-main)] text-center mb-10">
            Propósito
          </h2>
          <div className="mx-auto max-w-2xl space-y-6 text-[var(--text-muted)] leading-relaxed">
            <p>
              O propósito do Visa SaaS é <strong className="text-[var(--text-main)]">reduzir a confusão</strong> em torno dos vistos americanos. Muitas pessoas não sabem por onde começar: será B2, F1, H1B, E2, EB-5, DV, familiar? Cada visto tem requisitos e prazos diferentes.
            </p>
            <p>
              Aqui você encontra uma análise orientada ao seu perfil (formação, experiência, objetivo de viagem, família, investimento, etc.), uma classificação dos vistos mais adequados com nível de confiança e um plano de ação detalhado — com checklist de documentos e links para os sites oficiais onde você pode agendar entrevista, preencher formulários e pagar taxas.
            </p>
            <p>
              O objetivo é que você saia com <strong className="text-[var(--text-main)]">direção clara</strong>, sabendo quais vistos considerar e quais passos concretos dar a seguir, seja para turismo, estudo, trabalho ou imigração.
            </p>
          </div>
        </div>
      </section>

      {/* Como funciona (resumido) */}
      <section className="border-t border-[var(--border-default)]">
        <div className="container-app py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-main)] text-center mb-12">
            Como funciona
          </h2>
          <ul className="mx-auto max-w-xl space-y-6 text-[var(--text-muted)]">
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)] font-semibold text-sm">1</span>
              <span>Você preenche um formulário com dados do seu perfil, objetivo da viagem e situação (estudo, trabalho, investimento, família, etc.).</span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)] font-semibold text-sm">2</span>
              <span>O sistema analisa as informações e classifica os vistos mais adequados, com nível de confiança para cada um.</span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)] font-semibold text-sm">3</span>
              <span>Você responde algumas perguntas de validação para refinar a análise.</span>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)] font-semibold text-sm">4</span>
              <span>Você recebe a decisão (até 2 vistos recomendados), plano de ação passo a passo e checklist de documentos, com links oficiais para dar andamento.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-[var(--border-default)] bg-[var(--bg-surface)]/50">
        <div className="container-app py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[var(--text-main)]">
              Pronto para ter uma direção clara?
            </h2>
            <p className="mt-4 text-[var(--text-muted)]">
              Crie sua conta, preencha seu perfil e receba recomendações e um plano de ação personalizado.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="btn-primary inline-flex items-center justify-center gap-2 py-3 px-8 text-base">
                Criar conta
              </Link>
              <Link href="/pricing" className="btn-secondary inline-flex items-center justify-center py-3 px-8 text-base">
                Ver planos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
