// src/domain/services/submissions.create.ts
"use server";

import { query } from "@/lib/db";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Gera um ID curto (16 chars) compatível com Node/Edge sem depender de libs externas. */
function makeId(len = 16): string {
  // Tenta usar fonte criptográfica se disponível
  const g: any = globalThis as any;
  if (g.crypto?.getRandomValues) {
    const bytes = new Uint8Array(len);
    g.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }
  // Fallback para Math.random (ainda suficiente p/ IDs de tabela)
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function createSubmission(userId: string, rawText?: string) {
  const id = makeId(); // ex.: "l03siv2dzsglhs4n"
  await query(
    `INSERT INTO submissions (id, user_id, raw_text) VALUES ($1,$2,$3)`,
    [id, userId, rawText ?? null]
  );
  return { id };
}
