import { defineConfig, devices } from "@playwright/test";

// E2E config. Targets a base URL (the deployed site by default, overridable via
// BASE_URL). On CI, GitHub Actions provides Chromium; locally you'd run
// `npx playwright install chromium` first. Records video + screenshot on
// failure so a red build comes with proof.
const BASE_URL = process.env.BASE_URL || "https://8s.rodeo";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Collapse CSS/framer-motion animations to instant (our CSS honors this) so
    // elements settle immediately and clicks aren't blocked waiting for motion.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
