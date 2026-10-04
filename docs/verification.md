# Verification — 4 October 2026

Verified locally on Node.js 22, macOS and Chromium.

- Unit suite: 23/23 passing across domain validation, session isolation, API boundaries and fake WebRTC lifecycle.
- Browser suite: 13/13 passing, including the five-screen demo, editable brief, print media, local demo booking persistence, failed plan regeneration, urgent mobile routing, keyboard entry, real local API origin validation, navigation during microphone acquisition, active voice closing, urgent exports and the interview budget.
- Production build, ESLint and TypeScript: passing.
- Visual inspection: desktop and 390-pixel mobile home, conversation, care plan, appointments and doctor brief. Avatar transparency, overflow, focus and text contrast checked.
- Live account-backed microphone/audio, interruption handling and real captions: unverified pending a configured project API key. Mocked tests verify the protocol and resource lifecycle, not actual model audio.

The app runs locally at http://127.0.0.1:3000. It has not been deployed or connected to real clinics.

Saved visual evidence: [desktop home](screenshots/home-desktop.png), [mobile doctor brief](screenshots/brief-mobile.png), [focused print layout](screenshots/brief-print.png). These contain only synthetic demo data.

Independent review found four Important issues, all fixed with regressions observed failing before implementation: local origin rejection; navigation leaving microphone sessions active; urgent plans exporting outdated advice; and long interviews exhausting plan request capacity. No Critical findings or deferred Minor findings. The reviewer made no paid API calls.

Final visual regressions also covered: mobile navigation resets to the new screen heading without losing keyboard focus, and print suppresses the duplicate on-screen guidance panel. Both regressions were observed failing, then passing after fixes.
