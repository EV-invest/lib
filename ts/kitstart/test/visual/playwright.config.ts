import { defineConfig, devices } from "@playwright/test";

// Capture harness for the kitstart widget gallery. `dist/` is written by the
// gallery test on the host; this serves it and screenshots each page. Runner,
// browsers, fonts and the Tailwind engine are pinned by the flake — the same
// `visual` block as the kit's suite.
const PORT = 4322;

export default defineConfig({
  testDir: "./",
  testMatch: "gallery.spec.ts",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
    deviceScaleFactor: 1,
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    cwd: "dist",
    url: `http://localhost:${PORT}/manifest.json`,
    timeout: 30_000,
  },
});
