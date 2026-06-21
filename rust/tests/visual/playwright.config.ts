import { defineConfig, devices } from "@playwright/test";

// Visual-regression config for the uikit gallery. The static board is generated
// by `npm run gen` (cargo example) into ./dist; this just serves that dir and
// screenshots one primitive per page. Browsers come from nixpkgs (flake's
// PLAYWRIGHT_BROWSERS_PATH), pinned to the same revision as @playwright/test,
// so screenshots render identically across machines on this flake.
const PORT = 4321;

export default defineConfig({
  testDir: "./",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // On failure: minimal reporter prints only expected/actual/diff image paths
  // (a visual failure is an image mismatch, not a code bug), plus the HTML
  // reporter's side-by-side slider. Reopen with `playwright show-report`.
  reporter: process.env.CI
    ? "github"
    : [["./visual-reporter.ts"], ["html", { open: "on-failure" }]],

  // A pixel diff above this fraction fails the test. Small allowance absorbs
  // sub-pixel font rasterisation jitter without masking real layout changes.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // dist/ must already be generated (npm run gen). This only serves it.
  webServer: {
    command: "python3 -m http.server " + PORT,
    cwd: "dist",
    url: `http://localhost:${PORT}/manifest.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
