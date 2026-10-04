import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createLiveConnection } from '../src/lib/live/connection';
import { applyTranscript, emptyTranscript, parseLiveEvent } from '../src/lib/live/events';
class Channel extends EventTarget { readyState = 'open'; sent: string[] = []; closed = false; send(s: string) { this.sent.push(s); } close() { this.closed = true; } emit(data: object) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); } }
class Peer extends EventTarget { static latest: Peer; channel = new Channel(); iceGatheringState = 'complete'; connectionState = 'connected'; localDescription = { sdp: 'v=0\r\n' }; remoteDescription: unknown; closed = false; constructor() { super(); Peer.latest = this; } addTrack() {} createDataChannel() { return this.channel; } async createOffer() { return { type: 'offer', sdp: 'v=0\r\n' }; } async setLocalDescription() {} async setRemoteDescription(value: unknown) { this.remoteDescription = value; } close() { this.closed = true; } }
class AudioElement { autoplay = false; srcObject: unknown; controls = false; paused = false; async play() {} pause() { this.paused = true; } }
let stopped: number;
const stream = () => ({ getTracks: () => [{ stop: () => { stopped++; }, enabled: true }], getAudioTracks: () => [] });
beforeEach(() => { stopped = 0; vi.stubGlobal('RTCPeerConnection', Peer); vi.stubGlobal('Audio', AudioElement); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => stream() } }); vi.stubGlobal('fetch', async () => Response.json({ session: { id: 'live_test' }, transport: { type: 'webrtc', sdp: 'answer' } }, { status: 201 })); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function callbacks() { return { onStatus: vi.fn(), onError: vi.fn(), onTranscript: vi.fn(), onSpeaking: vi.fn() }; }
async function connected(connection: ReturnType<typeof createLiveConnection>) { const p = connection.start(); await vi.waitFor(() => expect(Peer.latest.remoteDescription).toBeTruthy()); Peer.latest.channel.emit({ type: 'session.started', session: { id: 'live_test' } }); await p; }
it('permission denial reports an error and closes the peer', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
  const cb = callbacks(); const connection = createLiveConnection(cb); await connection.start();
  expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/microphone/i)); expect(Peer.latest.closed).toBe(true);
});
it('ending during microphone acquisition stops a late stream and never creates a paid session', async () => {
  let resolve!: (value: unknown) => void; let requests = 0;
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(r => { resolve = r; }) } });
  vi.stubGlobal('fetch', async () => { requests++; return Response.json({}); });
  const connection = createLiveConnection(callbacks()); const start = connection.start(); await connection.end(); resolve(stream()); await start;
  expect(stopped).toBe(1); expect(requests).toBe(0); expect(Peer.latest.closed).toBe(true);
});
it('graceful close waits for the final session event before releasing resources', async () => {
  const connection = createLiveConnection(callbacks()); await connected(connection); const end = connection.end();
  expect(Peer.latest.channel.sent.map(s => JSON.parse(s).type)).toContain('session.close'); expect(stopped).toBe(0);
  Peer.latest.channel.emit({ type: 'session.closed' }); await end; expect(stopped).toBe(1); expect(Peer.latest.closed).toBe(true);
});
it('a missing close acknowledgment eventually releases the microphone', async () => {
  const cb = callbacks(); const connection = createLiveConnection(cb); await connected(connection); vi.useFakeTimers();
  const end = connection.end(); await vi.advanceTimersByTimeAsync(15001); await end;
  expect(stopped).toBe(1); expect(cb.onError).toHaveBeenCalledWith(expect.stringMatching(/final/i));
});
it('malformed messages cannot crash the transcript parser', () => { expect(parseLiveEvent('not json')).toBeNull(); });
it('deduplicates events while preserving overlapping speech and exact text', () => {
  const first = { type: 'session.input_transcript.delta', event_id: 'u1', delta: 'I feel', start_ms: 100, end_ms: 200 };
  let state = applyTranscript(emptyTranscript(), first); state = applyTranscript(state, first);
  state = applyTranscript(state, { type: 'session.output_transcript.delta', event_id: 'a1', delta: 'I’m listening.', start_ms: 150, end_ms: 350 });
  state = applyTranscript(state, { type: 'session.input_transcript.delta', event_id: 'u2', delta: ' unwell.', start_ms: 200, end_ms: 400 });
  expect(state.messages.map(m => [m.role, m.content])).toEqual([['user', 'I feel unwell.'], ['assistant', 'I’m listening.']]);
  expect('plan' in state).toBe(false);
});
