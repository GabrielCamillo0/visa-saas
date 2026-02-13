import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { renderSubmissionToPDF } from "@/lib/pdf";

/**
 * GET /dashboard/submissions/[id]/pdf — gera PDF da submissão.
 * Só retorna o PDF se a submissão pertencer ao usuário autenticado.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await query<{ id: string }>(
    `SELECT id FROM submissions WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [params.id, userId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await renderSubmissionToPDF(params.id);
    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="submission-${params.id}.pdf"`,
      },
    });
  } catch (e) {
    console.error("pdf route error", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
