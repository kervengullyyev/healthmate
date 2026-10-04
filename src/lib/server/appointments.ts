import { DatabaseSync } from "node:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { appointmentDay, appointmentInputSchema, storedAppointmentSchema, validateAppointment, type Appointment, type AppointmentInput } from "../demo-appointments";
import { ApiError } from "./openai";

const columns = "id, clinician_id AS clinicianId, date, time, description, 'booked' AS status, created_at AS createdAt";
export class AppointmentStore {
  private db: DatabaseSync;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
        clinician_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
        description TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE (clinician_id, date, time)
      );
      CREATE INDEX IF NOT EXISTS appointments_owner ON appointments(owner_id);`);
  }
  close() { this.db.close(); }
  list(owner: string): Appointment[] {
    return this.db.prepare(`SELECT ${columns} FROM appointments WHERE owner_id = ? ORDER BY date, time`).all(owner).map(row => storedAppointmentSchema.parse(row));
  }
  occupied(): Pick<AppointmentInput, "clinicianId" | "date" | "time">[] {
    return this.db.prepare("SELECT clinician_id AS clinicianId, date, time FROM appointments WHERE date >= ? AND date <= ?").all(appointmentDay(1), appointmentDay(30)).map(row => ({ clinicianId: appointmentInputSchema.shape.clinicianId.parse(row.clinicianId), date: String(row.date), time: appointmentInputSchema.shape.time.parse(row.time) }));
  }
  private save(owner: string, input: AppointmentInput): Appointment {
    const slot = [input.clinicianId, input.date, input.time];
    const existing = this.db.prepare(`SELECT ${columns}, owner_id FROM appointments WHERE clinician_id = ? AND date = ? AND time = ?`).get(...slot);
    if (existing && existing.owner_id !== owner) throw new ApiError(409, "That appointment slot is no longer available. Choose another time.");
    if (existing) {
      if (input.description) this.db.prepare("UPDATE appointments SET description = ? WHERE id = ? AND owner_id = ?").run(input.description, String(existing.id), owner);
      return storedAppointmentSchema.parse({ ...input, id: existing.id, status: "booked", createdAt: existing.createdAt, description: input.description || existing.description });
    }
    const saved: Appointment = { ...input, id: randomUUID(), status: "booked", createdAt: new Date().toISOString() };
    this.db.prepare("INSERT INTO appointments (id, owner_id, clinician_id, date, time, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(saved.id, owner, input.clinicianId, input.date, input.time, input.description, saved.createdAt);
    return saved;
  }
  private transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = action(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  book(owner: string, value: unknown): Appointment {
    let input: AppointmentInput;
    try { input = validateAppointment(value); }
    catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Choose a valid appointment."); }
    return this.transaction(() => this.save(owner, input));
  }
  import(owner: string, values: unknown[]): Appointment[] {
    const inputs = values.map(value => {
      const input = appointmentInputSchema.parse(value);
      // Earlier browser records may be historical; never reserve future dates outside the supported window.
      if (input.date > appointmentDay(30)) throw new ApiError(400, "An imported appointment is outside the supported date range.");
      return input;
    });
    return this.transaction(() => inputs.map(input => this.save(owner, input)));
  }
}

let current: { path: string; store: AppointmentStore } | undefined;
export function getAppointmentStore() {
  const path = process.env.APPOINTMENTS_DB_PATH || join(process.cwd(), "data", "appointments.sqlite");
  if (!current || current.path !== path) {
    current?.store.close();
    current = { path, store: new AppointmentStore(path) };
  }
  return current.store;
}
