# ontuc.com Cloudflare Tunnel

The hackathon app runs in production mode on this Mac at `127.0.0.1:3000`. Cloudflare Tunnel publishes it at `https://ontuc.com` without opening an inbound router port. The Mac must remain awake, online and logged in; these user services start again at login and restart after process failures.

## Configuration

- Tunnel name: `healthmate-ontuc`
- Tunnel ID: `ba48d3d5-a52b-4e06-8dcd-13aa72e1cfdc`
- Private tunnel configuration: `/Users/kerven/.cloudflared/healthmate-ontuc.yml`
- Private credentials: `/Users/kerven/.cloudflared/ba48d3d5-a52b-4e06-8dcd-13aa72e1cfdc.json`
- App service: `/Users/kerven/Library/LaunchAgents/com.healthmate.web.plist`
- Tunnel service: `/Users/kerven/Library/LaunchAgents/com.healthmate.tunnel.plist`
- Logs: `/Users/kerven/Library/Logs/HealthMate/`

Only `ontuc.com` is routed to this tunnel. Unknown hostnames return 404. The existing mail records and unrelated Cloudflare tunnel are preserved. The apex parking A record was replaced with a proxied CNAME to the tunnel UUID under `cfargotunnel.com`.

The app's ignored `.env.local` uses:

```dotenv
AUTH_URL=https://ontuc.com
APP_ORIGIN=https://ontuc.com
```

Keep the existing `AUTH_SECRET`. Add `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `OPENAI_API_KEY` privately to enable Google login and live voice. Register this exact Google OAuth redirect URI:

```text
https://ontuc.com/api/auth/callback/google
```

See [Google setup](google-sso-setup.md). Missing Google credentials keep the platform behind its setup/login screen. Secrets and Cloudflare credentials stay outside Git.

## Restart after changing credentials

```sh
launchctl kickstart -k gui/$(id -u)/com.healthmate.web
```

## Deploy a code update

Run in `/Users/kerven/Desktop/HealthMate`:

```sh
npm ci
npm test
npm run lint
npm run typecheck
launchctl bootout gui/$(id -u) /Users/kerven/Library/LaunchAgents/com.healthmate.web.plist
npm run build
launchctl bootstrap gui/$(id -u) /Users/kerven/Library/LaunchAgents/com.healthmate.web.plist
```

Stopping the web service before replacing its build avoids serving files from different builds. If the build fails, fix it and rebuild before restarting. DNS and the tunnel service do not need changing for a code update.

## Check or stop the services

```sh
launchctl print gui/$(id -u)/com.healthmate.web
launchctl print gui/$(id -u)/com.healthmate.tunnel
curl -I https://ontuc.com/login
```

To take the site offline:

```sh
launchctl bootout gui/$(id -u) /Users/kerven/Library/LaunchAgents/com.healthmate.tunnel.plist
launchctl bootout gui/$(id -u) /Users/kerven/Library/LaunchAgents/com.healthmate.web.plist
```

To bring it back, run `launchctl bootstrap gui/$(id -u)` with each of those plist paths. Keep the plist files if the site should start again on the next login; remove only these two files to disable future automatic startup.

Cloudflare references: [locally managed tunnel setup](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/), [macOS services](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/macos/).
