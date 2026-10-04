import { afterEach, expect, it, vi } from "vitest";
import { createAppointmentTools } from "../src/lib/live/appointment-tools";
import {
  appointmentDay,
  bookDemoAppointment,
  readDemoAppointments,
} from "../src/lib/demo-appointments";
import { applyTranscript, emptyTranscript } from "../src/lib/live/events";

afterEach(() => vi.unstubAllGlobals());
function scenario() {
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  const tools = createAppointmentTools();
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
  const proposal = run("prepare_demo_appointment", {
    clinicianId: "anna",
    date,
    time: "15:30",
  });
  return { say, run, proposal, date };
}
it("cannot use consent to an unrelated question to book the prepared appointment", () => {
  const { say, run, proposal } = scenario();
  say("assistant", "Would you like a summary of your symptoms?");
  say("user", "OK");
  expect(
    run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "OK",
    }),
  ).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});

it("adds a summary to an existing slot without duplicating the booking or erasing it on an empty retry", () => {
  scenario();
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
it("cannot reuse appointment consent after the assistant changes the question", () => {
  const { say, run, proposal, date } = scenario();
  say(
    "assistant",
    `Would you like me to book a demo appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
  );
  say("assistant", "Would you like a summary instead?");
  say("user", "OK");
  expect(
    run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "OK",
    }),
  ).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});
it("accepts a natural affirmative reply to the specific appointment question", () => {
  const { say, run, proposal, date } = scenario();
  say(
    "assistant",
    `Would you like me to book a demo appointment with Dr. Anna Kowalska on ${date} at 15:30?`,
  );
  say("user", "Yes, that works.");
  expect(
    run("book_demo_appointment", {
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
])("books the confirmed slot after conversational agreement: %s", (reply) => {
  const { say, run, proposal } = scenario();
  say("assistant", proposal.question as string);
  say("user", reply);
  expect(run("book_demo_appointment", {
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
])("does not book after refusal, uncertainty or a change: %s", (reply) => {
  const { say, run, proposal } = scenario();
  say("assistant", proposal.question as string);
  say("user", reply);
  expect(run("book_demo_appointment", {
    proposalId: proposal.proposalId,
    confirmation: reply,
  })).toMatchObject({ status: "needs_confirmation" });
  expect(readDemoAppointments()).toEqual([]);
});
it.each(["Actually, no thanks.", "Nope.", "Please don't book it.", "I'd rather not."])(
  "clears the pending proposal after a natural refusal: %s",
  (reply) => {
    const { say, run, proposal } = scenario();
    say("assistant", proposal.question as string);
    say("user", reply);
    say("assistant", proposal.question as string);
    say("user", "Yes");
    expect(run("book_demo_appointment", {
      proposalId: proposal.proposalId,
      confirmation: "Yes",
    })).toMatchObject({ status: "needs_confirmation" });
    expect(readDemoAppointments()).toEqual([]);
  },
);
it("unavailable localStorage does not prevent reading the empty appointment list", () => {
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
it("chooses a default demo slot when asked to arrange an appointment without preferences", () => {
  const { say, run, date } = scenario();
  say("user", "My stomach hurts very bad. Please take an appointment for me.");
  say("assistant", "Please seek urgent medical care now. A demo appointment is not a substitute.");
  const proposal = run("prepare_demo_appointment", {
    clinicianId: null,
    date: null,
    time: null,
    description: "Patient reports very bad stomach pain and requested a demo appointment. Urgent evaluation was advised.",
  });
  expect(proposal).toMatchObject({
    status: "awaiting_confirmation",
    appointment: { clinicianId: "anna", date, time: "15:30" },
  });
  expect(readDemoAppointments()).toEqual([]);
  say("assistant", proposal.question as string);
  say("user", "Please book it for me.");
  expect(run("book_demo_appointment", {
    proposalId: proposal.proposalId,
    confirmation: "Please book it for me.",
  })).toMatchObject({ status: "booked" });
  expect(readDemoAppointments()[0]).toMatchObject({
    clinicianId: "anna", date, time: "15:30",
    description: "Patient reports very bad stomach pain and requested a demo appointment. Urgent evaluation was advised.",
  });
  expect(run("prepare_demo_appointment", {
    clinicianId: null, date: null, time: null, description: "Another checkup",
  })).toMatchObject({
    appointment: { clinicianId: "anna", date, time: "16:00" },
  });
});
it("keeps supplied preferences and rejects unavailable slots instead of silently replacing them", () => {
  const { run, date } = scenario();
  expect(run("prepare_demo_appointment", {
    clinicianId: "maya", date, time: "17:15", description: "Checkup",
  })).toMatchObject({ appointment: { clinicianId: "maya", date, time: "17:15" } });
  expect(run("prepare_demo_appointment", {
    clinicianId: "maya", date, time: "09:00", description: "Checkup",
  })).toMatchObject({ status: "error" });
  expect(readDemoAppointments()).toEqual([]);
});
