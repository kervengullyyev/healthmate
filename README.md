# ontuc

A hackathon health companion with a minimal main screen: Milo, one **Talk to Milo** button and a compact top-right account icon. Click to start voice; the same button cancels setup or ends the conversation. While Milo speaks, the supplied `public/videos/milo.mp4` plays muted and loops continuously through speech pauses. User interruption stops it; response completion is inferred after two seconds of output silence, then the still avatar returns.

The complete care-plan, sample appointment and editable doctor-brief journey remains available at `/journey`. Clinicians and appointment slots are synthetic samples.

## Run locally

Use Node.js 22 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Configure Google sign-in using the [setup instructions](docs/google-sso-setup.md), then open [Milo](http://127.0.0.1:3000). For the optional complete journey, open [the care journey](http://127.0.0.1:3000/journey). **Try a demo** on that route works without an OpenAI API key after Google sign-in and walks through a fixed, clearly labelled synthetic headache scenario. The demo makes no AI requests; its fonts use Google Fonts with local system fallbacks.

For live voice and text, put a project `OPENAI_API_KEY` in `.env.local`. Keep it out of chat and version control. Restart the server after changing environment values. The API key stays on the server and has no `NEXT_PUBLIC_` prefix.

```dotenv
OPENAI_API_KEY=your-project-key
OPENAI_BACKEND_MODEL=gpt-6-luna
OPENAI_LIVE_VOICE=marin
```

The voice model is exactly **gpt-live-1**, using the Live WebRTC API with Responses delegation. The backend model and voice are server-configurable. The project/account must have access to these models. Microphone access needs localhost or HTTPS and browser permission; remote audio may require the **Enable audio** button if playback is blocked. On `/journey`, end a voice session before generating its plan, so final captions can arrive. The main screen keeps captions in the Records panel. The top-right menu shows the signed-in Google profile, a list of booked demo appointments, Records and Sign out. Name edits last only for the current page session. A small doctor/date/time/description form is available at `/appointments/new`. Milo can choose a doctor and the next available demo slot when preferences are missing, ask the specific confirmation question, then save it after fresh explicit consent. Explicit demo-booking requests can proceed after urgent-care guidance; the booking does not replace or delay urgent care. Manual and voice bookings share validation and browser storage.

## What works

- Live voice with captions, mute, playback fallback, graceful end and resource cleanup.
- Text interview and schema-validated suggested care plans.
- Google sign-in, protected platform/API routes, sign-out and appointment storage separated by account.
- Deterministic demo without an OpenAI key, with separate session state.
- Patient corrections, urgent guidance and blocked routine booking for urgent plans.
- Synthetic appointment selection and confirmation.
- Editable doctor brief, explicit draft restoration, text download and print/save PDF.
- Responsive layout, keyboard navigation and reduced-motion support.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

On 4 October 2026: 66 unit tests and 31 browser tests passed; lint, typecheck and production build passed. Browser checks cover the complete sample journey, edit preservation after upstream errors, urgent routing, mode isolation, mobile widths and keyboard access. Live transport tests use fake media and upstream calls. Actual account-backed voice/audio, interruptions and captions remain **unverified**; automated checks use mocked live audio and upstream calls, with actual browser playback of the supplied speaking video. A separate real Responses backend check passed the prepare → ask → consent → booking-tool sequence for a synthetic user request after urgent guidance; it did not exercise live speech. Real Google callback completion remains unverified until OAuth credentials are configured. See [verification evidence](docs/verification.md).

## Prototype boundaries

ontuc is an adult health companion, not a clinician or a clinically validated triage service. It does not diagnose or prescribe. AI output can be wrong and needs human review. Unknown history stays unknown. Possible urgent symptoms trigger professional-help guidance immediately. Milo may separately save a user-requested demo appointment after confirmation, while explaining that it does not replace or delay urgent care. The original care-journey screen still blocks routine booking for urgent plans.

There are no real appointments, external clinic contacts, uploads, analytics or app-side audio recording. Google supplies your verified identity, name and email; the app uses an encrypted, HttpOnly session cookie with a 24-hour lifetime. Live transcripts, plans and edits stay in browser memory; refreshing loses them. OpenAI receives live audio and messages used for responses; standalone Responses requests use `store: false`. OpenAI service data policies still apply. Demo appointment entries, including manually entered descriptions or Milo's conversation summaries, are stored in this app's localStorage namespaces, separated by Google account ID. They stay in the current browser and are not synchronized across devices. The journey reset clears its own sample booking; the main Appointments list remains until browser storage is cleared.

API endpoints accept matching loopback origins (localhost, 127.0.0.1 or ::1), with bounded bodies and local process rate limits. These are appropriate for this local prototype; public hosting needs durable rate limits, a privacy/retention review and clinical evaluation before use. This scope does not publish a site.

Live interviews have a visible message/body budget so the full history and later corrections fit within the request limits. Prepare a plan at the limit or start a fresh interview; history is not silently truncated. Voice closes near the budget and keeps final captions.

The demo is fixed; it does not interpret custom symptoms. Print/save PDF uses the browser, and the editable brief should be checked before export.

[90-second demo script](docs/demo-script.md) · [AI and resource disclosures](docs/ai-and-resources.md) · [Approved design](docs/superpowers/specs/2026-10-04-healthmate-design.md)

Voice booking accepts clear conversational English agreement such as sounds good, that works for me, go ahead, and please book it for me, including polite or combined replies. Literal yes or no is not required. Natural refusals clear the proposal; uncertainty, conditions and changed slots need clarification. The confirmation question includes the exact doctor/date/time; unrelated questions or stale replies cannot approve it. Actual account-backed model speech/tool timing remains unverified.
