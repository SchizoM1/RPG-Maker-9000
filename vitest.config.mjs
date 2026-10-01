// Unit tests only; tests/e2e is run by Playwright (npm run test:e2e).
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: { include: ["tests/unit/**/*.test.js"] }
});
