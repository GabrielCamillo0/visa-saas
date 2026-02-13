import { NextRequest, NextResponse } from "next/server";
import { createSubmission } from "@/domain/services/submissions.create";
import { query } from "@/lib/db";
import { getCurrentUser, getUserId } from "@/lib/auth";

/**
 * Garante que o usuário exista na tabela users (para FK de submissions).
 */
async function ensureUserInDb(userId: string, email: string, name?: string | null) {
  await query(
    `INSERT INTO users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, users.email),
       name  = COALESCE(EXCLUDED.name, users.name)`,
    [userId, email ?? "", name ?? null]
  );
}

/**
 * Cria um submission.
 * Body: { rawText?: string, applicantName?: string, applicantPhone?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await ensureUserInDb(user.id, user.email ?? "", user.user_metadata?.name);

    const body = await req.json().catch(() => ({}));
    const rawText: string | undefined = typeof body?.rawText === "string" ? body.rawText : undefined;
    const applicantName: string | undefined = typeof body?.applicantName === "string" ? body.applicantName.trim() || undefined : undefined;
    const applicantPhone: string | undefined = typeof body?.applicantPhone === "string" ? body.applicantPhone.trim() || undefined : undefined;

    const { id } = await createSubmission(user.id, rawText, {
      applicantName: applicantName ?? null,
      applicantPhone: applicantPhone ?? null,
    });
    return NextResponse.json({ id });
  } catch (e: any) {
    console.error("submissions POST error", e);
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}

/**
 * Lista submissions do usuário autenticado (com paginação).
 * Query params: ?limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const rows = await query(
      `
      SELECT
        id,
        applicant_name,
        applicant_phone,
        raw_text,
        extracted_facts,
        classification,
        followup_questions,
        followup_answers,
        final_decision,
        created_at,
        updated_at
      FROM submissions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [userId, limit, offset]
    );

    return NextResponse.json({ items: rows, limit, offset });
  } catch (e: any) {
    console.error("submissions GET list error", e);
    const isConnectionError =
      e?.code === "ECONNREFUSED" ||
      e?.code === "ENOTFOUND" ||
      (Array.isArray(e?.errors) && e.errors?.some((err: any) => err?.code === "ECONNREFUSED"));
    if (isConnectionError) {
      return NextResponse.json(
        {
          error: "database_unavailable",
          message:
            "Não foi possível conectar ao PostgreSQL. Verifique se o banco está rodando e se DATABASE_URL no .env está correto (ex.: postgresql://user:senha@localhost:5432/visa-saas ou a URL do Supabase).",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "erro interno" }, { status: 500 });
  }
}
