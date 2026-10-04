import { expect, test } from "@playwright/test";
import { fakeVoice } from "../helpers/fake-voice";

test("keeps Milo centered with one voice action and a compact account icon", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: /Milo/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Talk to Milo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(2);
  await expect(page.locator("nav, header, footer")).toHaveCount(0);
  await expect(page.getByRole("heading")).toHaveCount(0);
});

test("Milo and the button fit on a mobile screen", async ({ page }) => {
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

test("plays and loops Milo's video during speech, then returns to the still avatar", async ({
  page,
}, testInfo) => {
  await fakeVoice(page, false, true);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { transport: { sdp: "answer" } } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End conversation", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.voiceTest.speaking = true;
  });
  const video = page.locator(".avatar video");
  await expect(video).toHaveCount(1);
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          !element.paused && element.currentTime > 0,
      ),
    )
    .toBe(true);
  await expect(video).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("milo-speaking.png") });
  expect(
    await video.evaluate((element: HTMLVideoElement) => ({
      src: new URL(element.currentSrc).pathname,
      muted: element.muted,
      loop: element.loop,
      inline: element.playsInline,
      controls: element.controls,
    })),
  ).toEqual({
    src: "/videos/milo.mp4",
    muted: true,
    loop: true,
    inline: true,
    controls: false,
  });
  await video.evaluate((element: HTMLVideoElement) => {
    element.currentTime = element.duration - 0.15;
  });
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          element.currentTime < 1 && !element.paused,
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.voiceTest.speaking = false;
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(true);
  await expect(video).toHaveCSS("opacity", "0");
  await expect(page.locator(".avatar img")).toHaveCSS("opacity", "1");
  await page
    .getByRole("button", { name: "End conversation", exact: true })
    .click();
  await expect(page.getByRole("button")).toHaveCount(2);
});
