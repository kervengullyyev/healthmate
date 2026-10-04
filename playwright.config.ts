import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3001",
    actionTimeout: 5000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      AUTH_SECRET: "healthmate-playwright-session-secret-for-tests-only",
      AUTH_URL: "http://127.0.0.1:3001",
      AUTH_GOOGLE_ID: "test-google-client-id",
      AUTH_GOOGLE_SECRET: "test-google-client-secret",
    },
    timeout: 120000,
  },
});
