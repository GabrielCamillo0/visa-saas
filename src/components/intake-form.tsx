'use client';
import { useState } from 'react';
import { Uploader } from './uploader';


export function IntakeForm({ onCreate }: { onCreate: (payload: { rawText?: string; fileUrls?: string[] }) => Promise<void> }) {
const [text, setText] = useState('');
const [files, setFiles] = useState<string[]>([]);


return (
<div className="space-y-3">
<textarea className="w-full h-40 p-3 border rounded" placeholder="Descreva seu caso..." value={text} onChange={(e)=>setText(e.target.value)} />
<Uploader onUploaded={(url)=>setFiles(prev=>[...prev, url])} />
<div className="text-sm text-gray-600">Arquivos: {files.length}</div>
<button onClick={()=>onCreate({ rawText: text, fileUrls: files })} className="px-4 py-2 rounded bg-black text-white">Criar submissão</button>
</div>
);
}