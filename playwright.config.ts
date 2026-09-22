import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1512, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node apps/api/dist/server.js",
      url: "http://127.0.0.1:3101/api/v1/health",
      reuseExistingServer: false,
      env: {
        API_PORT: "3101",
        API_HOST: "127.0.0.1",
        WEB_PORT: "5174",
        WEB_ORIGIN: "http://127.0.0.1:5174",
        DATA_MODE: "synthetic",
        DATABASE_PATH: ":memory:",
        AUTH_CONFIG_PATH: "",
        AUTH_SECURE_COOKIE: "false",
      },
    },
    {
      command: "npm run dev --workspace @portfolio-atlas/web",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { API_PORT: "3101", WEB_PORT: "5174" },
    },
  ],
});
