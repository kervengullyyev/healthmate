import { afterEach, expect, it, vi } from "vitest";
import { createAppointmentTools } from "../src/lib/live/appointment-tools";
import {
  appointmentDay,
  bookDemoAppointment,
  readDemoAppointments,
} from "../src/lib/demo-appointments";
import { applyTranscript, emptyTranscript } from "../src/lib/live/events";

afterEach(() => vi.unstubAllGlobals());
it("can prepare a new appointment even if an earlier browser record cannot be imported", async () => {
  const tools = createAppointmentTools("google-owner", {
    initialise: async () => { throw new Error("A legacy slot is no longer available."); },
    occupied: async () => [],
    book: async () => { throw new Error("No consent yet."); },
  });
  expect(await tools.run("prepare_demo_appointment", JSON.stringify({ clinicianId: null, date: null, time: null, description: "Checkup" }), emptyTranscript())).toMatchObject({ status: "awaiting_confirmation" });
});
async function scenario() {
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  const tools = createAppointmentTools(undefined, { occupied: async () => readDemoAppointments().map(({ clinicianId, date, time }) => ({ clinicianId, date, time })), book: async (input) => ({ ...bookDemoAppointment(input), status: "booked", createdAt: new Date().toISOString() }) });
  let transcript = emptyTranscript();
  let offset = 0;
  const say = (role: "user" | "assistant", text: string) => {
    offset += 3000;
    transcript = applyTranscript(transcript, {
      type: `session.${role === "user" ? "input" : "output"}_transcript.delta`,
      event_id: crypto.randomUUID(),
      delta: text,
      start_ms: offset,
      end_ms: offset + 500,
    });
    tools.observe(transcript);
  };
  const run = (name: string, args: unknown) =>
    tools.run(name, JSON.stringify(args), transcript);
  const date = appointmentDay(1);
  const proposal = await run("prepare_demo_appointment", {
    clinicianId: "anna",
    date,
    time: "15:30",
  });
  return { say, run, proposal, date };
}
it("cannot use consent to an unrelated question to book the prepared appointment", async () => {
  const { say, run, proposal } = await scenario();
  say("assistant", "Would you like a summary of your symptoms?");
  say("user", "OK");
  expect(
    await run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "OK",
    }),
  ).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});

it("adds a summary to an existing slot without duplicating the booking or erasing it on an empty retry", async () => {
  await scenario();
  const slot = { clinicianId: "anna", date: appointmentDay(1), time: "15:30" };
  const first = bookDemoAppointment(slot);
  const updated = bookDemoAppointment({
    ...slot,
    description: "  Patient reports headaches. Cause unknown.  ",
  });
  expect(updated.id).toBe(first.id);
  expect(updated.description).toBe("Patient reports headaches. Cause unknown.");
  bookDemoAppointment(slot);
  expect(readDemoAppointments()).toHaveLength(1);
  expect(readDemoAppointments()[0].description).toBe(
    "Patient reports headaches. Cause unknown.",
  );
});
it("cannot reuse appointment consent after the assistant changes the question", async () => {
  const { say, run, proposal, date } = await scenario();
  say(
    "assistant",
    `Would you like me to book an appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
  );
  say("assistant", "Would you like a summary instead?");
  say("user", "OK");
  expect(
    await run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "OK",
    }),
  ).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});
it("accepts a natural affirmative reply to the specific appointment question", async () => {
  const { say, run, proposal, date } = await scenario();
  say(
    "assistant",
    `Would you like me to book an appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
  );
  say("user", "Yes, that works.");
  expect(
    await run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "Yes, that works.",
    }),
  ).toMatchObject({ status: "booked" });
  expect(readDemoAppointments()).toHaveLength(1);
});
it.each([
  "Sounds good!",
  "That sounds great to me.",
  "That works for me, thanks.",
  "Yes, please book it for me.",
  "Sure, go ahead and book the appointment.",
  "Please arrange it for me.",
  "Can you book it for me?",
  "I'd like that.",
  "Let’s do it.",
  "Absolutely, thank you.",
  "Okay, please do.",
  "Yes please, that’s fine.",
  "Yes, I confirm.",
  "I confirm.",
  "Yes, I confirm the appointment.",
  "I confirm that, thanks.",
  "Confirmed.",
  "Yes, I agree.",
  "I agree to that.",
  "Yes, that's correct.",
  "Sure, do it.",
  "Yes, please proceed.",
])("books the confirmed slot after conversational agreement: %s", async (reply) => {
  const { say, run, proposal } = await scenario();
  say("assistant", proposal.question as string);
  say("user", reply);
  expect(await run("book_demo_appointment", {
    proposalId: proposal.proposalId,
    confirmation: reply,
  })).toMatchObject({ status: "booked" });
  expect(readDemoAppointments()).toHaveLength(1);
});
it.each([
  "No thanks.",
  "Actually, don't book it.",
  "Maybe, I'm not sure.",
  "Yes, but not tomorrow.",
  "Sounds good, but can we do another time?",
  "Book it if it is free.",
  "I guess yes.",
  "Yes, I have headaches.",
  "Not now, thanks.",
  "Can you tell me more first?",
  "Yes, I confirm if it is free.",
  "I confirm, but not tomorrow.",
  "I don't confirm.",
  "I agree, maybe.",
])("does not book after refusal, uncertainty or a change: %s", async (reply) => {
  const { say, run, proposal } = await scenario();
  say("assistant", proposal.question as string);
  say("user", reply);
  expect(await run("book_demo_appointment", {
    proposalId: proposal.proposalId,
    confirmation: reply,
  })).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});
it.each(["Actually, no thanks.", "Nope.", "Please don't book it.", "I'd rather not."])(
  "clears the pending proposal after a natural refusal: %s",
  async (reply) => {
    const { say, run, proposal } = await scenario();
    say("assistant", proposal.question as string);
    say("user", reply);
    say("assistant", proposal.question as string);
    say("user", "Yes");
    expect(await run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "Yes",
    })).toMatchObject({ status: "needs_confirmation" });
    expect(readDemoAppointments()).toEqual([]);
  },
);
it("unavailable localStorage does not prevent reading the empty appointment list", async () => {
  vi.stubGlobal("localStorage", undefined);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => {
      throw new DOMException("Blocked", "SecurityError");
    },
  });
  expect(() => readDemoAppointments()).not.toThrow();
  expect(readDemoAppointments()).toEqual([]);
});
it("chooses a default demo slot when asked to arrange an appointment without preferences", async () => {
  const { say, run, date } = await scenario();
  say("user", "My stomach hurts very bad. Please take an appointment for me.");
  say("assistant", "Please seek urgent medical care now. A appointment is not a substitute.");
  const proposal = await run("prepare_demo_appointment", {
    clinicianId: null,
    date: null,
    time: null,
    description: "Patient reports very bad stomach pain and requested an appointment. Urgent evaluation was advised.",
  });
  expect(proposal).toMatchObject({
    status: "awaiting_confirmation",
    appointment: { clinicianId: "anna", date, time: "15:30" },
  });
  expect(readDemoAppointments()).toEqual([]);
  say("assistant", proposal.question as string);
  say("user", "Please book it for me.");
  expect(await run("book_demo_appointment", {
    proposalId: proposal.proposalId,
    confirmation: "Please book it for me.",
  })).toMatchObject({ status: "booked" });
  expect(readDemoAppointments()[0]).toMatchObject({
    clinicianId: "anna", date, time: "15:30",
    description: "Patient reports very bad stomach pain and requested an appointment. Urgent evaluation was advised.",
  });
  expect(await run("prepare_demo_appointment", {
    clinicianId: null, date: null, time: null, description: "Another checkup",
  })).toMatchObject({
    appointment: { clinicianId: "anna", date, time: "16:00" },
  });
});
it("keeps supplied preferences and rejects unavailable slots instead of silently replacing them", async () => {
  const { run, date } = await scenario();
  expect(await run("prepare_demo_appointment", {
    clinicianId: "maya", date, time: "17:15", description: "Checkup",
  })).toMatchObject({ appointment: { clinicianId: "maya", date, time: "17:15" } });
  expect(await run("prepare_demo_appointment", {
    clinicianId: "maya", date, time: "09:00", description: "Checkup",
  })).toMatchObject({ status: "error" });
  expect(readDemoAppointments()).toEqual([]);
});
it("keeps different Google accounts and anonymous bookings separate in the same browser", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const slot = { clinicianId: "anna", date: appointmentDay(1), time: "15:30" };
  bookDemoAppointment({ ...slot, description: "Anonymous old booking" }, storage);
  expect(readDemoAppointments(storage, "google-alice")).toEqual([]);
  bookDemoAppointment({ ...slot, description: "Alice's summary" }, storage, "google-alice");
  expect(readDemoAppointments(storage, "google-alice")[0].description).toBe("Alice's summary");
  expect(readDemoAppointments(storage, "google-bob")).toEqual([]);
  expect(readDemoAppointments(storage)[0].description).toBe("Anonymous old booking");
});
