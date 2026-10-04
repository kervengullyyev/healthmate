import { z } from "zod";
import { accountStorageKey, readDemoAppointments, storedAppointmentSchema, type AppointmentInput } from "./demo-appointments";

async function request(path: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/appointments${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store", signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The appointment could not be saved. Please try again.");
  return data;
}
const listSchema = z.object({ appointments: z.array(storedAppointmentSchema) });
export async function listAppointments(signal?: AbortSignal) {
  return listSchema.parse(await request("", undefined, signal)).appointments;
}
export async function bookAppointment(input: AppointmentInput, signal?: AbortSignal, expectedAccountId?: string) {
  return z.object({ appointment: storedAppointmentSchema }).parse(await request("", { ...input, expectedAccountId }, signal)).appointment;
}
export async function occupiedAppointments(signal?: AbortSignal) {
  return z.object({ occupied: z.array(storedAppointmentSchema.pick({ clinicianId: true, date: true, time: true })) }).parse(await request("/availability", undefined, signal)).occupied;
}
const migrations = new Map<string, Promise<void>>();
export function importBrowserAppointments(userId: string): Promise<void> {
  const previous = migrations.get(userId);
  if (previous) return previous;
  const importing = (async () => {
    const key = accountStorageKey("healthmate-appointments-sqlite-migrated", userId);
    try { if (localStorage.getItem(key) === "true") return; } catch { return; }
    const old = readDemoAppointments(undefined, userId);
    if (old.length) await request("/import", { expectedAccountId: userId, appointments: old.map(({ clinicianId, date, time, description }) => ({ clinicianId, date, time, description })) });
    // Original records stay intact, including when import or storage fails.
    try { localStorage.setItem(key, "true"); } catch { /* Server persistence still works without browser storage. */ }
  })();
  migrations.set(userId, importing);
  void importing.catch(() => migrations.delete(userId));
  return importing;
}
