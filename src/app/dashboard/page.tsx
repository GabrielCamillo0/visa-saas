'use client';
import { useEffect, useState } from 'react';


type Item = { id: string; status: string; created_at: string };


export default function DashboardHome() {
const [items, setItems] = useState<Item[]>([]);
useEffect(() => { fetch('/api/submissions').then(r => r.json()).then(d => setItems(d.items || [])); }, []);
return (
<div>
<h2 className="text-xl font-medium mb-4">Minhas submissões</h2>
<ul className="space-y-2">
{items.map(it => (
<li key={it.id} className="p-3 rounded border bg-white">
<a className="underline" href={`/dashboard/submissions/${it.id}`}>#{it.id}</a>
<span className="ml-3 text-gray-600 text-sm">{it.status}</span>
</li>
))}
</ul>
</div>
);
}