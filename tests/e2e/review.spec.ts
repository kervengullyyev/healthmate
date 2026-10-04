import { expect, test } from "../helpers/authenticated";
import { fakeVoice } from "../helpers/fake-voice";

test("the documented local origin reaches real API validation without calling AI", async ({
  request,
  baseURL,
}) => {
  for (const endpoint of ["chat", "plan", "session"]) {
    const response = await request.post(`/api/${endpoint}`, {
      headers: { Origin: new URL(baseURL!).origin },
      data: endpoint === "session" ? { sdp: "invalid" } : { messages: [] },
    });
    expect(response.status()).toBe(400);
  }
  const crossOrigin = await request.post("/api/session", {
    headers: { Origin: "https://other.example" },
    data: { sdp: "v=0\r\n" },
  });
  expect(crossOrigin.status()).toBe(403);
});

test("leaving the conversation cancels pending microphone acquisition", async ({
  page,
}) => {
  await fakeVoice(page, true);
  let sessions = 0;
  await page.route("**/api/session", (route) => {
    sessions++;
    return route.fulfill({ json: { transport: { sdp: "answer" } } });
  });
  await page.goto("/journey");
  await page
    .getByRole("button", { name: "Talk to ontuc", exact: true })
    .click();
  await expect(page.getByText("Connecting", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.evaluate(() => window.voiceTest.resolve());
  await expect
    .poll(() => page.evaluate(() => window.voiceTest.stopped))
    .toBe(1);
  expect(sessions).toBe(0);
  expect(await page.evaluate(() => window.voiceTest.closed)).toBe(true);
});

test("leaving an active voice conversation sends close and releases media", async ({
  page,
}) => {
  await fakeVoice(page, false);
  await page.route("**/api/session", (route) =>
    route.fulfill({ json: { transport: { sdp: "answer" } } }),
  );
  await page.goto("/journey");
  await page
    .getByRole("button", { name: "Talk to ontuc", exact: true })
    .click();
  await expect(page.getByText("Live voice", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.voiceTest.closes)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.stopped)).toBe(1);
  expect(await page.evaluate(() => window.voiceTest.closed)).toBe(true);
});

test("urgent regeneration preserves edits while replacing exported care guidance", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: { reply: "Tell me more." } }),
  );
  let plans = 0;
  await page.route("**/api/plan", (route) => {
    plans++;
    return route.fulfill({
      json: {
        plan: {
          concern:
            plans === 1 ? "Recurring headaches" : "Sudden severe headache",
          urgency: plans === 1 ? "consultation" : "urgent",
          reason:
            plans === 1
              ? "Arrange a routine consultation."
              : "Urgent professional evaluation is needed.",
          nextSteps: [
            plans === 1
              ? "Discuss with a GP."
              : "Contact local emergency services for immediate danger.",
          ],
          missingInformation: ["Clinical examination"],
          doctorBrief:
            plans === 1
              ? "Discuss recurring headaches at a routine visit."
              : "Sudden severe headache: urgent evaluation.",
        },
      },
    });
  });
  await page.goto("/journey");
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await page.getByLabel("Your message").fill("Recurring headaches.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Tell me more.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create my care plan" }).click();
  await page.getByRole("button", { name: "Explore demo appointments" }).click();
  await page.getByRole("button", { name: "Select Dr. Anna Kowalska" }).click();
  await page.getByRole("button", { name: "Confirm demo appointment" }).click();
  await page.getByRole("button", { name: "Prepare my doctor brief" }).click();
  await page
    .getByRole("textbox", { name: "Doctor brief", exact: true })
    .fill("Patient correction: started today. Old advice: routine visit.");
  await page.getByRole("button", { name: "Care plan", exact: true }).click();
  await page
    .getByLabel("Your concern · editable")
    .fill("Sudden severe headache today.");
  await page.getByRole("button", { name: "Update care plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Please seek urgent medical help." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Doctor brief", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Doctor brief", exact: true }),
  ).toHaveValue(
    "Patient correction: started today. Old advice: routine visit.",
  );
  await expect(
    page.getByRole("heading", { name: "Please seek urgent medical help." }),
  ).toBeVisible();
  await expect(
    page.getByText("Dr. Anna Kowalska", { exact: true }),
  ).not.toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".care-summary")).not.toBeVisible();
  await expect(page.locator(".print-brief")).toContainText(
    "LATEST SUGGESTED CARE: URGENT EVALUATION",
  );
  await expect(page.locator(".print-brief")).toContainText(
    "Earlier routine-care advice in the editable draft is superseded",
  );
  await expect(page.locator(".print-brief")).not.toContainText(
    "Dr. Anna Kowalska",
  );
  await page.emulateMedia({ media: "screen" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download text" }).click();
  const download = await downloadPromise;
  const { readFile } = await import("node:fs/promises");
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("LATEST SUGGESTED CARE: URGENT EVALUATION");
  expect(text).toContain("Patient correction: started today.");
  expect(text).not.toContain("Dr. Anna Kowalska");
});

test("the interview budget preserves history and reserves room for plan corrections", async ({
  page,
}) => {
  let chats = 0;
  await page.route("**/api/chat", (route) => {
    chats++;
    return route.fulfill({ json: { reply: `Follow-up ${chats}.` } });
  });
  const payloads: { role: string; content: string }[][] = [];
  await page.route("**/api/plan", async (route) => {
    const body = route.request().postDataJSON();
    payloads.push(body.messages);
    return route.fulfill({
      json: {
        plan: {
          concern: "Several reported symptoms",
          urgency: "consultation",
          reason: "Discuss symptoms with a clinician.",
          nextSteps: ["Arrange professional assessment."],
          missingInformation: ["Examination"],
          doctorBrief: "Patient reports several symptoms.",
        },
      },
    });
  });
  await page.goto("/journey");
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  for (let i = 0; i < 14; i++) {
    await page.getByLabel("Your message").fill(`Patient detail ${i + 1}.`);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText(`Follow-up ${i + 1}.`, { exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByLabel("Your message")).toBeDisabled();
  await expect(
    page.getByText("Interview limit reached", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create my care plan" }).click();
  expect(payloads[0].some((m) => m.content === "Patient detail 1.")).toBe(true);
  expect(payloads[0].some((m) => m.content === "Patient detail 14.")).toBe(
    true,
  );
  await page.getByRole("button", { name: "Review my doctor brief" }).click();
  await page
    .getByRole("textbox", { name: "Doctor brief", exact: true })
    .fill("Patient correction. ".repeat(500));
  await page.getByRole("button", { name: "Care plan", exact: true }).click();
  await page.getByRole("button", { name: "Update care plan" }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1].length).toBeLessThanOrEqual(40);
  expect(
    payloads[1].some((m) => m.content.includes("Patient correction.")),
  ).toBe(true);
});

test("mobile navigation shows the new screen heading at the top", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/journey");
  await page.getByRole("button", { name: "Try a demo", exact: true }).click();
  for (let i = 0; i < 5; i++)
    await page
      .getByRole("button", { name: "Use sample answer", exact: true })
      .click();
  await page.getByRole("button", { name: "Create my care plan" }).click();
  await page.getByRole("button", { name: "Review my doctor brief" }).click();
  await expect(
    page.getByRole("heading", { name: "Your story, ready to share." }),
  ).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
