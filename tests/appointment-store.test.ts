import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppointmentStore } from "../src/lib/server/appointments";
import { appointmentDay } from "../src/lib/demo-appointments";

let directory: string;
let store: AppointmentStore;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "ontuc-appointments-"));
  store = new AppointmentStore(join(directory, "appointments.sqlite"));
});
afterEach(() => { store?.close(); rmSync(directory, { recursive: true, force: true }); });
const input = () => ({ clinicianId: "anna" as const, date: appointmentDay(1), time: "15:30" as const, description: "Patient reports headaches. Cause unknown." });
it("persists a booked appointment and description after reopening the database", () => {
  const saved = store.book("alice", input());
  store.close();
  store = new AppointmentStore(join(directory, "appointments.sqlite"));
  expect(store.list("alice")).toEqual([saved]);
  expect(saved.status).toBe("booked");
});
it("keeps one Google account's records private from another", () => {
  store.book("alice", input());
  expect(store.list("bob")).toEqual([]);
});
it("protects a reserved slot even through a second database connection", () => {
  const other = new AppointmentStore(join(directory, "appointments.sqlite"));
  try {
    store.book("alice", input());
    expect(() => other.book("bob", input())).toThrow(/no longer available/i);
    expect(other.list("bob")).toEqual([]);
    expect(other.occupied()).toEqual([{ clinicianId: "anna", date: input().date, time: "15:30" }]);
  } finally { other.close(); }
});
it("preserves the booking ID and summary on repeated saves", () => {
  const first = store.book("alice", input());
  const second = store.book("alice", { ...input(), description: "Updated summary" });
  const third = store.book("alice", { ...input(), description: "" });
  expect(second.id).toBe(first.id);
  expect(third.description).toBe("Updated summary");
  expect(store.list("alice")).toHaveLength(1);
});
it("imports browser history atomically and refuses another owner's occupied slot", () => {
  store.book("bob", input());
  expect(() => store.import("alice", [{ ...input(), time: "16:00" }, input()])).toThrow(/no longer available/i);
  expect(store.list("alice")).toEqual([]);
  store.import("alice", [{ ...input(), date: appointmentDay(-1) }]);
  expect(store.list("alice")).toHaveLength(1);
});
