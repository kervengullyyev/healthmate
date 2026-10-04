import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GET, POST } from "../src/app/api/appointments/route";
import { GET as availability } from "../src/app/api/appointments/availability/route";
import { POST as importBookings } from "../src/app/api/appointments/import/route";
import { auth } from "../src/auth";
import { getAppointmentStore } from "../src/lib/server/appointments";
import { appointmentDay } from "../src/lib/demo-appointments";
vi.mock("../src/auth", () => ({ auth: vi.fn() }));
let directory: string;
let day = 0;
let currentUserId = "";
function user(id: string) { currentUserId = id; vi.mocked(auth).mockResolvedValue({ user: { id }, expires: "2099-01-01" } as never); }
beforeAll(() => { directory = mkdtempSync(join(tmpdir(), "ontuc-api-")); vi.stubEnv("APPOINTMENTS_DB_PATH", join(directory, "test.sqlite")); vi.stubEnv("APP_ORIGIN", "https://ontuc.com"); });
beforeEach(() => { day++; user(crypto.randomUUID()); });
afterAll(() => { getAppointmentStore().close(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
const input = () => ({ clinicianId: "anna", date: appointmentDay(day), time: "15:30", description: "Reported headaches. Cause unknown." });
const request = (body: unknown, origin = "https://ontuc.com") => new Request("http://localhost:3000/api/appointments", { method: "POST", headers: { host: "ontuc.com", origin, "Content-Type": "application/json" }, body: JSON.stringify({ expectedAccountId: currentUserId, ...(body as object) }) });
it("rejects signed-out list, availability, create and import without saving", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  expect((await GET()).status).toBe(401);
  expect((await availability()).status).toBe(401);
  expect((await POST(request(input()))).status).toBe(401);
  expect((await importBookings(request({ appointments: [input()] }))).status).toBe(401);
});
it("uses the verified identity and refuses an owner supplied in JSON", async () => {
  expect((await POST(request({ ...input(), userId: "victim" }))).status).toBe(400);
  expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  expect(await (await GET()).json()).toEqual({ appointments: [] });
});
it("blocks cross-origin and invalid-date writes", async () => {
  expect((await POST(request(input(), "https://other.example"))).status).toBe(403);
  expect((await POST(request({ ...input(), date: appointmentDay(-1) }))).status).toBe(400);
});
it("rejects stale account intent on writes and legacy import", async () => {
  expect((await POST(request({ ...input(), expectedAccountId: "old-account" }))).status).toBe(403);
  expect((await importBookings(request({ appointments: [input()], expectedAccountId: "old-account" }))).status).toBe(403);
  expect(await (await GET()).json()).toEqual({ appointments: [] });
});
it("stores the summary, hides it from other users and never exposes it in availability", async () => {
  user("alice");
  const response = await POST(request(input()));
  expect(response.status).toBe(201);
  const saved = await response.json();
  expect(saved.appointment).toMatchObject({ description: input().description, status: "booked" });
  expect(saved.appointment).not.toHaveProperty("owner_id");
  expect(await (await GET()).json()).toEqual({ appointments: [saved.appointment] });
  user("bob");
  expect(await (await GET()).json()).toEqual({ appointments: [] });
  const slots = await (await availability()).json();
  expect(JSON.stringify(slots)).not.toContain(input().description);
  expect((await POST(request(input()))).status).toBe(409);
});
it("imports only into the session's account and preserves summaries on replay", async () => {
  user("legacy-owner");
  expect((await importBookings(request({ appointments: [input()] }))).status).toBe(200);
  expect((await importBookings(request({ appointments: [input()] }))).status).toBe(200);
  const saved = await (await GET()).json();
  expect(saved.appointments).toHaveLength(1);
  expect(saved.appointments[0].description).toBe(input().description);
  user("other-owner");
  expect(await (await GET()).json()).toEqual({ appointments: [] });
});
