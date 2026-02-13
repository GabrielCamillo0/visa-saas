const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_PDF = "application/pdf";
const ALLOWED_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isAllowedMimeType(mime: string): boolean {
  return mime === ALLOWED_PDF || mime === ALLOWED_DOCX;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error(
      `Arquivo muito grande. Máximo: ${MAX_SIZE_BYTES / 1024 / 1024} MB`
    );
  }
  if (mimeType === ALLOWED_PDF) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      await parser.destroy();
      return result?.text?.trim() ?? "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (mimeType === ALLOWED_DOCX) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }
  throw new Error(
    "Formato não suportado. Use PDF ou DOCX (application/pdf ou application/vnd.openxmlformats-officedocument.wordprocessingml.document)."
  );
}
