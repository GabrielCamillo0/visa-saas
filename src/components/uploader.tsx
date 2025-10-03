'use client';
import { useState } from 'react';


export function Uploader({ onUploaded }: { onUploaded?: (url: string) => void }) {
const [busy, setBusy] = useState(false);
const [error, setError] = useState<string | null>(null);


async function handleFile(file: File) {
setBusy(true); setError(null);
try {
const path = `uploads/${Date.now()}-${encodeURIComponent(file.name)}`;
const signed = await fetch('/api/files/upload', {
method: 'POST', headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ path })
}).then(r=>r.json());


await fetch(signed.url, { method: 'PUT', body: file });
onUploaded?.(signed.url.split('?')[0] || path);
} catch (e: any) {
setError(e?.message || 'Falha no upload');
} finally { setBusy(false); }
}


return (
<div className="border rounded p-3 bg-white">
<input type="file" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) handleFile(f); }} />
{busy && <p className="text-sm text-gray-600 mt-2">Enviando...</p>}
{error && <p className="text-sm text-red-600 mt-2">{error}</p>}
</div>
);
}