# SDD ledger — plan: docs/superpowers/plans/2026-10-04-healthmate-implementation.md
Execution: native, user approved plan and method.
Pre-flight: Tasks 1→2 share Message/CarePlan; contracts agree.
Pre-flight: Tasks 1→5 share SessionState/demo actions; contracts agree.
Pre-flight: Tasks 2→4 share session SDP response; contracts agree.
Pre-flight: Tasks 3→5 share screen navigation and avatar state; contracts agree.
Ruling: Work in the approved empty-project checkout on codex/healthmate rather than creating a worktree — spec explicitly selects this workspace — no pre-existing code is exposed to changes.
Tasks: 1 foundation; 2 private API; 3 shell; 4 voice; 5 journey; 6 review/delivery.
Task 1: complete (commits bb293c7..f0a6d6b, tests: npm test →    Duration  128ms (transform 46%, import 44%, tests 6%, worker 5%))
Task 2: complete (commits f0a6d6b..d4ffac9, tests: npm test →    Duration  170ms (transform 42%, import 42%, tests 13%, worker 3%))
Task 3: complete (commits d4ffac9..b2561c7, tests: npm run test:e2e -- tests/e2e/home.spec.ts →   2 passed (3.3s))
Task 4: complete (commits b2561c7..209289d, tests: npm test →    Duration  229ms (transform 37%, tests 37%, import 24%, worker 3%))
Task 5: complete (commits 209289d..b5dd060, tests: npm run test:e2e →   7 passed (8.0s))
Final review: fresh gpt-6-astra reviewer; 4 Important findings accepted by user effect: real local origin, navigation media lifecycle, urgent brief exports, conversation budget. No Critical or deferred Minor findings.
Final: Ruling: Actual account-backed audio remains unverified — no configured project key is available; mock tests prove lifecycle only — cost if wrong: account or browser compatibility failures may remain.
Final: Ruling: Clinical validity remains outside this prototype — present AI recommendations as unvalidated suggestions and test urgent presentation — cost if wrong: recommendations may be clinically incorrect.
Final: Ruling: Public deployment authentication and distributed limits remain outside local scope — no public deployment was requested — cost if wrong: this prototype cannot safely serve untrusted public traffic.
Final: Ruling: Real clinic availability and delivery remain synthetic — no clinic integration was requested and sample labels are visible — cost if wrong: no real appointment exists.
Final: fixed browser-facing origin validation — actual Next endpoint and normalized URL tests RED→GREEN; untrusted hosts rejected before upstream.
Final: fixed navigation microphone lifecycle — delayed permission and active voice browser tests RED→GREEN.
Final: fixed urgent edited brief exports — preserved corrections plus latest urgent guidance in screen/print/text, old sample clinician suppressed; browser test RED→GREEN.
Final: fixed interview capacity — visible budget, history retained, correction capacity reserved; browser and UTF-8 budget tests RED→GREEN.
Final verification: npm test 23/23; npm run test:e2e 12/12; lint/typecheck/build passed after the single fix pass.
Task 6: complete (commits b5dd060..650d570, tests: npm test →    Duration  278ms (transform 42%, tests 29%, import 25%, worker 3%))
Final: fixed mobile heading scroll and duplicate print UI discovered during final visual checks — both browser regressions RED→GREEN; final suite 23 unit/13 browser, build/lint/typecheck passed.
UI revision: user explicitly requests only Milo and a Talk to Milo button. Bounded adjustment of the existing avatar/voice flow; implement this exact requested design without another approval gate. Keep the completed care journey on /journey as an unlinked route; root becomes the minimal voice screen.
UI revision complete: minimal root avatar/one-button voice screen; 5 new browser checks observed RED→GREEN. Complete journey retained at /journey. Final checks: 23/23 unit, 16/16 browser, lint, typecheck and production build pass. Desktop/mobile minimal screenshots inspected.
Finish: keep codex/healthmate as the local deliverable; no remote is configured and no merge, push or deployment was requested.
Deferred minors: none.

Video revision: user supplied public/videos/milo.mp4 and requested speech playback with looping. Avatar now plays the native clip muted/inline during detected speech, bridges 250 ms gaps between words, pauses/rewinds during silence and falls back to the original still image if playback fails. Native browser playback/looping regression observed RED→GREEN. Final verification: 23 unit/17 browser checks plus lint, typecheck and build pass. Server configuration status now true; no account-backed voice claim made.

Account menu revision: user requested one top-right icon with Profile, Appointments and Records. Added a compact accessible dropdown and native dialog panels; current-session profile/transcripts stay in memory, and only validated synthetic bookings use the existing demo storage namespace. Selecting a panel cancels pending setup or gracefully ends voice before displaying the panel. Four new browser regressions observed RED→GREEN. Desktop/mobile screenshots inspected. Final checks: 23 unit/21 browser tests, lint, typecheck and production build pass.

Demo appointment revision: user requested a simple form plus ask-before-book voice behavior and booked entries in Appointments. Shared local demo booking validation accepts known clinicians, demo times and dates within the next 30 days. Responses functions prepare a specific slot and then book only after the exact slot question and fresh explicit user agreement; unrelated questions/refusal/stale replies fail. Function results are returned before continuing the delegated backend response. Only doctor/date/time are persisted. Menu shows booked entries; original `/journey` remains intact. Four browser checks and a delegated function unit check observed RED→GREEN. Review found two Important consent/storage issues; four unit regressions observed failing and then passing after fixes. Final verification: 28 unit/25 browser tests, lint, typecheck and build pass; mobile form/list screenshots inspected. Real OpenAI voice/tool execution remains unverified; unusual or non-English consent is conservatively rejected for clarification.

Description revision: user requested an appointment description so Milo can attach a summary. Added optional, trimmed, bounded text to the shared booking schema; descriptionless existing records remain compatible. Form and booking confirmation/list display it, and prepare_demo_appointment accepts a patient-reported summary with uncertainty/corrections preserved. Re-booking the same slot with a summary updates the existing entry; blank retries preserve it. Browser form/voice regressions plus duplicate-summary unit test observed RED→GREEN. Verified 29 unit/25 browser tests, lint, typecheck and build; screenshots refreshed. Appointment descriptions now persist locally with demo bookings, and data-handling docs reflect this.
