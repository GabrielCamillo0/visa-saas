'use client';

import { useRouter } from 'next/navigation';
import SubmissionForm from './SubmissionForm';

export default function NewSubmissionPage() {
  const router = useRouter();

  async function handleSubmit(payload: { rawText: string; applicantName: string; applicantPhone: string }) {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: payload.rawText,
        applicantName: payload.applicantName,
        applicantPhone: payload.applicantPhone,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? 'Erro ao criar submissão.');
    if (json.id) router.push(`/dashboard/submissions/${json.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text-main)]">Nova submissão</h1>
      <div className="section-card rounded-xl">
        <SubmissionForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
