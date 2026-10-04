import { expect, test } from "../helpers/authenticated";
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
  context,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const panel = await appointments(page);
  await panel.getByRole("link", { name: "Book appointment" }).click();
  await expect(page).toHaveURL(/\/appointments\/new$/);
  await expect(
    page.getByRole("heading", { name: "Appointment", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Doctor", { exact: true }).selectOption("maya");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByLabel("Time", { exact: true }).selectOption("17:15");
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "Recurring evening headaches for two weeks. I would like a GP consultation.",
    );
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Appointment booked", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
  await expect(panel).toContainText("17:15");
  await expect(panel).toContainText(
    "Recurring evening headaches for two weeks. I would like a GP consultation.",
  );
  await page.reload();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
  await expect(panel).toContainText(
    "Recurring evening headaches for two weeks. I would like a GP consultation.",
  );
  await panel.getByRole("link", { name: "Book appointment" }).click();
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByLabel("Time", { exact: true }).selectOption("16:00");
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Anna Kowalska");
  await expect(panel).toContainText("Dr. Maya Zielińska");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  const otherContext = await browser.newContext({ storageState: { cookies: await context.cookies(), origins: [] } });
  try {
    const otherDevice = await otherContext.newPage();
    await otherDevice.goto("/");
    const otherPanel = await appointments(otherDevice);
    await expect(otherPanel.getByRole("listitem")).toHaveCount(2);
    await expect(otherPanel).toContainText("Recurring evening headaches for two weeks.");
    expect(await otherDevice.evaluate(() => localStorage.getItem("healthmate-demo-appointments"))).toBeNull();
    await page.screenshot({ path: "docs/screenshots/sqlite-booked-appointments-mobile.png", fullPage: true });
  } finally { await otherContext.close(); }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("books successfully when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
  });
  await page.goto("/appointments/new");
  await page.getByLabel("Doctor", { exact: true }).selectOption("maya");
  await page.getByLabel("Time", { exact: true }).selectOption("16:00");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Appointment booked", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
});

test("imports an existing account's browser booking into SQLite without deleting it", async ({ page, request }) => {
  const user = (await (await request.get("/api/auth/session")).json()).user;
  const date = await tomorrow(page);
  await page.addInitScript(({ id, date }) => {
    localStorage.setItem(`healthmate-demo-appointments:${encodeURIComponent(id)}`, JSON.stringify([{ id: "legacy-booking", clinicianId: "piotr", date, time: "17:15", description: "Earlier browser summary", demo: true }]));
  }, { id: user.id, date });
  await page.goto("/");
  await expect(await appointments(page)).toContainText("Earlier browser summary");
  const records = await (await request.get("/api/appointments")).json();
  expect(records.appointments).toHaveLength(1);
  expect(records.appointments[0]).toMatchObject({ description: "Earlier browser summary", status: "booked" });
  expect(await page.evaluate((id) => localStorage.getItem(`healthmate-demo-appointments:${encodeURIComponent(id)}`), user.id)).toContain("Earlier browser summary");
});

test("a legacy import conflict does not block viewing or booking server appointments", async ({ page, request }) => {
  const user = (await (await request.get("/api/auth/session")).json()).user;
  await page.addInitScript(id => {
    const day = new Date(); day.setDate(day.getDate() + 3);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    localStorage.setItem(`healthmate-demo-appointments:${encodeURIComponent(id)}`, JSON.stringify([{ id: "conflicting-old-entry", clinicianId: "piotr", date, time: "15:30", description: "Preserved earlier entry", demo: true }]));
  }, user.id);
  await page.route("**/api/appointments/import", route => route.fulfill({ status: 409, json: { error: "That appointment slot is no longer available." } }));
  await page.goto("/");
  const panel = await appointments(page);
  await expect(panel.getByRole("alert")).toContainText("originals are preserved");
  await panel.getByRole("link", { name: "Book appointment" }).click();
  await page.getByLabel("Doctor", { exact: true }).selectOption("maya");
  await page.getByLabel("Time", { exact: true }).selectOption("15:30");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page.getByRole("button", { name: "Book appointment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Appointment booked", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText("Dr. Maya Zielińska");
  expect(await page.evaluate(id => localStorage.getItem(`healthmate-demo-appointments:${encodeURIComponent(id)}`), user.id)).toContain("Preserved earlier entry");
});

test("a server storage failure reports the error instead of claiming a booking", async ({
  page,
}) => {
  await page.route("**/api/appointments", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { error: "The appointment could not be saved. Please try again." } }) : route.continue());
  await page.goto("/appointments/new");
  await page.getByLabel("Date", { exact: true }).fill(await tomorrow(page));
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await expect(
    page.getByRole("heading", { name: "Appointment booked", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Milo" }).click();
  await expect(await appointments(page)).toContainText(
    "No appointments yet.",
  );
});

test("Milo books the chosen slot after one confirmation and avoids duplicates", async ({
  page,
}) => {
  await voice(page);
  const date = await tomorrow(page);
  await page.evaluate(() =>
    window.voiceTest.message(
      "user",
      "My stomach hurts very bad. Please take an appointment for me.",
    ),
  );
  await page.evaluate(() => window.voiceTest.message("assistant", "Please seek urgent medical care now. A appointment request does not replace urgent care."));
  const proposal = await page.evaluate(
    () =>
      window.voiceTest.tool("prepare_demo_appointment", {
        clinicianId: null,
        date: null,
        time: null,
        description:
          "Patient reports very bad stomach pain and requested an appointment. Urgent evaluation was advised.",
      }),
  );
  expect(proposal.status).toBe("awaiting_confirmation");
  expect(proposal.appointment).toMatchObject({ clinicianId: "anna", date, time: "15:30" });
  expect(
    await page.evaluate(() =>
      localStorage.getItem("healthmate-demo-appointments:google-test-alex"),
    ),
  ).toBeNull();
  await page.evaluate(
    (date) =>
      window.voiceTest.message(
        "assistant",
        `Would you like me to book an appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
      ),
    date,
  );
  await page.evaluate(() => window.voiceTest.message("user", "Yes, I confirm."));
  const booked = await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "Yes, I confirm.",
      }),
    proposal.proposalId,
  );
  expect(booked.status).toBe("booked");
  await page.evaluate(
    (proposalId) =>
      window.voiceTest.tool("book_demo_appointment", {
        proposalId,
        confirmation: "Yes, I confirm.",
      }),
    proposal.proposalId,
  );
  const panel = await appointments(page);
  await expect(panel).toContainText("Dr. Anna Kowalska");
  await expect(panel).toContainText("15:30");
  await expect(panel).toContainText(
    "Patient reports very bad stomach pain and requested an appointment. Urgent evaluation was advised.",
  );
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
    window.voiceTest.message("assistant", "Shall I book the appointment?"),
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
    "No appointments yet.",
  );
});
