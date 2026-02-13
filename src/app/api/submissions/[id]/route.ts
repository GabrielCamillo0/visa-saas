// src/app/api/submissions/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const rows = await query(
      `
      SELECT
        id,
        status,
        applicant_name,
        applicant_phone,
        extracted_facts,
        classification,
        followup_questions,
        followup_answers,
        final_decision,
        created_at,
        updated_at
      FROM submissions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [params.id, userId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(JSON.stringify(rows[0]), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("submissions GET by id error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
