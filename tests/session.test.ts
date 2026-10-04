import { expect, it } from 'vitest';
import { createSession, sessionReducer } from '../src/lib/session';
import { demoPlan, getDemoReply } from '../src/lib/demo';
it('switching to live cannot leak the demo patient or appointment', () => {
  let state = createSession('demo');
  state = sessionReducer(state, { type: 'message', message: { id: '1', role: 'user', content: 'Sample headache' } });
  state = sessionReducer(state, { type: 'plan', plan: demoPlan });
  state = sessionReducer(state, { type: 'booking', booking: { id: 'b1', clinicianId: 'c1', slot: 'Tomorrow 15:30', demo: true } });
  const live = sessionReducer(state, { type: 'reset', mode: 'live' });
  expect(live.messages).toEqual([]); expect(live.plan).toBeNull(); expect(live.booking).toBeNull(); expect(live.brief).toBe('');
});
it('does not erase patient edits when a regenerated plan arrives', () => {
  let state = sessionReducer(createSession('live'), { type: 'plan', plan: demoPlan });
  state = sessionReducer(state, { type: 'brief', text: 'Patient correction: three weeks.' });
  state = sessionReducer(state, { type: 'plan', plan: { ...demoPlan, doctorBrief: 'New generated text' } });
  expect(state.brief).toBe('Patient correction: three weeks.');
});
it('requires several demo interview turns before a care plan', () => {
  expect(getDemoReply(0).readyForPlan).toBe(false);
  expect(getDemoReply(2).readyForPlan).toBe(false);
  expect(getDemoReply(4).readyForPlan).toBe(true);
});
