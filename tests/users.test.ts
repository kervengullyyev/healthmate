import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { NextAuthConfig } from "next-auth";
import "../src/auth";
import { requireUser } from "../src/lib/server/authentication";
import { getAppointmentStore } from "../src/lib/server/appointments";
import { appointmentDay } from "../src/lib/demo-appointments";

const configured = vi.hoisted(() => ({ config: {} as NextAuthConfig, session: null as unknown }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  configured.config = config;
  return { handlers: {}, auth: async () => configured.session };
} }));
let directory: string;
let database: DatabaseSync;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "ontuc-users-"));
  vi.stubEnv("APPOINTMENTS_DB_PATH", join(directory, "users.sqlite"));
  getAppointmentStore();
  database = new DatabaseSync(join(directory, "users.sqlite"));
});
beforeEach(() => { configured.session = null; });
afterAll(() => { database.close(); getAppointmentStore().close(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
const rows = (id: string) => database.prepare("SELECT * FROM users WHERE id = ?").all(id);

it("stores a Google user's profile at sign-in without OAuth credentials", async () => {
  await configured.config.callbacks!.jwt!({ token: { name: "Alex", email: "alex@example.test", picture: "https://example.test/alex.png" }, account: { provider: "google", providerAccountId: "google-alex", access_token: "must-not-be-stored" } } as never);
  expect(rows("google-alex")).toHaveLength(1);
  expect(rows("google-alex")[0]).toMatchObject({ id: "google-alex", name: "Alex", email: "alex@example.test", image: "https://example.test/alex.png" });
  expect(JSON.stringify(rows("google-alex"))).not.toContain("must-not-be-stored");
});
it("backfills an existing authenticated session and links its appointments by Google ID", async () => {
  configured.session = { user: { id: "existing-user", name: "Existing", email: "existing@example.test", image: null }, expires: "2099-01-01" };
  await requireUser();
  getAppointmentStore().book("existing-user", { clinicianId: "anna", date: appointmentDay(1), time: "15:30", description: "Summary" });
  expect(database.prepare("SELECT users.email FROM appointments JOIN users ON users.id = appointments.owner_id WHERE users.id = ?").get("existing-user")).toMatchObject({ email: "existing@example.test" });
});
it("updates the same user's profile without duplicates or resetting their first-seen timestamp", async () => {
  getAppointmentStore().upsertUser({ id: "repeat", name: "Old", email: "old@example.test" });
  database.prepare("UPDATE users SET created_at = ?, last_seen_at = ? WHERE id = ?").run("2025-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z", "repeat");
  getAppointmentStore().upsertUser({ id: "repeat", name: "New", email: "new@example.test", image: "https://example.test/new.png" });
  expect(rows("repeat")).toHaveLength(1);
  expect(rows("repeat")[0]).toMatchObject({ name: "New", email: "new@example.test", created_at: "2025-01-01T00:00:00.000Z" });
  expect(rows("repeat")[0].last_seen_at).not.toBe("2025-01-01T00:00:00.000Z");
});
it("does not store signed-out or unrelated-provider identities", async () => {
  const before = database.prepare("SELECT count(*) AS total FROM users").get();
  await expect(requireUser()).rejects.toThrow(/sign in/i);
  await configured.config.callbacks!.jwt!({ token: { sub: "untrusted-provider", email: "untrusted@example.test" }, account: { provider: "other", providerAccountId: "untrusted-provider" } } as never);
  expect(database.prepare("SELECT count(*) AS total FROM users").get()).toEqual(before);
});
it("persists user profiles across database connections", () => {
  getAppointmentStore().upsertUser({ id: "persistent", name: "Saved", email: "saved@example.test" });
  const other = new DatabaseSync(join(directory, "users.sqlite"));
  try { expect(other.prepare("SELECT email FROM users WHERE id = ?").get("persistent")).toMatchObject({ email: "saved@example.test" }); }
  finally { other.close(); }
});
it("does not let an older session overwrite a newer Google sign-in profile", async () => {
  getAppointmentStore().upsertUser({ id: "stale-session", name: "New", email: "new@example.test", image: "https://example.test/new.png" });
  configured.session = { user: { id: "stale-session", name: "Old", email: "old@example.test", image: "https://example.test/old.png" }, expires: "2099-01-01" };
  await requireUser();
  expect(rows("stale-session")[0]).toMatchObject({ name: "New", email: "new@example.test", image: "https://example.test/new.png" });
});
it("does not erase a stored Google profile when an older session omits its fields", () => {
  getAppointmentStore().upsertUser({ id: "partial", name: "Known", email: "known@example.test", image: "https://example.test/known.png" });
  getAppointmentStore().upsertUser({ id: "partial" });
  expect(rows("partial")[0]).toMatchObject({ name: "Known", email: "known@example.test", image: "https://example.test/known.png" });
});
