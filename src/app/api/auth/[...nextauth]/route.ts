import type { NextRequest } from "next/server";
import { handlers } from "@/auth";

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  // Reading a session must not restore its cookie after a concurrent sign-out.
  // Polling does not renew the 24-hour session cookie.
  if (request.nextUrl.pathname === "/api/auth/session") response.headers.delete("set-cookie");
  return response;
}
export const POST = handlers.POST;
