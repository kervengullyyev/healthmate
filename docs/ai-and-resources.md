# AI and resource disclosures

## AI used

- Codex assisted with requirements, design, code, tests, documentation and review for this prototype.
- OpenAI GPT Image generated Milo, the original transparent companion avatar. The exact prompt and generation record are in [avatar-generation.md](design/avatar-generation.md); the original alpha was preserved in `public/images/healthmate-avatar.png` (1254 × 1254 RGBA).
- Runtime voice is configured for `gpt-live-1` through Live WebRTC. Symptom interpretation and recommendations are delegated to the server-configured Responses model, default `gpt-6-luna`. Text interviews and structured plans also use that backend model.
- The synthetic demo is deterministic local content. It does not call an AI model or represent a real patient's history.

## Consulted sources

- [OpenAI GPT-Live-1 model documentation](https://developers.openai.com/api/docs/models/gpt-live-1), [Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Live delegation](https://developers.openai.com/api/docs/guides/live-delegation) and [Live conversations](https://developers.openai.com/api/docs/guides/live-conversations): model, session creation, delegated backend, caption events and graceful closing. Checked on 4 October 2026.
- [NHS headaches guidance](https://www.nhs.uk/symptoms/headaches/): consulted for the recurring-headache sample and examples requiring urgent evaluation. The prototype is not endorsed by the NHS; this source is not a validation of AI triage.
- [Next.js installation documentation](https://nextjs.org/docs/app/getting-started/installation) and bundled Next.js App Router documentation: framework setup and server/client separation.
- HackYeah SPORT & HEALTHCARE rules and challenge details provided in the planning conversation: informed the focus on accessible healthcare preparation. The app does not claim competition eligibility, clinical certification or guaranteed acceptance.

## Software and visual resources

Next.js, React, TypeScript, Zod, Lucide React, Vitest, Testing Library, ESLint and Playwright are declared with exact versions in `package.json` and the lockfile. Their package licences remain applicable. Icons come from Lucide. The interface loads DM Sans and Manrope through Google Fonts, with system-font fallback. No stock patient photographs or real clinician records are used.

## Limits and data handling

No real booking, payment, message to clinicians or other external action occurs. The generated plan is a suggestion, with uncertainty and unknown information shown. There is no app-side raw audio recording or health-data logging. Live transcripts and plans stay in memory in the app, while OpenAI processes the audio/text required for live operation; server Responses calls request `store: false`. Demo appointment entries persist in localStorage, including optional descriptions entered in the form or conversation summaries prepared by Milo. These descriptions may contain user-reported health information and remain until browser storage is cleared. No clinic receives this data. Public deployment, real clinic integration, clinical validation and authentication are outside this build.

The current avatar is the existing self-contained `einstein.svg` from the user's “Create Blender model for browser” chat, copied unchanged from `/Users/kerven/Desktop/untitled folder/einstein-chibi/einstein.svg` to `public/animations/einstein.svg`. It embeds independently rendered painted PNG layers, CSS transform animation and a SMIL mouth animation; it is not a live 3D renderer or an embedded video. Fragment URLs select `#wave`, `#speaking`, `#thinking` and `#idle`. The app uses wave during connection and speaking during audio output. Idle/listening and hidden/offscreen states use the existing exported neutral PNG, copied from `svg-export/cache/snapshot-idle-1.png`, including on the login page. Animated image documents unmount while resting or hidden, and the old Rive runtime dependency is removed. This revision made no new image generation or AI calls. The earlier Rive, WASM, generated mascot and WebM are retained as historical assets.
