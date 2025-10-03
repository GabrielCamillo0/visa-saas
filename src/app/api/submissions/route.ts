import { NextRequest, NextResponse } from "next/server";
import { createSubmission } from "@/domain/services/submissions.create";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";

/**
 * Cria um submission.
 * Body: { rawText?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawText: string | undefined = typeof body?.rawText === "string" ? body.rawText : undefined;

    const { id } = await createSubmission(userId, rawText);
    return NextResponse.json({ id });
  } catch (e: any) {
    console.error("submissions POST error", e);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}

/**
 * Lista submissions (com paginação simples).
 * Query params: ?limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const rows = await query(
      `
      SELECT
        id,
        raw_text,
        extracted_facts,
        classification,
        followup_questions,
        followup_answers,
        final_decision,
        created_at,
        updated_at
      FROM submissions
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    return NextResponse.json({ items: rows, limit, offset });
  } catch (e: any) {
    console.error("submissions GET list error", e);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
