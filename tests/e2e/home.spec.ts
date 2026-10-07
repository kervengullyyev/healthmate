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
  await expect(page.locator(".avatar canvas")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("milo-rive-desktop.png") });
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
  await expect(page.locator(".avatar canvas")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("milo-rive-mobile.png") });
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

test("animates the Rive avatar through speech gaps and responds to interruption", async ({ page }, testInfo) => {
  await fakeVoice(page, false, true);
  await page.route("**/api/session", route => route.fulfill({ json: { transport: { sdp: "answer" } } }));
  await page.goto("/");
  const canvas = page.locator(".avatar canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS("opacity", "1");
  const frame = () => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  })).toBe(true);
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(page.locator(".avatar-listening")).toBeVisible();
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await expect(page.locator(".avatar-speaking")).toBeVisible();
  const speakingFrame = await frame();
  await expect.poll(frame).not.toBe(speakingFrame);
  await page.screenshot({ path: testInfo.outputPath("milo-rive-speaking.png") });
  await page.evaluate(() => { window.voiceTest.speaking = false; });
  await page.waitForTimeout(1100);
  await expect(page.locator(".avatar-speaking")).toBeVisible();
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await page.waitForTimeout(5000);
  const laterFrame = await frame();
  await expect.poll(frame).not.toBe(laterFrame);
  await page.evaluate(() => { window.voiceTest.userSpeaking = true; });
  await expect(page.locator(".avatar-listening")).toBeVisible({ timeout: 1000 });
  await page.evaluate(() => { window.voiceTest.userSpeaking = false; window.voiceTest.speaking = false; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.voiceTest.speaking = true; });
  await expect(page.locator(".avatar-speaking")).toBeVisible();
  await page.evaluate(() => { window.voiceTest.speaking = false; });
  await expect(page.locator(".avatar-listening")).toBeVisible();
  await page.getByRole("button", { name: "End conversation", exact: true }).click();
  await expect(page.locator(".avatar-idle")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(2);
});

test("keeps the supplied character visible if its Rive file cannot load", async ({ page }) => {
  await page.route("**/animations/milo.riv", route => route.abort());
  await page.goto("/");
  const fallback = page.locator(".avatar img");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("src", /milo-rive-fallback/);
  await expect(page.getByRole("button", { name: "Talk to Milo", exact: true })).toBeEnabled();
});

test("preserves the original avatar's feathered brush shading", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(".avatar canvas");
  await expect(canvas).toHaveCSS("opacity", "1");
  // In the supplied artboard, the shadow fades below the feet at this point.
  // Canvas2D omits feathering entirely and leaves this pixel transparent.
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const alpha = element.getContext("2d")!.getImageData(
      Math.floor(element.width * 0.5), Math.floor(element.height * 0.81), 1, 1,
    ).data[3];
    return alpha > 5 && alpha < 220;
  })).toBe(true);
});

test.describe("avatar rendering budget", () => {
  test.use({ deviceScaleFactor: 3 });
  test("rests when idle or hidden and limits active rendering", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.drawImage;
      (window as unknown as { avatarDraws: number }).avatarDraws = 0;
      CanvasRenderingContext2D.prototype.drawImage = function (image: CanvasImageSource, ...coordinates: number[]) {
        if (this.canvas.classList.contains("mascot-rive")) {
          (window as unknown as { avatarDraws: number }).avatarDraws++;
        }
        return Reflect.apply(original, this, [image, ...coordinates]);
      };
    });
    await fakeVoice(page, false, true);
    await page.route("**/api/session", route => route.fulfill({ json: { transport: { sdp: "answer" } } }));
    await page.goto("/");
    const canvas = page.locator(".avatar canvas");
    await expect(canvas).toHaveCSS("opacity", "1");
    const draws = () => page.evaluate(() => (window as unknown as { avatarDraws: number }).avatarDraws);
    const darkMouth = () => canvas.evaluate((c: HTMLCanvasElement) => {
      const x = Math.floor(c.width * 0.45), y = Math.floor(c.height * 0.505);
      const width = Math.floor(c.width * 0.07), height = Math.floor(c.height * 0.05);
      const pixels = c.getContext("2d")!.getImageData(x, y, width, height).data;
      let dark = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 100 && pixels[i] < 70 && pixels[i + 1] < 100 && pixels[i + 2] < 80) dark++;
      }
      return dark / (width * height);
    });
    await page.waitForTimeout(650);
    const idle = await draws();
    await page.waitForTimeout(1000);
    expect(await draws() - idle).toBe(0);
    expect(await canvas.evaluate((c: HTMLCanvasElement) => c.width / c.getBoundingClientRect().width)).toBeLessThanOrEqual(1.5);
    expect(await canvas.evaluate((c: HTMLCanvasElement) => Math.max(c.width, c.height))).toBeLessThanOrEqual(960);
    await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
    await page.evaluate(() => { window.voiceTest.speaking = true; });
    await expect(page.locator(".avatar-speaking")).toBeVisible();
    const active = await draws();
    await page.waitForTimeout(2000);
    const frames = await draws() - active;
    expect(frames).toBeGreaterThan(5);
    expect(frames).toBeLessThanOrEqual(65);
    await testInfo.attach("rendering-budget.json", {
      body: JSON.stringify({ idleFrames: 0, speakingFramesInTwoSeconds: frames, surface: await canvas.evaluate((c: HTMLCanvasElement) => ({ width: c.width, height: c.height, dpr: window.devicePixelRatio })) }),
      contentType: "application/json",
    });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await draws();
    await page.waitForTimeout(500);
    expect(await draws() - hidden).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(draws).toBeGreaterThan(hidden);
    await page.locator(".avatar").evaluate(e => { (e as HTMLElement).style.transform = "translateY(200vh)"; });
    await page.waitForTimeout(200);
    const outside = await draws();
    await page.waitForTimeout(500);
    expect(await draws() - outside).toBe(0);
    await page.locator(".avatar").evaluate(e => { (e as HTMLElement).style.transform = ""; });
    await expect.poll(draws).toBeGreaterThan(outside);
    await expect.poll(darkMouth).toBeGreaterThan(0.05);
    await page.getByRole("button", { name: "End conversation", exact: true }).click();
    await expect.poll(darkMouth, { timeout: 2000 }).toBeLessThan(0.01);
    await page.waitForTimeout(650);
    const ended = await draws();
    await page.waitForTimeout(500);
    expect(await draws() - ended).toBe(0);
  });
});
