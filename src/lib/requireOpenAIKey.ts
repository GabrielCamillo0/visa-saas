import { AIError } from "./openai";

/** Garante que a API key exista e retorna */
export function requireOpenAIKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) {
    throw new AIError("OPENAI_API_KEY ausente no ambiente do servidor.", "NO_API_KEY");
  }
  return k;
}
