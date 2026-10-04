import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST as session } from '../src/app/api/session/route';
import { POST as chat } from '../src/app/api/chat/route';
import { POST as plan } from '../src/app/api/plan/route';
import { callOpenAI } from '../src/lib/server/openai';
function request(path: string, body: unknown, origin = 'http://localhost:3000') { return new Request('http://localhost:3000/api/' + path, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'x-forwarded-for': crypto.randomUUID() }, body: JSON.stringify(body) }); }
const messages = [{ id: 'm1', role: 'user', content: 'My headaches keep coming back.' }];
beforeEach(() => { vi.stubEnv('OPENAI_API_KEY', 'test-key'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('missing credentials reject voice before making an upstream call', async () => {
  vi.stubEnv('OPENAI_API_KEY', ''); let calls = 0;
  vi.stubGlobal('fetch', async () => { calls++; throw new Error('should not connect'); });
  expect((await session(request('session', { sdp: 'v=0\r\n' }))).status).toBe(503); expect(calls).toBe(0);
});
it('rejects a cross-origin request before opening a billable session', async () => {
  expect((await session(request('session', { sdp: 'v=0\r\n' }, 'https://other.example'))).status).toBe(403);
});
it('rejects an injected system role and oversized patient message', async () => {
  expect((await chat(request('chat', { messages: [{ ...messages[0], role: 'system' }] }))).status).toBe(400);
  expect((await chat(request('chat', { messages: [{ ...messages[0], content: 'x'.repeat(2001) }] }))).status).toBe(400);
});
it('creates a Live session with the selected model and returns only handshake data', async () => {
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    expect(url).toBe('https://api.openai.com/v1/live/sessions');
    const body = JSON.parse(options.body as string);
    expect(body.session.model).toBe('gpt-live-1'); expect(body.session.delegation.responses.model).toBe('gpt-6-luna');
    expect(body.transport).toEqual({ type: 'webrtc', sdp: 'v=0\r\n' });
    return Response.json({ session: { id: 'live_test', instructions: 'private prompt' }, transport: { type: 'webrtc', sdp: 'answer' } }, { status: 201 });
  });
  const r = await session(request('session', { sdp: 'v=0\r\n' }));
  expect(r.status).toBe(201); expect(await r.json()).toEqual({ session: { id: 'live_test' }, transport: { type: 'webrtc', sdp: 'answer' } });
});
it('turns upstream rate limits into a useful error without leaking raw detail', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ error: { message: 'secret diagnostic test-key' } }, { status: 429 }));
  const r = await chat(request('chat', { messages }));
  expect(r.status).toBe(429); const data = await r.json(); expect(data.error).toMatch(/limit/i); expect(data.error).not.toContain('test-key');
});
it('rejects a malformed model plan instead of presenting a fabricated assessment', async () => {
  vi.stubGlobal('fetch', async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"urgency":"safe"}' }] }] }));
  expect((await plan(request('plan', { messages }))).status).toBe(502);
});
it('aborts an upstream operation after its deadline', async () => {
  vi.useFakeTimers();
  const upstream = (_url: unknown, options?: RequestInit) => new Promise<Response>((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); });
  const result = callOpenAI('/responses', {}, { fetchImpl: upstream as typeof fetch }).catch(error => error);
  await vi.advanceTimersByTimeAsync(30001); expect(await result).toMatchObject({ status: 504 });
});
