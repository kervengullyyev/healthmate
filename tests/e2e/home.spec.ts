import { expect, test } from "../helpers/authenticated";
import { fakeVoice } from "../helpers/fake-voice";

test("keeps Milo centered with one voice action and a compact account icon", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: /Milo/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Talk to Milo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(2);
  await expect(page.locator("nav, header, footer")).toHaveCount(0);
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect.poll(() => page.locator(".mascot-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("milo-einstein-desktop.png") });
});

test("Milo and the button fit on a mobile screen", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Talk to Milo", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect.poll(() => page.locator(".mascot-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("milo-einstein-mobile.png") });
});

test("the same button starts and ends voice while keeping the screen minimal", async ({
  page,
}) => {
  await fakeVoice(page, false);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { transport: { sdp: "answer" } } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await page
    .getByRole("button", { name: "End conversation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Talk to Milo", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.closes)).toBe(1);
  await expect(page.getByRole("button")).toHaveCount(2);
});

test("animates Einstein's SVG through speech gaps and stops on interruption", async ({ page }, testInfo) => {
  await fakeVoice(page, false, true);
  await page.route("**/api/session", route => route.fulfill({ json: { transport: { sdp: "answer" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(page.locator(".avatar-listening")).toBeVisible();
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  const svg = page.locator(".mascot-svg");
  await expect(svg).toHaveAttribute("src", /einstein\.svg#speaking$/);
  await expect(svg).toHaveCSS("opacity", "1");
  const frame = async () => (await page.locator(".avatar").screenshot({ animations: "allow" })).toString("base64");
  const first = await frame();
  await expect.poll(frame).not.toBe(first);
  await page.screenshot({ path: testInfo.outputPath("milo-einstein-speaking.png") });
  await page.evaluate(() => { window.voiceTest.speaking = false; });
  await page.waitForTimeout(1100);
  await expect(svg).toHaveAttribute("src", /#speaking$/);
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await page.waitForTimeout(5000);
  const later = await frame();
  await expect.poll(frame).not.toBe(later);
  await page.evaluate(() => { window.voiceTest.userSpeaking = true; });
  await expect(page.locator(".avatar-listening")).toBeVisible({ timeout: 1000 });
  await expect(svg).toHaveCount(0);
  await page.evaluate(() => { window.voiceTest.userSpeaking = false; window.voiceTest.speaking = false; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await expect(svg).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "End conversation", exact: true }).click();
  await expect(page.locator(".avatar-idle")).toBeVisible();
  await expect(svg).toHaveCount(0);
  await expect(page.locator(".mascot-image")).toHaveAttribute("src", /einstein-idle/);
});

test("keeps Einstein visible when the animated SVG cannot load", async ({ page }) => {
  await fakeVoice(page, false, true);
  await page.route("**/api/session", route => route.fulfill({ json: { transport: { sdp: "answer" } } }));
  await page.route("**/animations/einstein.svg", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await expect(page.locator(".avatar-speaking")).toBeVisible();
  await expect(page.locator(".mascot-image")).toHaveAttribute("src", /einstein-idle/);
  await expect.poll(() => page.locator(".mascot-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  await expect(page.locator(".mascot-svg")).toHaveCSS("opacity", "0");
  await expect(page.getByRole("button", { name: "End conversation", exact: true })).toBeEnabled();
});

test("uses a still image while idle or hidden without loading a WebGL runtime", async ({ page }) => {
  const graphicsRequests: string[] = [];
  page.on("request", r => { if (/\.wasm|\.riv|\/rive\//.test(r.url())) graphicsRequests.push(r.url()); });
  await fakeVoice(page, false, true);
  await page.route("**/api/session", route => route.fulfill({ json: { transport: { sdp: "answer" } } }));
  await page.goto("/");
  await expect(page.locator(".mascot-image")).toHaveAttribute("src", /einstein-idle/);
  await expect(page.locator(".mascot-svg, .avatar canvas")).toHaveCount(0);
  await expect.poll(() => page.locator(".mascot-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  const still = await page.locator(".avatar").screenshot();
  await page.waitForTimeout(500);
  expect(await page.locator(".avatar").screenshot()).toEqual(still);
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await expect(page.locator(".mascot-svg")).toHaveCSS("opacity", "1");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".mascot-svg")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".mascot-svg")).toHaveCSS("opacity", "1");
  await page.locator(".avatar").evaluate(e => { (e as HTMLElement).style.transform = "translateY(200vh)"; });
  await expect(page.locator(".mascot-svg")).toHaveCount(0);
  await page.locator(".avatar").evaluate(e => { (e as HTMLElement).style.transform = ""; });
  await expect(page.locator(".mascot-svg")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "End conversation", exact: true }).click();
  await expect(page.locator(".mascot-svg, .avatar canvas")).toHaveCount(0);
  expect(graphicsRequests).toEqual([]);
});

test("cancelling microphone setup stops a late stream without opening a session", async ({
  page,
}) => {
  await fakeVoice(page, true);
  let sessions = 0;
  await page.route("**/api/session", (route) => {
    sessions++;
    return route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(page.locator(".mascot-svg")).toHaveAttribute("src", /einstein\.svg#wave$/);
  await page
    .getByRole("button", { name: "Cancel connection", exact: true })
    .click();
  await page.evaluate(() => window.voiceTest.resolve());
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.stopped))
    .toBe(1);
  expect(sessions).toBe(0);
});

test("unconfigured voice reports a short error without requesting the microphone", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { liveConfigured: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Milo’s voice" }),
  ).toContainText("Milo’s voice isn’t configured yet.");
  await expect(page.getByRole("button")).toHaveCount(2);
});
