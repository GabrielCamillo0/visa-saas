import { NextResponse } from "next/server";

/**
 * POST /api/billing/create-portal
 * Stub: customer billing portal (e.g. Stripe/Lemon Squeezy) — implement if needed.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Billing portal not configured" },
    { status: 501 }
  );
}
