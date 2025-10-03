import { query } from "@/lib/db";


export async function saveCandidates(submissionId: string, candidates: unknown) {
await query(`UPDATE submissions SET initial_hypothesis=$2, status='CLASSIFIED' WHERE id=$1`, [submissionId, JSON.stringify(candidates)]);
}