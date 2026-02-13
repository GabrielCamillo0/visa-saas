import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para o browser (usa cookies para OAuth/callback no servidor). */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
