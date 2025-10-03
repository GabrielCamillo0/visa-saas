import { NextRequest, NextResponse } from "next/server";
import { getSignedUploadUrl } from "@/lib/s3";


export async function POST(req: NextRequest) {
const { path, contentType } = await req.json();
if (!path) return NextResponse.json({ error: 'missing_path' }, { status: 400 });
const signed = await getSignedUploadUrl(path, contentType);
return NextResponse.json(signed);
}