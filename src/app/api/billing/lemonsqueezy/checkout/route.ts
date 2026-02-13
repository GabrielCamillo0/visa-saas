// src/app/api/billing/lemonsqueezy/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCheckout } from "@/lib/lemonsqueezy";
import { env } from "@/lib/env";
import { query } from "@/lib/db";

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

export const runtime = "nodejs";

/**
 * POST /api/billing/lemonsqueezy/checkout
 * Body: { variantId?: string } — opcional; usa LEMONSQUEEZY_VARIANT_ID se não enviar.
 * Retorna: { url: string } para redirecionar o usuário ao checkout Lemon Squeezy.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const storeId = env.LEMONSQUEEZY_STORE_ID;
  const variantId =
    (await req.json().catch(() => ({}))).variantId ||
    env.LEMONSQUEEZY_VARIANT_ID ||
    env.NEXT_PUBLIC_LEMONSQUEEZY_VARIANT_ID;

  if (!storeId || !variantId) {
    return NextResponse.json(
      { error: "lemonsqueezy_not_configured", message: "Configure LEMONSQUEEZY_STORE_ID e LEMONSQUEEZY_VARIANT_ID (ou variantId no body)." },
      { status: 500 }
    );
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  await ensureUserInDb(user.id, user.email ?? "", user.user_metadata?.name);

  try {
    const { url } = await createCheckout({
      storeId,
      variantId,
      customData: { user_id: user.id },
      redirectUrl: `${baseUrl}/dashboard?checkout=success`,
      email: user.email ?? undefined,
      name: user.user_metadata?.name ?? undefined,
    });

    return NextResponse.json({ url });
  } catch (e: any) {
    console.error("lemonsqueezy checkout error", e);
    return NextResponse.json(
      { error: "checkout_failed", message: e?.message ?? "Erro ao criar checkout." },
      { status: 500 }
    );
  }
}
