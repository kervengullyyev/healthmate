import { z } from "zod";
import {
  bookDemoAppointment,
  validateAppointment,
  type AppointmentInput,
} from "../demo-appointments";
import { clinicians } from "../demo";
import type { TranscriptState } from "./events";

const confirmationSchema = z
  .object({
    proposalId: z.string().min(1).max(120),
    confirmation: z.string().min(1).max(200),
  })
  .strict();
function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function affirmative(text: string) {
  return /^(?:(?:yes|yeah|yep|ok|okay|sure|alright)(?: please)?(?: (?:go ahead|that works|book (?:it|that|the appointment)))?|go ahead|please do|book it|please book it)$/.test(
    normalise(text),
  );
}
function latestTurn(
  transcript: TranscriptState,
  role: "user" | "assistant",
  before = Infinity,
) {
  const parts = transcript.fragments.filter(
    (part) => part.role === role && part.end <= before,
  );
  const latest = parts.at(-1);
  if (!latest) return null;
  let start = latest.start,
    text = latest.text;
  for (let index = parts.length - 2; index >= 0; index--) {
    const part = parts[index];
    if (start - part.end >= 1400) break;
    if (
      transcript.fragments.some(
        (other) =>
          other.role !== role && other.start >= part.end && other.end <= start,
      )
    )
      break;
    start = part.start;
    text = part.text + text;
  }
  return { start, end: latest.end, text };
}
export function createAppointmentTools() {
  let pending: {
    id: string;
    input: AppointmentInput;
    frontier: number;
    question: string;
  } | null = null;
  const needsConfirmation = () => ({
    status: "needs_confirmation",
    question: pending?.question,
    message: pending
      ? "Ask the exact returned question as your final sentence, then wait for a fresh clear yes or OK. Do not use consent to any other question."
      : "No active appointment proposal. Do not book. Respect any refusal; prepare a new slot only if the user wants one.",
  });
  function observe(transcript: TranscriptState) {
    const user = latestTurn(transcript, "user");
    if (
      pending &&
      user &&
      user.start > pending.frontier &&
      /^(no\b|cancel\b|not now\b|don't\b|do not\b)/.test(normalise(user.text))
    )
      pending = null;
  }
  function run(
    name: string,
    raw: string,
    transcript: TranscriptState,
  ): Record<string, unknown> {
    try {
      const args: unknown = JSON.parse(raw);
      if (name === "prepare_demo_appointment") {
        const input = validateAppointment(args);
        const doctor = clinicians.find(
          (clinician) => clinician.id === input.clinicianId,
        )!;
        pending = {
          id: crypto.randomUUID(),
          input,
          frontier: Math.max(
            0,
            ...transcript.fragments.map((part) => part.end),
          ),
          question: `Would you like me to book a demo appointment with ${doctor.name} on ${input.date} at ${input.time}?`,
        };
        return {
          status: "awaiting_confirmation",
          proposalId: pending.id,
          question: pending.question,
          appointment: { ...input, doctor: doctor.name, demo: true },
          message:
            "Read the exact returned question as the final sentence of your next reply, then wait for the user's answer. Do not ask another question or book until they reply.",
        };
      }
      if (name === "book_demo_appointment") {
        const argsResult = confirmationSchema.safeParse(args);
        const user = latestTurn(transcript, "user");
        if (
          !argsResult.success ||
          !pending ||
          argsResult.data.proposalId !== pending.id ||
          !user ||
          user.start <= pending.frontier
        )
          return needsConfirmation();
        const assistant = latestTurn(transcript, "assistant", user.start);
        const asked =
          assistant &&
          assistant.start > pending.frontier &&
          normalise(assistant.text).endsWith(normalise(pending.question)) &&
          !transcript.fragments.some(
            (part) =>
              part.role === "user" &&
              part.start > assistant.end &&
              part.start < user.start,
          );
        if (
          !asked ||
          normalise(argsResult.data.confirmation) !== normalise(user.text) ||
          !affirmative(user.text)
        )
          return needsConfirmation();
        const booking = bookDemoAppointment(pending.input);
        pending = null;
        return {
          status: "booked",
          appointment: {
            ...booking,
            doctor: clinicians.find(
              (clinician) => clinician.id === booking.clinicianId,
            )!.name,
          },
          message:
            "The demo appointment is saved in the Appointments menu. No real clinic was contacted.",
        };
      }
      return { status: "error", message: "That action is not supported." };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The demo appointment could not be saved.",
      };
    }
  }
  return { run, observe };
}
