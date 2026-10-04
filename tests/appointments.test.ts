import { afterEach, expect, it, vi } from "vitest";
import { createAppointmentTools } from "../src/lib/live/appointment-tools";
import {
  appointmentDay,
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
