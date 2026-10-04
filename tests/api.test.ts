import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as session } from "../src/app/api/session/route";
import { POST as chat } from "../src/app/api/chat/route";
import { POST as plan } from "../src/app/api/plan/route";
import { callOpenAI } from "../src/lib/server/openai";
import { GET as status } from "../src/app/api/status/route";
import { auth } from "../src/auth";
vi.mock("../src/auth", () => ({ auth: vi.fn() }));
function request(
  path: string,
  body: unknown,
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/" + path, {
    method: "POST",
    headers: {
      origin,
      "Content-Type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}
const messages = [
  { id: "m1", role: "user", content: "My headaches keep coming back." },
];
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.mocked(auth).mockResolvedValue({ user: { id: crypto.randomUUID(), email: "alex@example.test" }, expires: "2099-01-01" } as never);
});
it("rejects signed-out users at each AI handler before reading data or calling OpenAI", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  const upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  for (const handler of [chat, plan, session])
    expect((await handler(request("protected", {}))).status).toBe(401);
  expect((await status()).status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("missing credentials reject voice before making an upstream call", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    throw new Error("should not connect");
  });
  expect((await session(request("session", { sdp: "v=0\r\n" }))).status).toBe(
    503,
  );
  expect(calls).toBe(0);
});
it("rejects a cross-origin request before opening a billable session", async () => {
  expect(
    (
      await session(
        request("session", { sdp: "v=0\r\n" }, "https://other.example"),
      )
    ).status,
  ).toBe(403);
});
it("rejects an injected system role and oversized patient message", async () => {
  expect(
    (
      await chat(
        request("chat", { messages: [{ ...messages[0], role: "system" }] }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await chat(
        request("chat", {
          messages: [{ ...messages[0], content: "x".repeat(2001) }],
        }),
      )
    ).status,
  ).toBe(400);
});
it("creates a Live session with the selected model and returns only handshake data", async () => {
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    expect(url).toBe("https://api.openai.com/v1/live/sessions");
    const body = JSON.parse(options.body as string);
    expect(body.session.model).toBe("gpt-live-1");
    expect(body.session.delegation.responses.model).toBe("gpt-6-luna");
    expect(body.transport).toEqual({ type: "webrtc", sdp: "v=0\r\n" });
    return Response.json(
      {
        session: { id: "live_test", instructions: "private prompt" },
        transport: { type: "webrtc", sdp: "answer" },
      },
      { status: 201 },
    );
  });
  const r = await session(request("session", { sdp: "v=0\r\n" }));
  expect(r.status).toBe(201);
  expect(await r.json()).toEqual({
    session: { id: "live_test" },
    transport: { type: "webrtc", sdp: "answer" },
  });
});
it("turns upstream rate limits into a useful error without leaking raw detail", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json(
      { error: { message: "secret diagnostic test-key" } },
      { status: 429 },
    ),
  );
  const r = await chat(request("chat", { messages }));
  expect(r.status).toBe(429);
  const data = await r.json();
  expect(data.error).toMatch(/limit/i);
  expect(data.error).not.toContain("test-key");
});
it("rejects a malformed model plan instead of presenting a fabricated assessment", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"urgency":"safe"}' }],
        },
      ],
    }),
  );
  expect((await plan(request("plan", { messages }))).status).toBe(502);
});
it("aborts an upstream operation after its deadline", async () => {
  vi.useFakeTimers();
  const upstream = (_url: unknown, options?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  const result = callOpenAI(
    "/responses",
    {},
    { fetchImpl: upstream as typeof fetch },
  ).catch((error) => error);
  await vi.advanceTimersByTimeAsync(30001);
  expect(await result).toMatchObject({ status: 504 });
});
it("uses the browser-facing host when Next normalizes its internal URL", async () => {
  const r = new Request("http://localhost:3000/api/plan", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "Content-Type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
    },
    body: JSON.stringify({ messages: [] }),
  });
  expect((await plan(r)).status).toBe(400);
});
it("rejects an untrusted host even when its Origin matches", async () => {
  const upstream = vi.fn(async () => {
    throw new Error("must not call upstream");
  });
  vi.stubGlobal("fetch", upstream);
  const r = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: {
      host: "other.example:3000",
      origin: "http://other.example:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sdp: "v=0\r\n" }),
  });
  expect((await session(r)).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});

it("accepts the configured HTTPS origin through a loopback tunnel", async () => {
  vi.stubEnv("APP_ORIGIN", "https://ontuc.com");
  const r = new Request("http://localhost:3000/api/plan", {
    method: "POST",
    headers: { host: "ontuc.com", origin: "https://ontuc.com", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  expect((await plan(r)).status).toBe(400);
});
it.each([
  { host: "ontuc.com", origin: "https://other.example", forwarded: "ontuc.com" },
  { host: "other.example", origin: "https://ontuc.com", forwarded: "ontuc.com" },
  { host: "ontuc.com", origin: "http://ontuc.com", forwarded: "ontuc.com" },
  { host: "other.example@ontuc.com", origin: "https://ontuc.com", forwarded: "ontuc.com" },
  { host: "ontuc.com/path", origin: "https://ontuc.com", forwarded: "ontuc.com" },
  { host: "ontuc.com:80", origin: "https://ontuc.com", forwarded: "ontuc.com" },
  { host: "ontuc.com:443", origin: "https://ontuc.com", forwarded: "ontuc.com" },
])("rejects mismatched public origins and forwarded-host spoofing: %j", async ({ host, origin, forwarded }) => {
  vi.stubEnv("APP_ORIGIN", "https://ontuc.com");
  const upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  const r = new Request("http://localhost:3000/api/session", {
    method: "POST",
    headers: { host, origin, "x-forwarded-host": forwarded, "Content-Type": "application/json" },
    body: JSON.stringify({ sdp: "v=0\r\n" }),
  });
  expect((await session(r)).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});

it("limits an authenticated account even when forwarded IP headers change", async () => {
  const upstream = vi.fn();
  vi.stubGlobal("fetch", upstream);
  // Malformed bodies consume the budget without making a paid request.
  for (let i = 0; i < 30; i++)
    expect((await plan(request("plan", { messages: [] }))).status).toBe(400);
  expect((await session(request("session", { sdp: "v=0\r\n" }))).status).toBe(429);
  expect(upstream).not.toHaveBeenCalled();
});
