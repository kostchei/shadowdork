import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level smoke tests, separate from the pure-logic vitest suite in
 * tests/. These boot the real game in a real (non-hidden) browser tab, so
 * Phaser's RAF loop and keyboard/pointer input behave normally — unlike the
 * Claude Code preview pane, which reports the tab as hidden and requires
 * manually pumping frames (see project memory / CLAUDE.md notes on that).
 *
 * Runs against `npm run dev` so the DEV-only `window.__game` debug handle
 * (src/game/main.ts) is available for driving and inspecting scene state.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : "html",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
