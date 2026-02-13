import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

const ALLOWED_PDF = "application/pdf";
const ALLOWED_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function isAllowedMimeType(mime: string): boolean {
  return mime === ALLOWED_PDF || mime === ALLOWED_DOCX;
}

export const maxDuration = 30;

/**
 * POST /api/submissions/extract-file
 * Body: multipart/form-data with field "file" (PDF or DOCX)
 * Returns: { text: string }
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_form", message: "Corpo da requisição deve ser multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Envie um arquivo no campo 'file'." },
      { status: 400 }
    );
  }

  const mime = file.type || "";
  if (!isAllowedMimeType(mime)) {
    return NextResponse.json(
      {
        error: "unsupported_type",
        message: "Aceito apenas PDF (.pdf) ou Word (.docx).",
      },
      { status: 400 }
    );
  }

  try {
    const { extractTextFromBuffer } = await import("@/lib/extract-document-text");
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromBuffer(buffer, mime);
    return NextResponse.json({ text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao extrair texto do arquivo.";
    return NextResponse.json(
      { error: "extract_failed", message },
      { status: 422 }
    );
  }
}
