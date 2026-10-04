# HealthMate

A hackathon prototype that turns a voice or text conversation into a suggested care plan and an editable doctor brief. Milo, the generated companion avatar, accompanies the five-screen journey. Clinicians and appointment slots are synthetic samples.

## Run locally

Use Node.js 22 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open [HealthMate](http://127.0.0.1:3000). **Try a demo** works without an API key and walks through a fixed, clearly labelled synthetic headache scenario. The demo makes no AI requests; its fonts use Google Fonts with local system fallbacks.

For live voice and text, put a project `OPENAI_API_KEY` in `.env.local`. Keep it out of chat and version control. Restart the server after changing environment values. The API key stays on the server and has no `NEXT_PUBLIC_` prefix.

```dotenv
OPENAI_API_KEY=your-project-key
OPENAI_BACKEND_MODEL=gpt-6-luna
OPENAI_LIVE_VOICE=marin
```

The voice model is exactly **gpt-live-1**, using the Live WebRTC API with Responses delegation. The backend model and voice are server-configurable. The project/account must have access to these models. Microphone access needs localhost or HTTPS and browser permission; remote audio may require the **Enable audio** button if playback is blocked. End a voice session before generating its plan, so final captions can arrive.

## What works

- Live voice with captions, mute, playback fallback, graceful end and resource cleanup.
- Text interview and schema-validated suggested care plans.
- Credential-free, deterministic demo, with separate session state.
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

On 4 October 2026: 19 unit tests and 7 browser tests passed; lint, typecheck and production build passed. Browser checks cover the complete sample journey, edit preservation after upstream errors, urgent routing, mode isolation, mobile widths and keyboard access. Live transport tests use fake media and upstream calls. Actual account-backed voice/audio, interruptions and captions remain **unverified** because a configured project key was not available during these checks. See [verification evidence](docs/verification.md).

## Prototype boundaries

HealthMate is an adult health companion, not a clinician or a clinically validated triage service. It does not diagnose or prescribe. AI output can be wrong and needs human review. Unknown history stays unknown. Possible urgent symptoms trigger professional-help guidance, not routine sample booking.

There are no real appointments, external clinic contacts, authentication, uploads, analytics or app-side audio recording. Live transcripts, plans and edits stay in browser memory; refreshing loses them. OpenAI receives live audio and messages used for responses; standalone Responses requests use `store: false`. OpenAI service data policies still apply. Only a synthetic demo booking is stored in this app's localStorage namespace. Reset clears it.

API endpoints use origin checks, bounded bodies and local process rate limits. These are appropriate for this local prototype; public hosting needs authentication, durable rate limits, a privacy/retention review and clinical evaluation before use. This scope does not publish a site.

The demo is fixed; it does not interpret custom symptoms. Print/save PDF uses the browser, and the editable brief should be checked before export.

[90-second demo script](docs/demo-script.md) · [AI and resource disclosures](docs/ai-and-resources.md) · [Approved design](docs/superpowers/specs/2026-10-04-healthmate-design.md)
