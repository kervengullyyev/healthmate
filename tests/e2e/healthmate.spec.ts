import { expect, test, type Page } from "../helpers/authenticated";
async function samplePlan(page: Page) {
  await page.goto("/journey");
  await page.getByRole("button", { name: "Try a demo", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Use sample answer", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Create my care plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next step, made clearer." }),
  ).toBeVisible();
}
test("completes the synthetic journey and preserves an editable printable doctor brief", async ({
  page,
}) => {
  await samplePlan(page);
  await page.getByRole("button", { name: "Explore demo appointments" }).click();
  await page.getByRole("button", { name: "Select Dr. Anna Kowalska" }).click();
  await page.getByRole("button", { name: "Confirm demo appointment" }).click();
  await expect(page.getByText("Your demo appointment is saved.")).toBeVisible();
  await page.getByRole("button", { name: "Prepare my doctor brief" }).click();
  const brief = page.getByRole("textbox", { name: "Doctor brief", exact: true });
  await brief.fill("Patient correction: headaches started three weeks ago.");
  await page.getByRole("button", { name: "Care plan", exact: true }).click();
  await page.getByRole("button", { name: "Doctor brief", exact: true }).click();
  await expect(brief).toHaveValue(
    "Patient correction: headaches started three weeks ago.",
  );
  await expect(
    page.getByRole("button", { name: "Print / save PDF" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-brief")).toContainText("three weeks ago");
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await expect(page.getByText("Recurring evening headaches")).not.toBeVisible();
  await expect(
    page.getByText("Demo experience", { exact: true }),
  ).not.toBeVisible();
});
test("demo booking persists only as explicitly synthetic data", async ({
  page,
}) => {
  await samplePlan(page);
  await page.getByRole("button", { name: "Explore demo appointments" }).click();
  await page.getByRole("button", { name: "Select Dr. Anna Kowalska" }).click();
  await page.getByRole("button", { name: "Confirm demo appointment" }).click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(["healthmate-demo-booking:google-test-alex"]);
  await page.reload();
  await page.getByRole("button", { name: "Try a demo", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Use sample answer", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Create my care plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Explore demo appointments" }).click();
  await expect(page.getByText("Your demo appointment is saved.")).toBeVisible();
});
test("failed live regeneration preserves patient corrections and shows the failure", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { liveConfigured: true } }),
  );
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: { reply: "When did it start?" } }),
  );
  let calls = 0;
  await page.route("**/api/plan", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          json: {
            plan: {
              concern: "Patient reported headaches",
              urgency: "consultation",
              reason: "Discuss recurring symptoms with a clinician.",
              nextSteps: ["Arrange a consultation."],
              missingInformation: ["Medical history"],
              doctorBrief: "Reported headaches. Medical history unknown.",
            },
          },
        })
      : route.fulfill({
          status: 502,
          json: { error: "The plan could not be generated." },
        });
  });
  await page.goto("/journey");
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await page.getByLabel("Your message").fill("My headaches keep recurring.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("When did it start?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create my care plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Review my doctor brief" }).click();
  await page.getByRole("textbox", { name: "Doctor brief", exact: true }).fill("Patient correction retained.");
  await page.getByRole("button", { name: "Care plan", exact: true }).click();
  await page.getByRole("button", { name: "Update care plan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not be generated" })).toContainText("could not be generated");
  await page.getByRole("button", { name: "Doctor brief", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Doctor brief", exact: true })).toHaveValue(
    "Patient correction retained.",
  );
});
test("an urgent result interrupts routine booking on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: { reply: "Seek urgent professional evaluation." } }),
  );
  await page.route("**/api/plan", (route) =>
    route.fulfill({
      json: {
        plan: {
          concern: "Reported sudden severe headache",
          urgency: "urgent",
          reason: "This needs urgent professional evaluation.",
          nextSteps: ["Contact local emergency services for immediate danger."],
          missingInformation: ["Clinical examination"],
          doctorBrief:
            "Patient reports sudden severe headache. Urgent evaluation suggested.",
        },
      },
    }),
  );
  await page.goto("/journey");
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await page
    .getByLabel("Your message")
    .fill("A sudden severe headache started.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Seek urgent professional evaluation.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create my care plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Please seek urgent medical help." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore demo appointments" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Appointments", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("keyboard users can reach the primary action", async ({ page }) => {
  await page.goto("/journey");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Try a demo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Let’s talk it through." }),
  ).toBeVisible();
});
