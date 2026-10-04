# SQLite appointments

The user requested removal of the appointment “demo” wording and SQLite storage. Implement in this session, retaining Google authentication and fresh voice consent.

1. Create a server-only SQLite store at `data/appointments.sqlite`, configurable with `APPOINTMENTS_DB_PATH`. Store owner Google subject, doctor, date, time, description and creation time. Enforce a unique doctor/date/time reservation atomically. Repeated saves by the same owner preserve IDs and nonempty descriptions. Lists must return only the authenticated owner's records.
2. Add authenticated GET/POST `/api/appointments`, GET `/api/appointments/availability`, and POST `/api/appointments/import`. Validate origin, bounded bodies and appointment fields on writes. Import the current account's earlier browser records without deleting the originals; protect other accounts' reservations. Exclude the database and test databases from Git.
3. Use shared asynchronous client calls for the form, Appointments menu and Milo tools. Choose only available server slots, retain exact-slot fresh consent, await persistence before reporting success, deduplicate in-flight tool calls, and ignore outputs after a voice session ends.
4. Remove “demo” from appointment labels and dialogue. Use “Appointment booked” after successful database storage. Do not claim a clinic was notified; no external clinic connection is supplied. Keep the separate fixed guided interview clearly identified.
5. Test disk persistence, account isolation, reservation conflicts, retries, origin/auth rejection, legacy import, actual form/API persistence across fresh browser contexts, voice refusal/consent and asynchronous session cleanup. Use separate temporary SQLite databases for all tests. Review, build, deploy through the existing tunnel, and verify the live UI.

Review focus: account ID must come from the verified session; concurrent requests must not double-book; old storage must survive migration failures; failed saves must not claim success; closing voice must prevent late tool responses reaching a new session.
