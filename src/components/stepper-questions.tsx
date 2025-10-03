'use client';
import { useState } from 'react';


export function StepperQuestions({ questions, onSave, onFinalize }: { questions: any[]; onSave: (answers: Record<string,string>)=>Promise<void>; onFinalize: ()=>Promise<void>; }){
const [answers, setAnswers] = useState<Record<string,string>>({});
return (
<div className="space-y-3">
{questions.map((q) => (
<div key={q.id} className="border rounded p-3 bg-white">
<div className="mb-2">{q.text}</div>
<input className="w-full border p-2 rounded" value={answers[q.id]||''} onChange={(e)=>setAnswers(s=>({ ...s, [q.id]: e.target.value }))} />
</div>
))}
<div className="flex gap-2">
<button className="px-3 py-2 rounded bg-black text-white" onClick={()=>onSave(answers)}>Salvar respostas</button>
<button className="px-3 py-2 rounded bg-black text-white" onClick={onFinalize}>Finalizar</button>
</div>
</div>
);
}