# HealthMate hackathon MVP

Date: 2026-10-04
Status: Design and written specification approved in conversation.

## Intent and success

HealthMate helps adults with a health concern explain their symptoms, understand an appropriate next step, and prepare for a medical visit. The hackathon demo must show one coherent journey: conversation -> care plan -> sample appointment booking -> doctor brief. The experience is an AI health companion, with clear limits on diagnosis and medical authority.

The user approved the five-screen web app, warm ivory and teal visual direction, Next.js and TypeScript, and a reliable demo mode. They explicitly selected OpenAI `gpt-live-1` for live conversation and GPT Image for a custom avatar.

Success means the app runs locally, looks polished on desktop and mobile, completes the demo journey without credentials, and offers a real GPT-Live connection when a project API key with access is configured. Account access and live audio must be tested separately from the credential-free demo.

## Product scope

1. Home: branded companion, greeting, primary Talk to HealthMate action, Type instead, and clearly identified Try a demo action. Do not invent health measurements or imply sample history belongs to the user.
2. Conversation: voice-first screen with mute, end-call, connection state, and live transcript. Text-only conversation works independently of microphone permission. Follow-up questions cover onset, severity, associated symptoms, relevant history and medication where appropriate.
3. Care plan: editable concern summary, suggested urgency, plain-language next steps, reason for seeking care, and missing information. Unknown information stays unknown. The user explicitly requests plan generation; partial transcripts are not presented as a finished assessment.
4. Appointments: synthetic clinician directory, sample slots, explicit selection and confirmation, and a persistent demo booking record. Every relevant screen identifies these as demo appointments. No real clinic is contacted.
5. Doctor brief: patient-reported symptoms, timeline, relevant history, medications, unanswered questions, care plan and selected sample appointment. The user can edit the brief and print or save it as a PDF through the browser. AI suggestions and patient statements are distinguishable.

Keep the MVP to these screens. Authentication, medical-record uploads, real clinic integration, medication prescriptions, longitudinal health analytics, and a mobile-native app are outside this iteration.

## Visual design and avatar

Use warm ivory backgrounds, deep teal headings, soft mint panels, generous spacing, readable typography and restrained motion. Cards have gentle borders and rounded corners. Desktop navigation uses a compact sidebar; mobile uses a condensed navigation bar. Primary actions remain easy to reach and keyboard accessible.

Generate one original GPT Image avatar: a friendly rounded 3D health companion with a mint/teal body, expressive dark eyes and a soft smile. It must not look like a licensed doctor or carry a medical uniform. Use a transparent background and preserve alpha. A gentle idle motion and a speaking halo respond to actual connection/audio state; no claim of photorealistic lip synchronisation.

Keep the generated asset in the repository before consuming it in code. Preserve its generation prompt and disclose GPT Image and Codex in project documentation.

## Architecture

Use Next.js App Router, React and TypeScript. Separate presentation components, conversation state, WebRTC lifecycle, demo data, AI prompts, validation and server integration. Use the official OpenAI SDK if its installed version supports Live; otherwise use the documented HTTP endpoints without changing the requested model.

The initial project is empty and has no Git repository. Initialise Git for this project's documents and code. Work in the user's current workspace; no isolated worktree is needed for an empty project.

### Voice

The voice model is exactly `gpt-live-1`. Use browser WebRTC with microphone and remote audio tracks, plus an `oai-events` data channel for transcripts and session events. The browser posts its SDP offer to a same-origin server route. The server calls `POST https://api.openai.com/v1/live/sessions` using the private project API key and returns only the session ID and SDP answer.

Create listeners and the data channel before the offer; wait for ICE gathering and `session.started` before application commands. Do not send `session.start` for an HTTP-created WebRTC session. Use the Live transcript events rather than legacy Realtime event names. Mute controls the local microphone track. Ending sends `session.close`; finalisation waits for `session.closed`, with bounded cleanup if the connection fails. Stop tracks, audio, data channel and peer connection on errors, unmount and cancellation.

Use Responses delegation for conversational reasoning, initially `gpt-6-luna`, configurable on the server. The detailed health interview rules belong in the backend prompt; the Live prompt sets tone, speaking style and delegation triggers. No action tools execute real bookings. Do not expose prompts or credentials as client-controlled session configuration.

### Text and structured outputs

Text-only chat calls a server route backed by the configured Responses model. Care-plan and brief generation uses the same backend model and a validated structured response. `gpt-live-1` is the voice frontend; do not request unsupported structured outputs from it.

Store a coherent session transcript in application state. Plan generation receives accumulated conversation history and user corrections as data. Validate request limits, roles and response schema. Reject incomplete or malformed model output instead of displaying a fabricated plan. Preserve editable user corrections when regenerating.

### State and demo

Keep live symptom transcripts in memory by default; no raw audio recording or health-data logging. Demo progress and a synthetic booking may use local storage under an explicit demo namespace. Reset clears demo state and releases media resources.

Demo mode is explicit, deterministic and entirely offline. Use a synthetic recurring-headache scenario with several follow-up questions, a sample care plan, sample slots and a doctor brief. Label it as a demonstration. Do not silently turn a failed live call into a simulated one. Demo data and flow are isolated from live state.

## Server boundaries and errors

Read `OPENAI_API_KEY` only on the server, without a `NEXT_PUBLIC_` prefix. Provide an example environment file with an empty key field. Document how to configure it locally; never ask the user to paste a secret into chat.

Validate same-origin requests, payload size, SDP format and allowed request structure. Provide bounded request timeouts and local abuse limits for billable endpoints. The MVP is a local demo; public deployment requires authentication and a shared rate-limit store before exposing unrestricted AI endpoints.

When credentials are missing, show a clear live-mode configuration message and keep the explicitly selected demo usable. Handle permission denial, unavailable media devices, unsupported browser, blocked audio playback, network timeouts, API denial, rate limits, malformed output and unexpected disconnects with actionable messages. Do not claim a session, booking or plan succeeded until its respective operation confirms success.

## Health-related behaviour

Explain the assistant's role briefly in the UI. Do not give definitive diagnoses, prescribe medication, fabricate measurements or promise clinical accuracy. Uncertainty and unanswered questions are visible. Urgent concerns interrupt the ordinary booking flow and direct the user toward urgent professional help. This is a hackathon prototype, not a clinically validated triage system.

Urgency categories are self-care guidance, consultation recommended and urgent evaluation. These are suggestions rather than guarantees. Verify representative ordinary and urgent scenarios against appropriate medical sources when implementing prompts and test fixtures. Do not implement a keyword-only rule that treats every mention of a symptom as a confirmed emergency or assumes that missing red flags means safety.

## Verification

- Typecheck, lint and production build.
- Meaningful unit tests for schema validation, state separation, API error handling and media cleanup.
- Integration checks of missing credentials, rejected payloads and validated model-output handling without paid API calls.
- Browser checks of the full synthetic demo, editable brief, booking confirmation, reset, keyboard operation and mobile layout.
- Verify the generated image's dimensions, transparency and rendering.
- When credentials are supplied, verify actual GPT-Live connection, listening, audio playback, interruption, transcript updates, mute and graceful end. Report any unavailable checks explicitly.

## Deliverables

A runnable local app; generated avatar and prompt record; environment example; README with startup, model configuration, limitations and AI/library disclosures; automated checks; and a concise demo script. A pitch deck and public deployment can follow after the app works but are not part of this implementation approval.

## Official API references verified for this specification

- GPT-Live 1 model: https://developers.openai.com/api/docs/models/gpt-live-1
- GPT-Live WebRTC setup: https://developers.openai.com/api/docs/guides/voice-webrtc
- Session lifecycle and transcripts: https://developers.openai.com/api/docs/guides/live-conversations
- Backend delegation: https://developers.openai.com/api/docs/guides/live-delegation

## Review checklist

No unresolved placeholders. The requested voice model is preserved; backend structured output is separated from voice generation. Real API use and synthetic booking are labelled distinctly. Missing credentials do not block demo mode. Live verification remains conditional on account credentials and model access. The implementation stays focused on the approved five-screen journey.
