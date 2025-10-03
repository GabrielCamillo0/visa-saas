import { query } from "@/lib/db";


export async function saveFinal(submissionId: string, finalDecision: unknown, guidance: unknown) {
await query(
`UPDATE submissions SET final_decision=$2, guidance=$3, status='DELIVERED' WHERE id=$1`,
[submissionId, JSON.stringify(finalDecision), JSON.stringify(guidance)]
);
}