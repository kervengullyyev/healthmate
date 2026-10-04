# User and appointment storage

The appointment form and Milo save reservations and summaries in SQLite on the server. The default file is `/Users/kerven/Desktop/HealthMate/data/appointments.sqlite`; set `APPOINTMENTS_DB_PATH` in `.env.local` to use another server path and restart the web service. The file is created when the first authenticated appointment request reaches the server.

The database lives outside the Next.js build directory, survives production rebuilds and server restarts, and is excluded from Git. Its folder and file use private local permissions. Moving this deployment to another computer requires transferring the database securely; Git alone does not transfer bookings.

The same database contains a `users` table keyed by the verified Google subject. It stores Google name, email and profile-image URL, plus `created_at` and `last_seen_at` timestamps. Google sign-in creates or updates the profile; opening a protected platform page or using an authenticated API also adds existing sessions and updates their last-seen timestamp. Session reads fill missing fields without replacing a newer sign-in profile. Repeated use keeps one row and preserves the first-seen timestamp. Passwords, OAuth access/refresh tokens and session cookies are not stored in SQLite. The Profile panel's temporary name edits still last only for the current page session.

Existing appointment owners receive identity-only rows during the schema upgrade, leaving their bookings intact. Their name, email and image are filled when they next use a verified session. Appointment `owner_id` joins to `users.id`; the Google subject remains the ownership boundary. User profiles have no public listing API. Include the whole database in backups to preserve both users and bookings.

All appointment APIs require Google authentication. Records are owned by the verified Google subject from the server session. Client-supplied identity is checked only to reject a stale account action; it never determines the stored owner. Availability exposes occupied doctor/date/time values without patient identity or summaries. Writes validate the exact origin, bounded JSON and scheduling fields. Transactions and a unique doctor/date/time key prevent conflicting reservations; a repeated save by the same owner keeps its ID and does not erase a summary with an empty retry.

Milo first prepares an available slot, asks the exact doctor/date/time question, and waits for fresh conversational agreement. The tool awaits the database result before claiming success. Refusal, uncertainty, changed slots, stale consent, failed writes and unavailable slots cannot produce a success confirmation. Ending a voice session aborts its pending requests and prevents late results reaching a restarted call.

One clear agreement is sufficient, including “yes,” “yes, I confirm,” “I agree,” “confirmed,” “sounds good,” or “go ahead.” Milo is instructed to save the prepared appointment immediately after that reply, without asking again or preparing the same slot again. Conditions, changed details or refusal still require clarification. End an existing voice call and start a new one after deploying instruction changes so the new session receives them.

The Appointments menu loads server records across devices. On first use, the current account's earlier browser records are imported as one transaction. Original browser entries are preserved. A conflicting or failed import produces a notice in Appointments while server listing and new bookings remain available. Anonymous legacy records are never assigned automatically to a Google account. The separate fixed guided journey retains its illustrative booking in its original browser namespace.

These are reservations in ontuc's database. No external clinic is notified, and the directory still contains the original example doctors. External clinic delivery and real clinic inventory require a clinic connection and supplied doctor data.

## Backup

SQLite uses WAL mode, so copying only the main file while the service is running can omit recent writes. Use SQLite's backup command on the server instead:

```sh
mkdir -p /Users/kerven/Library/Backups/ontuc
chmod 700 /Users/kerven/Library/Backups/ontuc
umask 077
sqlite3 /Users/kerven/Desktop/HealthMate/data/appointments.sqlite ".backup '/Users/kerven/Library/Backups/ontuc/appointments.sqlite'"
```

For a different `APPOINTMENTS_DB_PATH`, use that source path. Keep backups private. Stop the web service before restoring or replacing the database, preserve the current files first, and restart afterwards. Avoid uploading the database to GitHub.

Node22.16 or newer is required for the built-in SQLite API and timeout option; see [Node SQLite documentation](https://nodejs.org/download/release/v22.17.0/docs/api/sqlite.html). Automated tests use separate temporary databases and fake identities, never this production database.
