import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';


export const runtime = 'nodejs';


export async function POST(req: NextRequest){
if (!stripe) return NextResponse.json({ error: 'stripe_not_configured' }, { status: 500 });
const { priceId, success_url, cancel_url } = await req.json();
const session = await stripe.checkout.sessions.create({
mode: 'subscription',
line_items: [{ price: priceId || env.NEXT_PUBLIC_STRIPE_PRICE_BASIC, quantity: 1 }],
success_url: success_url || `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
cancel_url: cancel_url || `${env.NEXT_PUBLIC_APP_URL}/pricing`,
});