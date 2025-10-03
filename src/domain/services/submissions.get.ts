import { query } from "@/lib/db";


export async function getSubmission(id: string) {
const rows = await query(`SELECT * FROM submissions WHERE id=$1`, [id]);
return rows[0] || null;
}


export async function listSubmissions(userId: string) {
return query(`SELECT * FROM submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]);
}