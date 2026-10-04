import { expect, test } from "@playwright/test";
import { test as signedInTest, authenticate } from "../helpers/authenticated";
import { fakeVoice } from "../helpers/fake-voice";

test("Google sign-in gates every platform page and AI endpoint", async ({ page, request, baseURL }) => {
  for (const path of ["/", "/appointments/new", "/journey"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talk to Milo", exact: true })).toHaveCount(0);
  }
  for (const endpoint of ["chat", "plan", "session"]) {
    const response = await request.post(`/api/${endpoint}`, {
      headers: { Origin: new URL(baseURL!).origin },
      data: endpoint === "session" ? { sdp: "v=0\r\n" } : { messages: [] },
    });
    expect(response.status()).toBe(401);
  }
  expect((await request.get("/api/status")).status()).toBe(401);
});
test("Google authorization uses the configured callback and sign-in scopes", async ({ page }) => {
  await page.route("https://accounts.google.com/**", route => route.fulfill({ body: "Google authorization redirect reached" }));
  await page.goto("/login?callbackUrl=https%3A%2F%2Fother.example");
  const outbound = page.waitForRequest(request => request.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const url = new URL((await outbound).url());
  expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
  expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3001/api/auth/callback/google");
  expect(url.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});
test("a forged session and an OAuth error never grant platform access", async ({ page, context, request }) => {
  await context.addCookies([{ name: "authjs.session-token", value: "forged", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  const response = await request.get("/api/status", { headers: { Cookie: "authjs.session-token=forged" } });
  expect(response.status()).toBe(401);
  await page.goto("/login?error=AccessDenied");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Google sign-in wasn't completed");
});
signedInTest("session reads cannot reissue a cookie after concurrent sign-out", async ({ request }) => {
  const session = await request.get("/api/auth/session");
  expect(session.status()).toBe(200);
  expect((await session.json()).user.id).toBe("google-test-alex");
  expect(session.headers()["set-cookie"]).toBeUndefined();
  const status = await request.get("/api/status");
  expect(status.status()).toBe(200);
  expect(status.headers()["set-cookie"]).toBeUndefined();
});
signedInTest("sign-out ends voice, clears the session and protects browser back navigation", async ({ page, context }) => {
  await fakeVoice(page, false);
  await page.route("**/api/session", route => route.fulfill({ json: { session: { id: "test" }, transport: { sdp: "answer" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(page.getByRole("button", { name: "End conversation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).click();
  const cleanup: string[] = [];
  page.on("console", message => cleanup.push(message.text()));
  await page.evaluate(async () => {
    const track = (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks()[0];
    const stop = track.stop.bind(track);
    track.stop = () => { stop(); console.log("milo-mic-stopped"); };
  });
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await context.cookies()).some(cookie => cookie.name === "authjs.session-token" && cookie.value)).toBe(false);
  expect(cleanup).toContain("milo-mic-stopped");
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
});
signedInTest("switching Google accounts does not expose the other account's bookings", async ({ page, context }) => {
  await page.goto("/appointments/new");
  await page.getByLabel("Date", { exact: true }).fill(await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }));
  await page.getByLabel("Description", { exact: true }).fill("Alex's private demo summary");
  await page.getByRole("button", { name: "Book demo appointment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo appointment booked", exact: true })).toBeVisible();
  await fakeVoice(page, false);
  await page.route("**/api/session", route => route.fulfill({ json: { session: { id: "test" }, transport: { sdp: "answer" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(page.getByRole("button", { name: "End conversation", exact: true })).toBeVisible();
  await page.evaluate(() => window.voiceTest.message("user", "Alex private conversation"));
  await context.clearCookies();
  await authenticate(context, { id: "google-test-bob", name: "Bob Test", email: "bob@example.test" });
  const otherWindow = await context.newPage();
  await otherWindow.goto("/");
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("button", { name: "Talk to Milo", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBeGreaterThan(0);
  await otherWindow.close();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Profile", exact: true })).toContainText("bob@example.test");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Appointments", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Appointments", exact: true })).toContainText("No booked appointments yet.");
  await expect(page.getByText("Alex's private demo summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Records", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Records", exact: true })).not.toContainText("Alex private conversation");
});
