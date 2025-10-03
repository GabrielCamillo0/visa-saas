// Substitua por Clerk/NextAuth. Aqui um mock para desenvolvimento.
import { NextRequest } from "next/server";


export async function getUserId(_req: NextRequest): Promise<string> {
// Em produção, leia do token/session. Para dev, fixe um id.
return "dev-user-0001";
}