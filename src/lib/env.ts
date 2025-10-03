// src/lib/env.ts
import { z } from "zod";

const coreSchema = z.object({
  DATABASE_URL: z.string().min(1),
  STORAGE_PROVIDER: z.string().default("local"),
});

const optionalSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  AI_MOCK: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_BASIC: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRICE_PRO: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
});

export const envCore = coreSchema.parse(process.env);
export const env = {
  ...envCore,
  ...optionalSchema.parse(process.env),
} as z.infer<typeof coreSchema> & z.infer<typeof optionalSchema>;

export function requireOpenAIKey() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY ausente. Defina no .env para usar recursos de IA.");
  }
  return env.OPENAI_API_KEY;
}
