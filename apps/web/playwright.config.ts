import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const windows = process.platform === "win32";
const pnpm = windows ? "pnpm.cmd" : "pnpm";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "../../.superpowers/playwright-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `${windows ? "mvnw.cmd" : "./mvnw"} spring-boot:test-run`,
      cwd: fileURLToPath(new URL("../../services/api", import.meta.url)),
      url: "http://127.0.0.1:8080/actuator/health",
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      command: `${pnpm} exec next dev --hostname 127.0.0.1`,
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      url: "http://127.0.0.1:3000",
      env: { FOODIE_API_ORIGIN: "http://127.0.0.1:8080" },
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
});
