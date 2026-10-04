import { z } from "zod";
import {
  appointmentDay,
  appointmentInputSchema,
  appointmentTimes,
  validateAppointment,
  type AppointmentInput,
} from "../demo-appointments";
import { clinicians } from "../demo";
import type { TranscriptState } from "./events";
import { bookAppointment, occupiedAppointments, importBrowserAppointments } from "../appointments-client";

export type AppointmentBackend = {
  occupied: typeof occupiedAppointments;
  book: typeof bookAppointment;
  initialise?: typeof importBrowserAppointments;
};
const serverBackend: AppointmentBackend = { occupied: occupiedAppointments, book: bookAppointment, initialise: importBrowserAppointments };

const confirmationSchema = z
  .object({
    proposalId: z.string().min(1).max(120),
    confirmation: z.string().min(1).max(200),
  })
  .strict();
const preparationSchema = appointmentInputSchema.extend({
  clinicianId: appointmentInputSchema.shape.clinicianId.nullish(),
  date: appointmentInputSchema.shape.date.nullish(),
  time: appointmentInputSchema.shape.time.nullish(),
});
async function chooseAppointment(args: unknown, backend: AppointmentBackend, userId?: string, signal?: AbortSignal): Promise<AppointmentInput> {
  const requested = preparationSchema.parse(args);
  const clinicianId = requested.clinicianId ?? "anna";
  const dates = requested.date
    ? [requested.date]
    : Array.from({ length: 30 }, (_, index) => appointmentDay(index + 1));
  const times = requested.time ? [requested.time] : appointmentTimes;
  if (userId) {
    try { await backend.initialise?.(userId); }
    catch { /* Preserved browser records can be retried in Appointments; new bookings must remain available. */ }
  }
  const existing = await backend.occupied(signal);
  for (const date of dates)
    for (const time of times) {
      if (
        existing.some((item) => item.clinicianId === clinicianId && item.date === date && item.time === time)
      ) continue;
      return validateAppointment({ ...requested, clinicianId, date, time });
    }
  throw new Error("No appointment slots are available for those preferences. Choose another date or doctor.");
}
function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const agreement = [
  "yes|yeah|yep|yup|ok|okay|sure|alright|absolutely|certainly|of course",
  "(?:(?:that|it|this) )?(?:sounds|looks) (?:good|great|fine|perfect)(?: to me)?",
  "(?:that|it|this) works(?: for me)?",
  "(?:that's|that is|it's|it is) (?:fine|good|great|perfect|okay|ok|correct|right)(?: with me)?",
  "(?:i )?confirm(?: (?:it|that|this|(?:the|my) (?:appointment|booking|slot)))?|confirmed",
  "(?:i )?agree(?: (?:to|with) (?:it|that|this|the (?:appointment|booking|slot)))?",
  "go ahead|please do|do it|proceed|let's do it|(?:i'd|i would) like that",
  "(?:(?:can|could|would) you )?(?:book|schedule|arrange|make|take) (?:it|that|this|(?:the|an|a) (?:demo )?appointment|the booking)(?: for me)?",
].join("|");
// Match the entire reply, including combined agreement and polite fillers.
// Conditions, changed slots and unrelated trailing details require clarification.
const affirmativeReply = new RegExp(
  `^(?:please )?(?:${agreement})(?: (?:and )?(?:please )?(?:${agreement}))*(?: (?:please|thanks|thank you))?$`,
);
function affirmative(text: string) {
  return affirmativeReply.test(normalise(text));
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
export function createAppointmentTools(userId?: string, backend = serverBackend, signal?: AbortSignal) {
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
      ? "Ask the exact returned appointment question as your final sentence, then wait for fresh clear agreement in the user's own words, such as yes, I confirm, sounds good, go ahead, or please book it for me. One clear agreement is enough; do not ask for an extra confirmation. Refusal, uncertainty or changes require clarification. Do not use consent to any other question."
      : "No active appointment proposal. Do not book. Respect any refusal; prepare a new slot only if the user wants one.",
  });
  function observe(transcript: TranscriptState) {
    const user = latestTurn(transcript, "user");
    if (
      pending &&
      user &&
      user.start > pending.frontier &&
      /^(?:(?:actually|sorry|well) )?(?:please )?(?:no\b|nope\b|nah\b|cancel\b|not now\b|don't\b|do not\b|i (?:don't|do not)\b|i(?:'d| would) rather not\b)/.test(normalise(user.text))
    )
      pending = null;
  }
  async function run(
    name: string,
    raw: string,
    transcript: TranscriptState,
  ): Promise<Record<string, unknown>> {
    try {
      const args: unknown = JSON.parse(raw);
      if (name === "prepare_demo_appointment") {
        const input = await chooseAppointment(args, backend, userId, signal);
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
          question: `Would you like me to book an appointment with ${doctor.name} on ${input.date} at ${input.time}?`,
        };
        return {
          status: "awaiting_confirmation",
          proposalId: pending.id,
          question: pending.question,
          appointment: { ...input, doctor: doctor.name },
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
        const booking = await backend.book(pending.input, signal, userId);
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
            "The appointment is booked in ontuc and appears under Appointments. The summary is stored with it. No external clinic has been notified.",
        };
      }
      return { status: "error", message: "That action is not supported." };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The appointment could not be saved.",
      };
    }
  }
  return { run, observe };
}
