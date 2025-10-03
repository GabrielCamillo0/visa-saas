import { query } from "@/lib/db";


export async function saveFacts(submissionId: string, facts: unknown) {
await query(`UPDATE submissions SET facts=$2, status='EXTRACTED' WHERE id=$1`, [submissionId, JSON.stringify(facts)]);
}