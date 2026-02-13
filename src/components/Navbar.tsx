"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard") ?? false;
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const publicLinks = (
    <>
      <Link
        href="/pricing"
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] transition"
      >
        Planos
      </Link>
      <Link
        href="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] transition"
      >
        Entrar
      </Link>
      <Link
        href="/signup"
        className="btn-primary text-sm py-2 px-4"
      >
        Cadastre-se
      </Link>
    </>
  );

  const dashboardLinks = (
    <>
      <Link
        href="/dashboard"
        className="rounded-lg px-3 py-2 text-sm font-medium transition"
        style={{
          color: pathname === "/dashboard" ? "var(--primary)" : "var(--text-muted)",
          backgroundColor: pathname === "/dashboard" ? "rgba(37, 99, 235, 0.12)" : "transparent",
        }}
      >
        Submissões
      </Link>
      <Link
        href="/dashboard/submissions/new"
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] transition"
      >
        Nova submissão
      </Link>
      <Link
        href="/dashboard/billing"
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] transition"
      >
        Assinatura
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--danger)] transition"
      >
        Sair
      </button>
    </>
  );

  const navLinks = isDashboard ? dashboardLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 glass border-b border-[var(--border-default)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={isDashboard ? "/dashboard" : "/"}
          className="flex shrink-0 items-center gap-2 font-semibold text-[var(--text-main)] hover:opacity-90 transition"
        >
          <span className="text-gradient">Visa</span>
          <span className="hidden sm:inline text-[var(--text-muted)]">SaaS</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex md:items-center md:gap-1">
          {navLinks}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] transition"
          aria-expanded={mobileOpen}
          aria-label="Abrir menu"
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {isDashboard ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-main)]" onClick={() => setMobileOpen(false)}>
                  Submissões
                </Link>
                <Link href="/dashboard/submissions/new" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Nova submissão
                </Link>
                <Link href="/dashboard/billing" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Assinatura
                </Link>
                <button type="button" onClick={() => { setMobileOpen(false); handleLogout(); }} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--danger)]">
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/pricing" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Planos
                </Link>
                <Link href="/login" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-muted)]" onClick={() => setMobileOpen(false)}>
                  Entrar
                </Link>
                <Link href="/signup" className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--primary)]" onClick={() => setMobileOpen(false)}>
                  Cadastre-se
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
