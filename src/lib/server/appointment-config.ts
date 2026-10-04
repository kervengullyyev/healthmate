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
      },
      required: ["clinicianId", "date", "time"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "book_demo_appointment",
    description:
      "Save a previously prepared demo appointment ONLY after asking the user about that specific slot and receiving a fresh explicit affirmative reply. Never call for a refusal, uncertainty, urgent symptoms or an unrelated yes. Return the real tool result before saying booked.",
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
            "Exact text of the latest user reply consenting to this slot, such as OK or Yes please. Do not paraphrase or invent consent.",
        },
      },
      required: ["proposalId", "confirmation"],
      additionalProperties: false,
    },
  },
];
export function appointmentInstructions() {
  return `DEMO APPOINTMENTS: Today is ${appointmentDay()}. Available fictional doctors: ${clinicians.map((doctor) => `${doctor.id}: ${doctor.name} (${doctor.format})`).join("; ")}. Any date from ${appointmentDay(1)} through ${appointmentDay(30)} and time ${appointmentTimes.join(", ")} is available in this demo. Never invent another doctor or time.
When a routine professional consultation is appropriate, offer to arrange a demo appointment. Choose or collect a preferred doctor, date and time. Call prepare_demo_appointment BEFORE asking approval for a specific slot. Read the exact question returned by the tool as the final sentence of the next spoken reply. This question names the doctor, date and time and states that this is a demo appointment. Do not append an unrelated question. Then WAIT for a new user response. Do not interpret prior or unrelated agreement as consent. If they decline or are uncertain, do not book. If they change the slot, prepare the new slot and ask again. After a clear affirmative answer, call book_demo_appointment with the returned proposalId and exact user confirmation. The app verifies consent and saves the booking. Say it is booked ONLY when the tool returns status booked; it will appear under Appointments. On error or needs_confirmation, explain or ask for confirmation; never pretend success. Do not call tools to book urgent-care presentations. Urgent guidance takes priority. Demo tools only save doctor/date/time; never put symptoms or medical history into appointment fields.`;
}
