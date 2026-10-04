# Verification — 4 October 2026

Verified locally on Node.js 22, macOS and Chromium.

- Unit suite: 19/19 passing across domain validation, session isolation, API boundaries and fake WebRTC lifecycle.
- Browser suite: 7/7 passing, including the five-screen demo, editable brief, print media, local demo booking persistence, failed plan regeneration, urgent mobile routing and keyboard entry.
- Production build, ESLint and TypeScript: passing.
- Visual inspection: desktop and 390-pixel mobile home, conversation, care plan, appointments and doctor brief. Avatar transparency, overflow, focus and text contrast checked.
- Live account-backed microphone/audio, interruption handling and real captions: unverified pending a configured project API key. Mocked tests verify the protocol and resource lifecycle, not actual model audio.

The app runs locally at http://127.0.0.1:3000. It has not been deployed or connected to real clinics.
