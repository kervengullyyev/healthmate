import { expect, test } from "@playwright/test";
import { fakeVoice } from "../helpers/fake-voice";

test("shows only Milo and the Talk to Milo action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: /Milo/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Talk to Milo", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
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
  await expect(page.getByRole("button")).toHaveCount(1);
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
  await expect(page.getByRole("button")).toHaveCount(1);
});
