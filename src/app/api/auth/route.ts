import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';


export async function GET(req: NextRequest) {
const userId = await getUserId(req);
return NextResponse.json({ userId });
}