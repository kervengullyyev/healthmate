import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLiveConnection } from "../src/lib/live/connection";
import {
  applyTranscript,
  emptyTranscript,
  parseLiveEvent,
} from "../src/lib/live/events";
class Channel extends EventTarget {
  readyState = "open";
  sent: string[] = [];
  closed = false;
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.closed = true;
  }
  emit(data: object) {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }
}
class Peer extends EventTarget {
  static latest: Peer;
  channel = new Channel();
  iceGatheringState = "complete";
  connectionState = "connected";
  localDescription = { sdp: "v=0\r\n" };
  remoteDescription: unknown;
  closed = false;
  constructor() {
    super();
    Peer.latest = this;
  }
  addTrack() {}
  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { type: "offer", sdp: "v=0\r\n" };
  }
  async setLocalDescription() {}
  async setRemoteDescription(value: unknown) {
    this.remoteDescription = value;
  }
  close() {
    this.closed = true;
  }
}
class AudioElement {
  autoplay = false;
  srcObject: unknown;
  controls = false;
  paused = false;
  async play() {}
  pause() {
    this.paused = true;
  }
}
let stopped: number;
const stream = () => ({
  getTracks: () => [
    {
      stop: () => {
        stopped++;
      },
      enabled: true,
    },
  ],
  getAudioTracks: () => [],
});
beforeEach(() => {
  stopped = 0;
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("Audio", AudioElement);
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: async () => stream() },
  });
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        session: { id: "live_test" },
        transport: { type: "webrtc", sdp: "answer" },
      },
      { status: 201 },
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function callbacks() {
  return {
    onStatus: vi.fn(),
    onError: vi.fn(),
    onTranscript: vi.fn(),
    onSpeaking: vi.fn(),
  };
}
function delegate(channel: Channel, callId = "pending-call") {
  const responseId = crypto.randomUUID();
  const delegationId = crypto.randomUUID();
  for (const event of [
    { type: "response.created", response: { id: responseId } },
    { type: "response.output_item.done", item: { type: "function_call", call_id: callId, name: "prepare_demo_appointment", arguments: JSON.stringify({ clinicianId: null, date: null, time: null, description: "Checkup" }) } },
    { type: "response.completed", response: { id: responseId, output: [] } },
  ]) channel.emit({ type: "response.event", delegation_id: delegationId, event_id: crypto.randomUUID(), event });
}
it("deduplicates a repeated call while its server availability request is pending", async () => {
  let resolve!: (response: Response) => void;
  let lookups = 0;
  vi.stubGlobal("fetch", async (url: string) => url.includes("availability") ? (lookups++, new Promise<Response>(r => { resolve = r; })) : Response.json({ session: { id: "test" }, transport: { type: "webrtc", sdp: "answer" } }));
  const connection = createLiveConnection(callbacks());
  await connected(connection);
  const channel = Peer.latest.channel;
  delegate(channel);
  await vi.waitFor(() => expect(lookups).toBe(1));
  delegate(channel);
  resolve(Response.json({ occupied: [] }));
  await vi.waitFor(() => expect(channel.sent).toHaveLength(4));
  expect(lookups).toBe(1);
  const results = channel.sent.map(s => JSON.parse(s)).filter(item => item.type === "response.item.create");
  expect(results[0].item.output).toBe(results[1].item.output);
  connection.dispose(); channel.emit({ type: "session.closed" });
});
it("does not send a delayed appointment result into a closed or restarted session", async () => {
  let resolve!: (response: Response) => void;
  let started = false;
  vi.stubGlobal("fetch", async (url: string) => url.includes("availability") ? new Promise<Response>(r => { resolve = r; started = true; }) : Response.json({ session: { id: "test" }, transport: { type: "webrtc", sdp: "answer" } }));
  const connection = createLiveConnection(callbacks());
  await connected(connection);
  const oldChannel = Peer.latest.channel;
  delegate(oldChannel);
  await vi.waitFor(() => expect(started).toBe(true));
  connection.dispose(); oldChannel.emit({ type: "session.closed" });
  await connected(connection);
  const newChannel = Peer.latest.channel;
  resolve(Response.json({ occupied: [] }));
  await new Promise(r => setTimeout(r, 20));
  expect(oldChannel.sent.map(s => JSON.parse(s).type)).toEqual(["session.close"]);
  expect(newChannel.sent).toEqual([]);
  connection.dispose(); newChannel.emit({ type: "session.closed" });
});
async function connected(connection: ReturnType<typeof createLiveConnection>) {
  const p = connection.start();
  await vi.waitFor(() => expect(Peer.latest.remoteDescription).toBeTruthy());
  Peer.latest.channel.emit({
    type: "session.started",
    session: { id: "live_test" },
  });
  await p;
}
it("permission denial reports an error and closes the peer", async () => {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    },
  });
  const cb = callbacks();
  const connection = createLiveConnection(cb);
  await connection.start();
  expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/microphone/i));
  expect(Peer.latest.closed).toBe(true);
});
it("ending during microphone acquisition stops a late stream and never creates a paid session", async () => {
  let resolve!: (value: unknown) => void;
  let requests = 0;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  vi.stubGlobal("fetch", async () => {
    requests++;
    return Response.json({});
  });
  const connection = createLiveConnection(callbacks());
  const start = connection.start();
  await connection.end();
  resolve(stream());
  await start;
  expect(stopped).toBe(1);
  expect(requests).toBe(0);
  expect(Peer.latest.closed).toBe(true);
});
it("graceful close waits for the final session event before releasing resources", async () => {
  const connection = createLiveConnection(callbacks());
  await connected(connection);
  const end = connection.end();
  expect(Peer.latest.channel.sent.map((s) => JSON.parse(s).type)).toContain(
    "session.close",
  );
  expect(stopped).toBe(0);
  Peer.latest.channel.emit({ type: "session.closed" });
  await end;
  expect(stopped).toBe(1);
  expect(Peer.latest.closed).toBe(true);
});
it("a missing close acknowledgment eventually releases the microphone", async () => {
  const cb = callbacks();
  const connection = createLiveConnection(cb);
  await connected(connection);
  vi.useFakeTimers();
  const end = connection.end();
  await vi.advanceTimersByTimeAsync(15001);
  await end;
  expect(stopped).toBe(1);
  expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/final/i));
});
it("malformed messages cannot crash the transcript parser", () => {
  expect(parseLiveEvent("not json")).toBeNull();
});
it("deduplicates events while preserving overlapping speech and exact text", () => {
  const first = {
    type: "session.input_transcript.delta",
    event_id: "u1",
    delta: "I feel",
    start_ms: 100,
    end_ms: 200,
  };
  let state = applyTranscript(emptyTranscript(), first);
  state = applyTranscript(state, first);
  state = applyTranscript(state, {
    type: "session.output_transcript.delta",
    event_id: "a1",
    delta: "I’m listening.",
    start_ms: 150,
    end_ms: 350,
  });
  state = applyTranscript(state, {
    type: "session.input_transcript.delta",
    event_id: "u2",
    delta: " unwell.",
    start_ms: 200,
    end_ms: 400,
  });
  expect(state.messages.map((m) => [m.role, m.content])).toEqual([
    ["user", "I feel unwell."],
    ["assistant", "I’m listening."],
  ]);
  expect("plan" in state).toBe(false);
});

it("returns completed tool results only after the delegated response finishes", async () => {
  const connection = createLiveConnection(callbacks());
  await connected(connection);
  const channel = Peer.latest.channel;
  const envelope = (event: object) =>
    channel.emit({
      type: "response.event",
      event_id: crypto.randomUUID(),
      delegation_id: "delegation_test",
      event,
    });
  envelope({
    type: "response.created",
    response: { id: "response_test", status: "in_progress", output: [] },
  });
  envelope({
    type: "response.output_item.done",
    output_index: 0,
    item: {
      id: "function_test",
      type: "function_call",
      status: "completed",
      call_id: "call_test",
      name: "unknown_action",
      arguments: "{}",
    },
  });
  expect(channel.sent).toHaveLength(0);
  envelope({
    type: "response.completed",
    response: {
      id: "response_test",
      status: "completed",
      output: [],
      tools: [],
      instructions: null,
    },
  });
  await vi.waitFor(() => expect(channel.sent).toHaveLength(2));
  const sent = channel.sent.map((value) => JSON.parse(value));
  expect(sent[0]).toMatchObject({
    type: "response.item.create",
    item: { type: "function_call_output", call_id: "call_test" },
  });
  expect(JSON.parse(sent[0].item.output)).toMatchObject({ status: "error" });
  expect(sent[1]).toMatchObject({ type: "response.create" });
  envelope({
    type: "response.completed",
    response: { id: "response_test", status: "completed", output: [] },
  });
  expect(channel.sent).toHaveLength(2);
  connection.dispose();
  channel.emit({ type: "session.closed" });
});
