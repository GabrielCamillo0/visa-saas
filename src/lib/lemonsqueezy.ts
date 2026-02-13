// src/lib/lemonsqueezy.ts
import crypto from "node:crypto";
import { env } from "@/lib/env";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export type CreateCheckoutOptions = {
  variantId: string;
  storeId: string;
  customData?: Record<string, string | number>;
  redirectUrl?: string;
  email?: string;
  name?: string;
};

/**
 * Cria um checkout no Lemon Squeezy e retorna a URL.
 * Requer LEMONSQUEEZY_API_KEY.
 */
export async function createCheckout(options: CreateCheckoutOptions): Promise<{ url: string }> {
  const apiKey = env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error("LEMONSQUEEZY_API_KEY não configurado.");
  }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: options.redirectUrl ?? undefined,
        },
        checkout_data: {
          email: options.email ?? undefined,
          name: options.name ?? undefined,
          custom: options.customData ?? undefined,
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: String(options.storeId) },
        },
        variant: {
          data: { type: "variants", id: String(options.variantId) },
        },
      },
    },
  };

  const res = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Lemon Squeezy checkout failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as {
    data?: { attributes?: { url?: string } };
  };
  const url = json?.data?.attributes?.url;
  if (!url) {
    throw new Error("Lemon Squeezy não retornou URL do checkout.");
  }
  return { url };
}

/**
 * Verifica a assinatura do webhook (HMAC SHA256 do body com o signing secret).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.LEMONSQUEEZY_SIGNING_SECRET;
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}
