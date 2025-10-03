import { Document, Page, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { query } from '@/lib/db';


const styles = StyleSheet.create({
page: { padding: 32, fontSize: 12 },
h1: { fontSize: 18, marginBottom: 8 },
h2: { fontSize: 14, marginTop: 12, marginBottom: 6 },
li: { marginBottom: 4 },
});


async function fetchSubmission(submissionId: string){
const rows = await query<any>(`SELECT * FROM submissions WHERE id=$1`, [submissionId]);
return rows[0];
}


export async function renderSubmissionToPDF(submissionId: string): Promise<Buffer> {
const sub = await fetchSubmission(submissionId);
if (!sub) return Buffer.from('Not found');
const d = sub.final_decision || {};


const Doc = (
<Document>
<Page size="A4" style={styles.page}>
<Text style={styles.h1}>Resultado — Visa SaaS</Text>
<Text>Submission: {sub.id}</Text>
<Text>Status: {sub.status}</Text>


<Text style={styles.h2}>Visto Selecionado</Text>
<Text>{d.selected_visa || '—'} ({Math.round(((d.confidence||0)*100))}%)</Text>


<Text style={styles.h2}>Plano de Ação</Text>
{(d.action_plan||[]).map((s: string, i: number) => (<Text key={i} style={styles.li}>{`${i+1}. ${s}`}</Text>))}


<Text style={styles.h2}>Checklist de Documentos</Text>
{(d.documents_checklist||[]).map((s: string, i: number) => (<Text key={i} style={styles.li}>{`• ${s}`}</Text>))}


{Array.isArray(d.risks_and_flags) && d.risks_and_flags.length > 0 && (
<>
<Text style={styles.h2}>Riscos / Observações</Text>
{d.risks_and_flags.map((s: string, i: number) => (<Text key={i} style={styles.li}>{`• ${s}`}</Text>))}
</>
)}
</Page>
</Document>
);


const instance = pdf(Doc);
const buffer = await instance.toBuffer();
return buffer as Buffer;
}