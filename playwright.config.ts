import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: "bun run start:api",
      url: "http://127.0.0.1:4174/internal/bootstrap",
      env: {
        API_HOST: "127.0.0.1",
        API_PORT: "4174",
        SITE_ORIGIN: "https://example.test",
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      },
      reuseExistingServer: false,
    },
    {
      command: "bun run start:web",
      url: "http://127.0.0.1:4173",
      env: {
        HOST: "127.0.0.1",
        PORT: "4173",
        ORIGIN: "http://127.0.0.1:4173",
        API_INTERNAL_URL: "http://127.0.0.1:4174",
      },
      reuseExistingServer: false,
    },
  ],
});
