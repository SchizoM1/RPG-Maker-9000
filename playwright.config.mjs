// Playwright: editor (Electron) and exported-game (Chromium) end-to-end tests.
import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "tests/e2e",
    testMatch: "*.spec.mjs",
    globalSetup: "./tests/e2e/global-setup.mjs",
    workers: 1,
    timeout: 90000,
    reporter: [["list"]],
    outputDir: "tests/.tmp/e2e-results"
});
