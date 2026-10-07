import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:3001",
    actionTimeout: 5000,
    trace: "retain-on-failure",
    // Use the native GPU on macOS: SwiftShader's software feathering can
    // saturate the host and starve input when multiple avatars are visible.
    launchOptions: process.platform === "darwin" ? { args: ["--use-angle=metal"] } : {},
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
      OPENAI_API_KEY: "",
      APPOINTMENTS_DB_PATH: join(process.cwd(), ".test-data", `${randomUUID()}.sqlite`),
    },
    timeout: 120000,
  },
});
