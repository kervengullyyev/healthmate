# Google sign-in setup

ontuc now requires Google sign-in before opening Milo, the appointment form or the care journey. The AI endpoints also require a valid session. The integration is ready; create a Google OAuth client to enable the login button.

## 1. Create the OAuth client

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select or create a project.
2. Open **Google Auth Platform**. Set the app name to **ontuc**, add your support email and complete the branding/contact details.
3. Set the audience to **External** for personal Google accounts. While the app is in Testing, add the Google accounts you will use for the hackathon as test users.
4. Under **Clients**, create an OAuth client with application type **Web application**.
5. Add this exact **Authorized redirect URI**:

   ```text
   http://127.0.0.1:3000/api/auth/callback/google
   ```

6. Save the client ID and client secret privately. This is a server OAuth flow; an authorized JavaScript origin is not required.

Google requires the callback URI to match the registered value. Use `127.0.0.1` consistently when opening this local app; `localhost` is a different host. See [Google's web-server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server) and the [Auth.js Google provider guide](https://authjs.dev/getting-started/providers/google).

## 2. Configure ontuc

Edit `.env.local` in the project folder. Preserve your existing `OPENAI_API_KEY` and other settings. Add the credentials below, replacing the placeholders:

```dotenv
AUTH_URL=http://127.0.0.1:3000
AUTH_SECRET=your-private-random-session-secret
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

A random `AUTH_SECRET` has already been generated in this working copy. Keep that existing value. On a fresh checkout, generate one with:

```sh
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

These values stay on the server. Do not use a `NEXT_PUBLIC_` prefix, put secrets in chat or commit `.env.local`. The [Auth.js installation guide](https://authjs.dev/getting-started/installation) describes its session-secret configuration.

Stop and restart the development server after configuring the credentials:

```sh
npm run dev
```

Open [ontuc](http://127.0.0.1:3000/) and select **Continue with Google**. The account menu shows your Google name and email, along with **Sign out**. If Google reports `redirect_uri_mismatch`, check the callback above character for character and confirm `AUTH_URL` uses the same host and port.

## 3. Test the configured login

- Sign in with a configured test user. Open Profile and check the displayed account.
- Book a synthetic appointment and confirm it appears in Appointments after refreshing.
- Start a conversation, then sign out. The microphone session should end and the login screen should appear. Browser Back must not reopen an authenticated platform page.
- Sign in with a different account. It should have its own empty appointment list.
- Open `/appointments/new` while signed out. After successful Google login, you should return to that form.

Automated checks exercise the Google authorization redirect and encrypted test sessions. A real Google callback and account login still need this credential setup and manual check.

## Scope

Sign-in requests only Google identity scopes: `openid`, `email`, and `profile`. It does not grant Calendar or Gmail access. Sessions use encrypted, HttpOnly cookies with a 24-hour lifetime.

Appointments remain synthetic entries stored in the current browser, separated by Google account ID; they are not synchronized between devices or sent to a clinic. Earlier anonymous entries remain in browser storage and are not assigned to a signed-in account. Conversation records stay in memory and clear on refresh, sign-out or account change.

For a future HTTPS deployment, create the corresponding HTTPS callback and update `AUTH_URL`. The current AI endpoint origin/rate-limit settings are designed for the local prototype; deployment is outside this change.
