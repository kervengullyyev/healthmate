import { expect, test } from "@playwright/test";
import { fakeVoice } from "../helpers/fake-voice";

test("account menu opens its three sections and saves the session profile", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open account menu" }).click();
  const menu = page.getByRole("menu", { name: "Your account" });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Profile",
    "Appointments",
    "Records",
  ]);
  await menu.getByRole("menuitem", { name: "Profile", exact: true }).click();
  const profile = page.getByRole("dialog", { name: "Profile", exact: true });
  await expect(profile).toBeVisible();
  await profile.getByLabel("Your name", { exact: true }).fill("Alex");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile).not.toBeVisible();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await expect(profile.getByLabel("Your name", { exact: true })).toHaveValue(
    "Alex",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open account menu" }),
  ).toBeFocused();
});

test("appointments shows only bookings and records stays empty on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page
    .getByRole("menuitem", { name: "Appointments", exact: true })
    .click();
  const appointments = page.getByRole("dialog", {
    name: "Appointments",
    exact: true,
  });
  await expect(
    appointments.getByText("No booked appointments yet."),
  ).toBeVisible();
  await expect(
    appointments.getByRole("link", { name: "Book demo appointment" }),
  ).toBeVisible();
  await expect(
    appointments.locator(".clinician-card, .page-intro, .step-pill"),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Records", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Records", exact: true }),
  ).toContainText("No conversation records yet.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("records preserves the current transcript and closes live media before opening", async ({
  page,
}) => {
  await fakeVoice(page, false);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { transport: { sdp: "answer" } } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End conversation", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.voiceTest.message("user", "Sample patient: I slept badly."),
  );
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Records", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Records", exact: true }),
  ).toContainText("Sample patient: I slept badly.");
  expect(await page.evaluate(() => window.voiceTest.closes)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
});

test("account menu supports arrow keys, Escape and outside clicks", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open account menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Profile", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Appointments", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("menu")).not.toBeVisible();
  await trigger.click();
  await page.getByRole("main").click({ position: { x: 12, y: 12 } });
  await expect(page.getByRole("menu")).not.toBeVisible();
});
