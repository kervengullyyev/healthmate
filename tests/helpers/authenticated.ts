import { test as base, expect, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

export const testUser = { id: "google-test-alex", name: "Alex Test", email: "alex@example.test" };
export const testAuthSecret = "healthmate-playwright-session-secret-for-tests-only";
export async function sessionCookie(user = testUser) {
  return {
    name: "authjs.session-token",
    value: await encode({ secret: testAuthSecret, salt: "authjs.session-token", token: { sub: user.id, name: user.name, email: user.email }, maxAge: 3600 }),
    domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 3600,
  };
}
export async function authenticate(context: BrowserContext, user = testUser) {
  await context.addCookies([await sessionCookie(user)]);
}
export const test = base.extend({
  context: async ({ context }, provide) => {
    await authenticate(context);
    await provide(context);
  },
  request: async ({ playwright, baseURL }, provide) => {
    const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [await sessionCookie()], origins: [] } });
    await provide(request);
    await request.dispose();
  },
});
export { expect };
export type { Page } from "@playwright/test";
