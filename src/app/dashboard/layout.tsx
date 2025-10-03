import type { ReactNode } from "react";


export default function DashLayout({ children }: { children: ReactNode }) {
return (
<div className="mx-auto max-w-4xl p-6">
<header className="flex items-center justify-between mb-6">
<h1 className="text-2xl font-semibold">Dashboard</h1>
<nav className="text-sm space-x-4">
<a className="underline" href="/dashboard">Submissões</a>
<a className="underline" href="/dashboard/submissions/new">Nova</a>
</nav>
</header>
{children}
</div>
);
}