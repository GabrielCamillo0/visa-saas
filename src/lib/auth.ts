import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Retorna o usuário autenticado (Supabase Auth) ou null se não autenticado.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * Retorna o ID do usuário autenticado ou null se não autenticado.
 */
export async function getUserId(_req?: NextRequest | Request): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}