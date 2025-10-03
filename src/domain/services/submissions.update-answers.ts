import { query } from "@/lib/db";


export async function saveAnswers(submissionId: string, answers: unknown) {
await query(`UPDATE submissions SET validation_answers=$2 WHERE id=$1`, [submissionId, JSON.stringify(answers)]);
}