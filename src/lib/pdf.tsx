import { Document, Page, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import { query } from '@/lib/db';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12 },
  h1: { fontSize: 18, marginBottom: 8 },
  h2: { fontSize: 14, marginTop: 12, marginBottom: 6 },
  li: { marginBottom: 4 },
});

async function fetchSubmission(submissionId: string) {
  const rows = await query<any>(`SELECT * FROM submissions WHERE id=$1`, [submissionId]);
  return rows[0];
}

export async function renderSubmissionToPDF(submissionId: string): Promise<Buffer> {
  const sub = await fetchSubmission(submissionId);
  if (!sub) return Buffer.from('Not found');
  const d = sub.final_decision || {};
  const noQualifying = d.qualifies_for_visa === false;
  const pathToQualify = d.path_to_qualify;
  const topVisas = Array.isArray(d.top_visas) ? d.top_visas : [];
  const actionPlan = Array.isArray(d.action_plan) ? d.action_plan : [];
  const pathSteps = pathToQualify && Array.isArray(pathToQualify.steps) ? pathToQualify.steps : [];

  const Doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Resultado — Visa SaaS</Text>
        <Text>Submission: {sub.id}</Text>
        <Text>Status: {sub.status}</Text>

        {noQualifying ? (
          <>
            <Text style={styles.h2}>Resultado</Text>
            <Text style={styles.li}>Você não se enquadra em nenhum visto no momento. Siga o caminho abaixo para se preparar.</Text>
            {pathToQualify?.summary ? (
              <>
                <Text style={styles.h2}>Caminho para se qualificar</Text>
                <Text style={styles.li}>{pathToQualify.summary}</Text>
              </>
            ) : null}
            <Text style={styles.h2}>Etapas recomendadas</Text>
            {pathSteps.map((it: string | { step?: string; url?: string }, i: number) => {
              const step = typeof it === "string" ? it : (it?.step || "");
              const url = typeof it === "object" && it?.url ? it.url : "";
              return (
                <Text key={i} style={styles.li}>
                  {`${i + 1}. ${step}`}
                  {url ? ` — ${url}` : ""}
                </Text>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.h2}>Vistos Recomendados</Text>
            {topVisas.length >= 1 ? (
              topVisas.map((v: { visa?: string; confidence?: number; rationale?: string }, i: number) => (
                <Text key={i} style={styles.li}>
                  {i + 1}º {v.visa || "—"} ({Math.round(((v.confidence ?? 0) * 100))}%)
                </Text>
              ))
            ) : (
              <Text style={styles.li}>{d.selected_visa || "—"} ({Math.round(((d.confidence || 0) * 100))}%)</Text>
            )}

            <Text style={styles.h2}>Plano de Ação</Text>
            {actionPlan.map((it: string | { step?: string; url?: string }, i: number) => {
              const step = typeof it === "string" ? it : (it?.step || "");
              const url = typeof it === "object" && it?.url ? it.url : "";
              return (
                <Text key={i} style={styles.li}>
                  {`${i + 1}. ${step}`}
                  {url ? ` — ${url}` : ""}
                </Text>
              );
            })}

            <Text style={styles.h2}>Checklist de Documentos</Text>
            {(d.documents_checklist || []).map((s: string, i: number) => (
              <Text key={i} style={styles.li}>{`• ${s}`}</Text>
            ))}
          </>
        )}

        {Array.isArray(d.risks_and_flags) && d.risks_and_flags.length > 0 && (
          <>
            <Text style={styles.h2}>Riscos / Observações</Text>
            {d.risks_and_flags.map((s: string, i: number) => (
              <Text key={i} style={styles.li}>{`• ${s}`}</Text>
            ))}
          </>
        )}
      </Page>
    </Document>
  );

  const instance = pdf(Doc);
  const stream = await instance.toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
