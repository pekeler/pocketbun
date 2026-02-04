// PocketBun-only: Playwright configuration for end-to-end tests.

import { defineConfig } from "@playwright/test";

const port = Number.parseInt(process.env.POCKETBUN_E2E_PORT ?? "8091", 10);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.pw.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
  },
  webServer: {
    command: "bun run scripts/e2e_server.ts",
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      POCKETBUN_E2E_PORT: String(port),
    },
  },
});
