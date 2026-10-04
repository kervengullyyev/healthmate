# Verification — 4 October 2026

Verified locally on Node.js 22, macOS and Chromium.

- Unit suite: 23/23 passing across domain validation, session isolation, API boundaries and fake WebRTC lifecycle.
- Browser suite: 21/21 passing, including the five-screen demo, editable brief, print media, local demo booking persistence, failed plan regeneration, urgent mobile routing, keyboard entry, real local API origin validation, navigation during microphone acquisition, active voice closing, urgent exports and the interview budget.
- Production build, ESLint and TypeScript: passing.
- Visual inspection: desktop and 390-pixel mobile home, conversation, care plan, appointments and doctor brief. Avatar transparency, overflow, focus and text contrast checked.
- Live account-backed microphone/audio, interruption handling and real captions: unverified in this change. The server now reports a configured project key, but these checks used mocked live audio and upstream requests. Mocked tests verify the protocol and resource lifecycle, not actual model audio.

The app runs locally at http://127.0.0.1:3000. It has not been deployed or connected to real clinics.

Saved visual evidence: [desktop home](screenshots/home-desktop.png), [mobile doctor brief](screenshots/brief-mobile.png), [focused print layout](screenshots/brief-print.png). These contain only synthetic demo data.

Independent review found four Important issues, all fixed with regressions observed failing before implementation: local origin rejection; navigation leaving microphone sessions active; urgent plans exporting outdated advice; and long interviews exhausting plan request capacity. No Critical findings or deferred Minor findings. The reviewer made no paid API calls.

Final visual regressions also covered: mobile navigation resets to the new screen heading without losing keyboard focus, and print suppresses the duplicate on-screen guidance panel. Both regressions were observed failing, then passing after fixes.

Latest user revision: the main screen now contains only Milo and one voice button. Five browser checks verify minimal content, mobile fit, start/end, cancellation of late microphone acquisition and configuration errors. The complete journey remains at `/journey` and retains its regression suite. [Minimal mobile screen](screenshots/home-mobile.png).

Speaking video: actual Chromium playback of `/videos/milo.mp4` verified with mocked live audio amplitude, including native looping at the clip boundary, muted inline playback, and pause/return to the still avatar during silence. The supplied clip is 10.005 seconds, 720 × 1280, H.264/AAC; its own audio remains muted.

Account menu revision: top-right icon opens Profile, Appointments and Records. Four new browser checks cover session-only name editing, mobile sample booking, empty/current conversation records, stopping live media before opening a panel, keyboard navigation, Escape/focus return and outside-click dismissal. Inspected the desktop menu/profile and mobile appointment panel; refreshed home screenshots. [Account menu](screenshots/account-menu.png).
