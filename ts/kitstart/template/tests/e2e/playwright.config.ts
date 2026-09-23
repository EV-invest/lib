import { defineConfig, devices } from "@playwright/test";
import { BREAKPOINTS } from "@evinvest/kitstart/testing/e2e";

// The standalone server under test, never `next dev`. Baselines are Linux's
// (CI's); elsewhere the pixel comparison is skipped.
const PORT = Number(process.env["E2E_PORT"] ?? 59089);
const linux = process.platform === "linux";

export default defineConfig({
  testDir: ".",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  ignoreSnapshots: !linux,
  retries: 0,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled", stylePath: "./screenshot-section.css" } },
  use: { baseURL: `http://localhost:${PORT}`, deviceScaleFactor: 1, colorScheme: "light", locale: "fr-FR" },
  projects: BREAKPOINTS.map(b => ({ name: b.name, use: { ...devices["Desktop Chrome"], viewport: b.viewport } })),
  webServer: {
    command: "node .next/standalone/server.js",
    cwd: "../..",
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    // The prod server refuses to boot without these (instrumentation.ts); on
    // loopback the one hop is the runner itself.
    env: { PORT: String(PORT), HOSTNAME: "127.0.0.1", LEADS_DB_PATH: `/tmp/brand-e2e-${PORT}/leads.db`, TRUSTED_PROXY: "xff:1" },
  },
});
