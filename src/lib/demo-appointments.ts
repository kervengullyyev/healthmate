import { z } from "zod";

export const appointmentTimes = ["15:30", "16:00", "17:15"] as const;
export const appointmentInputSchema = z
  .object({
    clinicianId: z.enum(["anna", "piotr", "maya"]),
    date: z.iso.date(),
    time: z.enum(appointmentTimes),
    description: z.string().trim().max(1500).default(""),
  })
  .strict();
const appointmentSchema = appointmentInputSchema.extend({
  id: z.string().min(1).max(120),
  demo: z.literal(true),
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
export type DemoAppointment = z.infer<typeof appointmentSchema>;
const storageKey = "healthmate-demo-appointments";
type BookingStorage = Pick<Storage, "getItem" | "setItem">;

export function appointmentDay(offset = 0, now = new Date()) {
  const day = new Date(now);
  day.setDate(day.getDate() + offset);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}
export function validateAppointment(
  value: unknown,
  now = new Date(),
): AppointmentInput {
  const input = appointmentInputSchema.safeParse(value);
  if (!input.success) throw new Error("Choose a valid doctor, date and time.");
  if (
    input.data.date < appointmentDay(1, now) ||
    input.data.date > appointmentDay(30, now)
  )
    throw new Error("Choose a date within the next 30 days.");
  return input.data;
}
export function readDemoAppointments(
  storage?: BookingStorage,
): DemoAppointment[] {
  try {
    const target = storage ?? localStorage;
    const saved: unknown = JSON.parse(target.getItem(storageKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.slice(0, 100).flatMap((value) => {
      const result = appointmentSchema.safeParse(value);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}
export function bookDemoAppointment(
  value: unknown,
  storage?: BookingStorage,
): DemoAppointment {
  const input = validateAppointment(value);
  let target: BookingStorage;
  try {
    target = storage ?? localStorage;
  } catch {
    throw new Error(
      "The appointment could not be saved. Allow browser storage and try again.",
    );
  }
  const appointments = readDemoAppointments(target);
  const existing = appointments.find(
    (item) =>
      item.clinicianId === input.clinicianId &&
      item.date === input.date &&
      item.time === input.time,
  );
  if (
    existing &&
    (!input.description || input.description === existing.description)
  )
    return existing;
  if (!existing && appointments.length >= 100)
    throw new Error("The demo appointment list is full.");
  const booking: DemoAppointment = {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    demo: true,
  };
  try {
    const next = existing
      ? appointments.map((item) => (item.id === existing.id ? booking : item))
      : [...appointments, booking];
    target.setItem(storageKey, JSON.stringify(next));
  } catch {
    throw new Error(
      "The appointment could not be saved. Allow browser storage and try again.",
    );
  }
  return booking;
}
export function formatAppointmentDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
