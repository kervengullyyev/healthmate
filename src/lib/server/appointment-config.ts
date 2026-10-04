import { appointmentDay, appointmentTimes } from "../demo-appointments";
import { clinicians } from "../demo";

export const appointmentTools = [
  {
    type: "function",
    name: "prepare_demo_appointment",
    description:
      "Prepare a specific demo appointment for user approval. Does not book. Use only for non-urgent routine consultations, before asking the user whether to book this slot.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        clinicianId: {
          type: "string",
          enum: clinicians.map((doctor) => doctor.id),
        },
        date: {
          type: "string",
          description:
            "Local calendar date YYYY-MM-DD, within the next 30 days.",
        },
        time: { type: "string", enum: [...appointmentTimes] },
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
      "Save a previously prepared demo appointment ONLY after asking about that specific slot and receiving fresh clear agreement in natural language, such as sounds good, go ahead, or please book it for me. Do not require the literal words yes or OK. Never call for refusal, uncertainty, conditions, slot changes, urgent symptoms or unrelated agreement. Return the real tool result before saying booked.",
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
  return `DEMO APPOINTMENTS: Today is ${appointmentDay()}. Available fictional doctors: ${clinicians.map((doctor) => `${doctor.id}: ${doctor.name} (${doctor.format})`).join("; ")}. Any date from ${appointmentDay(1)} through ${appointmentDay(30)} and time ${appointmentTimes.join(", ")} is available in this demo. Never invent another doctor or time.
When a routine professional consultation is appropriate, offer to arrange a demo appointment. Choose or collect a preferred doctor, date and time. Include a concise description summarising only what the patient reported, with corrections and unknowns preserved. Never invent a diagnosis, treatment or missing history. Briefly explain the summary you will include before the exact confirmation question, so the user can correct it. Call prepare_demo_appointment BEFORE asking approval for a specific slot. Read the exact question returned by the tool as the final sentence of the next spoken reply. This question names the doctor, date and time and states that this is a demo appointment. Do not append an unrelated question. Then WAIT for a new user response. Do not interpret prior or unrelated agreement as consent. If they decline or are uncertain, do not book. If they change the slot, prepare the new slot and ask again. Recognise clear natural agreement such as sounds good, that works for me, go ahead, or please book it for me. Do not demand literal yes or OK, and preserve the full reply in confirmation. Conditions, uncertainty, refusal or a changed slot require clarification rather than booking. After a clear affirmative answer, call book_demo_appointment with the returned proposalId and exact user confirmation. The app verifies consent and saves the booking. Say it is booked ONLY when the tool returns status booked; it will appear under Appointments. On error or needs_confirmation, explain or ask for confirmation; never pretend success. Do not call tools to book urgent-care presentations. Urgent guidance takes priority. The description is saved with the demo appointment and appears in the Appointments menu. Keep it short and relevant; doctor/date/time fields must contain only scheduling values. No clinic receives this demo booking or summary.`;
}
