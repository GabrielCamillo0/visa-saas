// src/app/api/billing/lemonsqueezy/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { query } from "@/lib/db";

export const runtime = "nodejs";

// Garante que o body não seja parseado antes (precisamos do raw para a assinatura)
export const dynamic = "force-dynamic";

type WebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: { user_id?: string };
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      customer_id?: number;
      status?: string;
      user_email?: string;
      first_order_item?: { order_id?: number };
    };
  };
};

/**
 * POST /api/billing/lemonsqueezy/webhook
 * Recebe eventos do Lemon Squeezy (order_created, subscription_created, etc.)
 * e atualiza a tabela users com subscription_status e lemon_customer_id.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? null;

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name ?? req.headers.get("x-event-name") ?? "";
  const customData = payload.meta?.custom_data ?? {};
  const userId = customData.user_id as string | undefined;

  if (!userId) {
    console.warn("[lemonsqueezy webhook] event without user_id in custom_data:", eventName);
    return NextResponse.json({ received: true });
  }

  try {
    if (eventName === "order_created") {
      const attrs = payload.data?.attributes;
      const customerId = attrs?.customer_id;
      if (customerId != null) {
        await query(
          `UPDATE users SET lemon_customer_id = $2 WHERE id = $1`,
          [userId, String(customerId)]
        );
      }
    }

    if (
      eventName === "subscription_created" ||
      eventName === "subscription_updated" ||
      eventName === "subscription_resumed"
    ) {
      const attrs = payload.data?.attributes;
      const status = attrs?.status ?? "active";
      const subId = payload.data?.id;
      await query(
        `UPDATE users SET subscription_status = $2, lemon_subscription_id = $3 WHERE id = $1`,
        [userId, status, subId ? String(subId) : null]
      );
    }

    if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
      await query(
        `UPDATE users SET subscription_status = $2 WHERE id = $1`,
        [userId, "cancelled"]
      );
    }

    if (eventName === "subscription_payment_failed" || eventName === "subscription_payment_recovered") {
      const attrs = payload.data?.attributes;
      const status = attrs?.status ?? (eventName === "subscription_payment_failed" ? "past_due" : "active");
      await query(
        `UPDATE users SET subscription_status = $2 WHERE id = $1`,
        [userId, status]
      );
    }
  } catch (e) {
    console.error("[lemonsqueezy webhook] handler error", e);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
