import { expect, test } from "@playwright/test";
import { fakeVoice } from "../helpers/fake-voice";

async function tomorrow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const day = new Date();
    day.setDate(day.getDate() + 1);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
}
async function appointments(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page
    .getByRole("menuitem", { name: "Appointments", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Appointments", exact: true });
}
async function voice(page: import("@playwright/test").Page) {
  await fakeVoice(page, false);
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        session: { id: "live_test" },
        transport: { type: "webrtc", sdp: "answer" },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to Milo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End conversation", exact: true }),
  ).toBeVisible();
}

test("the small form creates bookings that survive refresh in Appointments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const panel = await appointments(page);
  await panel.getByRole("link", { name: "Book demo appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/new$/);
  await expect(
    page.getByRole("heading", { name: "Demo appointment", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Doctor", { exact: true }).selectOption("maya");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByLabel("Time", { exact: true }).selectOption("17:15");
  await page
    .getByRole("button", { name: "Book demo appointment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Demo appointment booked", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
  await expect(panel).toContainText("17:15");
  await page.reload();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
  await panel.getByRole("link", { name: "Book demo appointment" }).click();
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByLabel("Time", { exact: true }).selectOption("16:00");
  await page
    .getByRole("button", { name: "Book demo appointment", exact: true })
    .click();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Anna Kowalska");
  await expect(panel).toContainText("Dr. Maya Zielińska");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a storage failure reports the error instead of claiming a booking", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.goto("/appointments/new");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page
    .getByRole("button", { name: "Book demo appointment", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await expect(
    page.getByRole("heading", { name: "Demo appointment booked", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText(
    "No booked appointments yet.",
  );
});

test("Milo books only after asking and hearing OK, and avoids duplicate bookings", async ({
  page,
}) => {
  await voice(page);
  const date = await tomorrow(page);
  await page.evaluate(() =>
    window.voiceTest.message(
      "user",
      "My headaches keep returning. I would like a doctor.",
    ),
  );
  const proposal = await page.evaluate(
    (date) =>
      window.voiceTest.tool("prepare_demo_appointment", {
        clinicianId: "anna",
        date,
        time: "15:30",
      }),
    date,
  );
  expect(proposal.status).toBe("awaiting_confirmation");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("healthmate-demo-appointments"),
    ),
  ).toBeNull();
  await page.evaluate(
    (date) =>
      window.voiceTest.message(
        "assistant",
        `Would you like me to book a demo appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
      ),
    date,
  );
  await page.evaluate(() => window.voiceTest.message("user", "OK"));
  const booked = await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "OK",
      }),
    proposal.proposalId,
  );
  expect(booked.status).toBe("booked");
  await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "OK",
      }),
    proposal.proposalId,
  );
  const panel = await appointments(page);
  await expect(panel).toContainText("Dr. Anna Kowalska");
  await expect(panel).toContainText("15:30");
  await expect(panel.getByRole("listitem")).toHaveCount(1);
});

test("declining or unrelated consent cannot create an appointment", async ({
  page,
}) => {
  await voice(page);
  const date = await tomorrow(page);
  await page.evaluate(() => window.voiceTest.message("user", "OK"));
  const proposal = await page.evaluate(
    (date) =>
      window.voiceTest.tool("prepare_demo_appointment", {
        clinicianId: "anna",
        date,
        time: "15:30",
      }),
    date,
  );
  const stale = await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "OK",
      }),
    proposal.proposalId,
  );
  expect(stale.status).toBe("needs_confirmation");
  await page.evaluate(() =>
    window.voiceTest.message("assistant", "Shall I book the demo appointment?"),
  );
  await page.evaluate(() =>
    window.voiceTest.message("user", "No, do not book it."),
  );
  const declined = await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "OK",
      }),
    proposal.proposalId,
  );
  expect(declined.status).toBe("needs_confirmation");
  await expect(await appointments(page)).toContainText(
    "No booked appointments yet.",
  );
});
