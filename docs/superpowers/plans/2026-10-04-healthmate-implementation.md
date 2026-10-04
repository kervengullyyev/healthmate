# HealthMate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved five-screen HealthMate web app with GPT-Live voice, text chat, a credential-free synthetic demo, care plans, sample appointments and an editable doctor brief.

**Architecture:** A Next.js App Router application separates UI, session state, validated domain data, private OpenAI HTTP integration and browser WebRTC lifecycle. All credentials and session configuration remain server-side. Demo sessions use isolated deterministic data; live conversations remain in memory.

**Tech Stack:** Next.js, React, TypeScript, CSS, Zod, Vitest, Testing Library and Playwright. Use Node.js 22 and npm; resolve supported package versions during installation and commit the lockfile.

**Spec:** `docs/superpowers/specs/2026-10-04-healthmate-design.md`

## Global Constraints

- The voice model is exactly `gpt-live-1`; default backend model is `gpt-6-luna`, configured only on the server.
- Read `OPENAI_API_KEY` only on the server, without a `NEXT_PUBLIC_` prefix.
- Demo mode is explicit, deterministic and entirely offline. Do not silently turn a failed live call into a simulated one.
- Every relevant screen identifies synthetic clinician slots and records as demo appointments. No real clinic is contacted.
- Keep live symptom transcripts in memory by default; no raw audio recording or health-data logging.
- Preserve the generated avatar's alpha, record its prompt and disclose GPT Image and Codex.
- Unknown information stays unknown; no definitive diagnoses, prescriptions, fabricated measurements or promises of clinical accuracy.
- Authentication, uploads, real clinics, analytics, a native mobile app, pitch deck and public deployment are outside this implementation.

## Review Focus

- Rapid start/end or navigation during microphone acquisition must release late-arriving media without creating an orphaned billable session: Task 4 cancellation tests.
- Switching between live and demo must never reuse symptom history, plans or bookings from the other mode: Task 1 session-isolation tests.
- Missing or malformed model output must show an error and preserve existing edits: Task 2 API tests and Task 5 browser tests.
- Partial or duplicate transcript fragments must not create a completed care plan or duplicate display entries: Task 4 transcript tests.
- Urgent plan results must interrupt routine appointment flow and keep urgent guidance visible on narrow screens: Task 5 browser tests.

## File Map

| Files | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`, `.env.example` | Runtime, checks and private environment configuration |
| `src/lib/domain.ts`, `src/lib/demo.ts`, `src/lib/session.ts` | Shared validated contracts, synthetic scenario and state transitions |
| `src/lib/server/openai.ts`, `src/lib/server/prompts.ts`, `src/lib/server/requests.ts` | Private upstream calls, conversation instructions and request protections |
| `src/app/api/status/route.ts`, `src/app/api/session/route.ts`, `src/app/api/chat/route.ts`, `src/app/api/plan/route.ts` | Configuration status, voice handshake, text conversation and structured plan endpoints |
| `src/lib/live/events.ts`, `src/lib/live/connection.ts`, `src/hooks/use-live.ts` | Typed event parsing, media lifecycle and React subscription |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` | Application entry, design system and print styles |
| `src/components/{app-shell,home,conversation,care-plan,appointments,doctor-brief,avatar}.tsx` | Accessible screens and mascot presentation |
| `public/images/healthmate-avatar.png` | Copy of the approved generated raster asset |
| `tests/{domain,session,api,live}.test.ts`, `tests/e2e/healthmate.spec.ts` | Meaningful domain, boundary, transport and journey checks |
| `README.md`, `docs/demo-script.md`, `docs/ai-and-resources.md` | Startup, demo instructions and submission disclosures |

### Task 1: Runnable foundation and isolated demo session

**Interfaces:** `Message = { id: string; role: 'user' | 'assistant'; content: string }`; `CarePlan = { concern: string; urgency: 'self-care' | 'consultation' | 'urgent'; reason: string; nextSteps: string[]; missingInformation: string[]; doctorBrief: string }`; `Booking = { id: string; clinicianId: string; slot: string; demo: true }`.

`messageSchema` and `carePlanSchema` validate these contracts. `createSession(mode: 'live' | 'demo'): SessionState` creates empty state; `sessionReducer(state: SessionState, action: SessionAction): SessionState` handles message, plan, edited-brief, booking, screen and reset actions. `getDemoReply(step: number): { reply: string; readyForPlan: boolean }` and `demoPlan: CarePlan` supply the explicit synthetic journey.

- [ ] Set up Next.js/TypeScript, npm scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`) and test tooling. Provide a minimal app entry so the domain deliverable is runnable; no detailed screens yet.
- [ ] Write `domain.test.ts` and `session.test.ts`: invalid urgency is rejected; patient text cannot become a system role; resetting demo to live yields zero messages and no plan/booking; edits survive unrelated state updates; demo responses require several interview turns before plan readiness.
- [ ] Run `npm test -- tests/domain.test.ts tests/session.test.ts`; confirm failure from missing domain/session exports.
- [ ] Implement the contracts, reducer and synthetic recurring-headache interview. Demo patient details are explicitly synthetic; unanswered history is not filled in. Restrict persisted data to the demo namespace.
- [ ] Run the same tests and `npm run typecheck`; require all to pass. Commit the runnable foundation and contracts.

### Task 2: Private OpenAI routes and structured plans

**Interfaces:** `callOpenAI(path: '/live/sessions' | '/responses', body: unknown, options?: { fetchImpl?: typeof fetch }): Promise<unknown>`; `getLiveConfig(): object`; `getAssistantReply(messages: Message[]): Promise<string>`; `getCarePlan(messages: Message[]): Promise<CarePlan>`.

Routes: `GET /api/status -> { liveConfigured: boolean }`; `POST /api/session { sdp: string } -> { session: { id: string }, transport: { type: 'webrtc', sdp: string } }`; `POST /api/chat { messages: Message[] } -> { reply: string }`; `POST /api/plan { messages: Message[] } -> { plan: CarePlan }`. Failure responses use `{ error: string }` and an appropriate non-2xx status, without raw upstream credentials or request bodies.

- [ ] Write API tests with mocked upstream `fetch`: missing key returns 503 without an upstream request; wrong Origin returns 403; invalid role/oversized text returns 400; upstream timeout/rate limit returns a readable error; invalid structured plan is rejected. Assert session payload uses `/v1/live/sessions`, `gpt-live-1`, WebRTC transport and Responses delegation with the configured backend model.
- [ ] Run `npm test -- tests/api.test.ts`; confirm expected failures.
- [ ] Implement request checks: exact same-origin browser requests, 64 KiB maximum body, SDP beginning `v=0`, 1–40 messages with 1–2000-character content, 30-second upstream timeout, and local per-client request limits. Document that local limits are not suitable for public multi-instance hosting.
- [ ] Implement private REST integration and prompts. Responses text extraction handles output text items; plan requests use strict JSON schema and Zod validation. Keep the Live conversational prompt brief and put health interview procedures in backend instructions. Add `.env.example` with empty `OPENAI_API_KEY`, `OPENAI_BACKEND_MODEL=gpt-6-luna` and `OPENAI_LIVE_VOICE=marin`.
- [ ] Review health prompt behaviour against authoritative medical sources for uncertainty and urgent escalation; record consulted sources. No keyword-only diagnostic engine.
- [ ] Run API tests and typecheck; commit when passing.

### Task 3: Responsive shell and branded home

**Interfaces:** `Avatar({ state: 'idle' | 'connecting' | 'listening' | 'speaking' })`; `AppShell({ screen, mode, onNavigate, children })`; `Home({ onStartVoice, onStartText, onStartDemo, liveConfigured })`.

- [ ] Copy the existing generated avatar to `public/images/healthmate-avatar.png` without modifying it. Confirm its dimensions and RGBA transparency.
- [ ] Implement the ivory/teal design system, desktop sidebar, mobile navigation, brand mark, welcoming home, capability cards and voice/text/demo entry actions. Use the generated mascot prominently with gentle motion; respect reduced motion.
- [ ] Include accurate configuration/connection labels, a brief companion-role explanation, visible focus styles and real button/link semantics. Avoid invented patient statistics and nonfunctional navigation.
- [ ] Run lint, typecheck and a production build. Inspect home at desktop and 390-pixel widths for clipping. Commit the shell and home.

### Task 4: GPT-Live browser connection and transcript

**Interfaces:** `createLiveConnection({ onStatus, onTranscript, onError, onSpeaking }): { start(): Promise<void>; mute(value: boolean): void; end(): Promise<void>; dispose(): void }`; `parseLiveEvent(raw: string): LiveEvent | null`; `applyTranscript(current: TranscriptState, event: LiveEvent): TranscriptState`. `useLive` exposes these controls and subscribes to session state.

- [ ] Write transport tests with fake peer/data-channel/media objects: permission denial releases resources; ending while permission is pending stops a late stream; duplicate events do not duplicate text; malformed JSON is ignored; `session.close` waits for `session.closed` before normal teardown; a bounded timeout cleans up a failed session.
- [ ] Run `npm test -- tests/live.test.ts`; confirm expected failures.
- [ ] Implement WebRTC: request microphone from user action, register track/events and data channel before creating the offer, await ICE with a 10-second bound, call `/api/session`, apply answer, and await `session.started`. Do not send `session.start` or legacy Realtime transcript events.
- [ ] Implement input/output transcript deltas with role and timestamp ordering, mute, an audio-playback fallback control, connected/speaking status, graceful close with a 15-second bound, and cleanup on unmount. Start cancellation uses a generation token so late async work cannot revive an ended session.
- [ ] Run live tests and typecheck. Live account calls remain conditional on a locally configured key. Commit the voice client.

### Task 5: Complete conversation-to-care journey

**Interfaces:** `Conversation` consumes message/session state and text/live/demo handlers; `CarePlanView` consumes `CarePlan`; `Appointments` produces a synthetic `Booking`; `DoctorBrief` consumes the edited brief text, plan and booking. All share the contracts from Task 1.

- [ ] Write Playwright journey tests: explicitly start demo; complete follow-ups; generate plan; choose and confirm sample slot; edit brief; revisit without losing edits; print view; reset. Add isolated tests for live/demo switching, failed plan regeneration preserving edits, urgent plan disabling routine booking, keyboard focus and mobile overflow.
- [ ] Run `npm run test:e2e`; confirm expected failures for missing screens/controls.
- [ ] Implement text chat using `/api/chat`, the isolated demo interview and voice session controls. Show pending/error states, avoid duplicate submissions, and never silently choose demo after a live error.
- [ ] Implement care-plan cards and explicit generation; allow the user to correct the concern and brief. Urgent plans show prominent guidance and block routine appointment continuation. Missing information remains visible.
- [ ] Implement synthetic clinician cards, relative future slots, appointment confirmation and demo-only persistence. No real bookings or communications. Surface synthetic status in both booking and brief.
- [ ] Implement editable doctor brief, text download and browser print/save-PDF with focused print CSS. Preserve edits during navigation and failed regeneration; replacing edits requires an explicit UI action.
- [ ] Run the journey suite, unit tests, lint, typecheck and build. Commit the complete journey.

### Task 6: Review, preview and delivery

- [ ] Write README with `npm install`, environment setup, `npm run dev`, supported HTTPS/localhost media requirements, model configuration, checks and known limitations. Write the 90-second synthetic demo script and resource/AI disclosures, referencing the exact avatar prompt.
- [ ] Perform a fresh whole-change review for privacy, credentials, cross-mode state, resource cleanup, medical claims, misleading booking language and unreachable controls. Fix actionable findings and rerun affected checks.
- [ ] Open the locally running app in Codex. Inspect desktop and mobile rendering, keyboard navigation, generated avatar, error states and print layout; save concise verification evidence.
- [ ] If a project key is available, test actual GPT-Live audio, interruptions, captions, mute and end. If unavailable, mark these as unverified and keep credential-free checks complete.
- [ ] Run final `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and `npm run test:e2e`; record actual outcomes. Commit documentation and fixes.
- [ ] Deliver the local preview URL, startup instructions and any remaining live-test limitation. Do not publish a site or contact clinicians in this scope.

## Plan Self-Review

Coverage: all five screens, exact voice model, backend delegation, credential-free demo, editable exports, avatar, medical uncertainty, errors and validation each have an owning task. Interfaces use the same Message, CarePlan and Booking contracts throughout. The five Review Focus cases each have an owning test. No unresolved placeholders or dependencies on an uncreated external service.

## Execution Handoff

Recommended approach: native execution in this chat, because the six tasks share tightly coupled contracts and media/session state. Implement in order, review the entire app after the journey works, and keep live verification conditional on credentials. Written plan review and execution-method selection are still pending.
