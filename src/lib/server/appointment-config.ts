import { appointmentDay, appointmentTimes } from "../demo-appointments";
import { clinicians } from "../demo";

export const appointmentTools = [
  {
    type: "function",
    name: "prepare_demo_appointment",
    description:
      "Prepare an appointment when the user requests one or accepts an offer. Does not book. Send null for any unspecified doctor, date or time; the app chooses the next available appointment slot. Urgent-care advice must come first, but an explicit request for an appointment request may still be handled separately. An appointment request is never a substitute for urgent care.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        clinicianId: {
          type: ["string", "null"],
          enum: [...clinicians.map((doctor) => doctor.id), null],
          description: "Preferred doctor, or null to let the app choose.",
        },
        date: {
          type: ["string", "null"],
          description:
            "Preferred local calendar date YYYY-MM-DD within the next 30 days, or null to choose the next available date.",
        },
        time: { type: ["string", "null"], enum: [...appointmentTimes, null], description: "Preferred time, or null to choose an available time." },
        description: {
          type: "string",
          maxLength: 1500,
          description:
            "A concise conversation summary based only on the user's reported symptoms, timeline, severity and relevant context. Preserve corrections and uncertainty; do not invent a diagnosis or missing history. Use an empty string if there is no relevant information.",
        },
      },
      required: ["clinicianId", "date", "time", "description"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "book_demo_appointment",
    description:
      "Save a previously prepared appointment ONLY after asking about that specific slot and receiving fresh clear agreement in natural language, such as yes, I confirm, I agree, sounds good, go ahead, or please book it for me. One clear affirmative reply is sufficient: call this booking tool immediately without asking the user to confirm again or preparing the same slot again. Do not require any special confirmation phrase. Never call for refusal, uncertainty, conditions, slot changes or unrelated agreement. A user-requested appointment request can be saved after urgent-care guidance; it never replaces urgent care. Return the tool result before saying the appointment is booked in ontuc.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        proposalId: {
          type: "string",
          description:
            "The exact proposalId returned by prepare_demo_appointment.",
        },
        confirmation: {
          type: "string",
          description:
            "Exact text of the latest user reply consenting to this slot, such as sounds good or sure go ahead and book it. Preserve the user's wording; do not replace it with yes or invent consent.",
        },
      },
      required: ["proposalId", "confirmation"],
      additionalProperties: false,
    },
  },
];
export function appointmentInstructions() {
  return `APPOINTMENT REQUESTS: Today is ${appointmentDay()}. Available doctors in the ontuc directory: ${clinicians.map((doctor) => `${doctor.id}: ${doctor.name} (${doctor.format})`).join("; ")}. Any date from ${appointmentDay(1)} through ${appointmentDay(30)} and time ${appointmentTimes.join(", ")} can be requested in ontuc. Never invent another doctor or time.
When a routine professional consultation is appropriate, offer to arrange an appointment. When the user asks for an appointment, proceed to preparation without requiring a full symptom interview. Use any preferences they already gave. Send null for missing doctor, date or time so the app selects Dr. Anna by default and the earliest available appointment slot; do not insist they choose every field. Explain the returned doctor, date and time before asking approval. Include a concise description summarising only what the patient reported, with corrections and unknowns preserved. Never invent a diagnosis, treatment or missing history. Briefly explain the summary you will include before the booking question, so the user can correct it. Call prepare_demo_appointment BEFORE asking approval for a specific slot. Ask the returned booking question as the final sentence of the next spoken reply, keeping the prepared doctor, date and time. Use natural spoken dates and times, such as October 5th at 5:15 PM; do not require ISO date/time wording. This question names the doctor, date and time and asks permission to book it in ontuc. Do not append an unrelated question. Then WAIT for a new user response. Do not interpret prior or unrelated agreement as consent. If they decline or are uncertain, do not book. If they change the slot, prepare the new slot and ask again. Recognise clear natural agreement such as yes, I confirm, I agree, sounds good, that works for me, go ahead, or please book it for me. Do not demand literal yes or OK, and preserve the full reply in confirmation. Conditions, uncertainty, refusal or a changed slot require clarification rather than booking. After ONE clear affirmative answer, do not ask for another confirmation and do not prepare the same slot again. Immediately call book_demo_appointment with the returned proposalId and exact user confirmation. The app verifies consent and saves the booking. Say the appointment is booked in ontuc ONLY when the tool returns status booked; it will appear under Appointments. On error or needs_confirmation, explain or ask for confirmation; never pretend success. Urgent guidance takes priority and must be delivered immediately. Do not proactively offer a routine appointment instead of urgent care. If the user explicitly asks to arrange an appointment, you may prepare and save it with the same confirmation process after giving urgent guidance. Do not refuse that administrative appointment request solely because symptoms are urgent. Clearly say the appointment request does not replace or delay urgent care, and include that advice in the description. The description is saved with the appointment and appears in the Appointments menu. Keep it short and relevant; doctor/date/time fields must contain only scheduling values. The database stores the appointment and summary. No external clinic is notified. Call this an appointment, without the word demo; do not claim external clinic confirmation.`;
}
