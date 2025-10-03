'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';


export default function NewSubmissionPage() {
const [text, setText] = useState("");
const router = useRouter();


async function onCreate() {
const res = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText: text }) });
const json = await res.json();
router.push(`/dashboard/submissions/${json.id}`);
}


return (
<div>
<h2 className="text-xl font-medium mb-3">Nova submissão</h2>
<textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Conte sua situação (objetivo, duração, histórico de vistos, emprego/estudos, etc.)" className="w-full h-48 p-3 border rounded mb-3" />
<button onClick={onCreate} className="px-4 py-2 rounded bg-black text-white">Criar</button>
</div>
);
}