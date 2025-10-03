import { query } from "@/lib/db";


export async function saveQuestions(submissionId: string, questions: unknown) {
await query(`UPDATE submissions SET validation_questions=$2, status='VALIDATING' WHERE id=$1`, [submissionId, JSON.stringify(questions)]);
}