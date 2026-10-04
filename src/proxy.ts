import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth } from "@/auth";

const checkAccess: (request: NextAuthRequest, event: NextFetchEvent) => Response = (request) => {
  if (request.auth?.user?.id) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
};
const authenticatedProxy = auth(checkAccess);

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const response = await authenticatedProxy(request, event);
  // A delayed protected-page/API read must not reissue a signed-out cookie.
  response?.headers.delete("set-cookie");
  return response;
}

export const config = {
  matcher: ["/", "/journey/:path*", "/appointments/:path*", "/api/chat", "/api/plan", "/api/session", "/api/status"],
};
