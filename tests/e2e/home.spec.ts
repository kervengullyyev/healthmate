import { expect, test } from "@playwright/test";
test("welcomes users with usable voice, text and explicit demo entry points", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little clarity. A little care." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Talk to HealthMate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Type instead", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try a demo", exact: true }),
  ).toBeVisible();
});
test("home fits a narrow screen without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little clarity. A little care." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
