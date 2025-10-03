// src/app/api/submissions/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rows = await query(
      `
      SELECT
        id,
        status,
        raw_text,
        extracted_facts,
        classification,
        followup_questions,
        followup_answers,
        final_decision,
        created_at,
        updated_at
      FROM submissions
      WHERE id = $1
      LIMIT 1
      `,
      [params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Sem cache
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
