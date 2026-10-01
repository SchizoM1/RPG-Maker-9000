// Creates a fresh starter project for the e2e tests (RTP folders symlinked).
// Runs in a child process: Playwright's loader rewrites dynamic import().
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export default async function globalSetup() {
    fs.rmSync(path.resolve("tests/.tmp/e2e-export"), { recursive: true, force: true });
    fs.rmSync(path.resolve("tests/.tmp/e2e-export.zip"), { force: true });
    execFileSync(process.execPath, ["tools/make-project.mjs", "tests/.tmp/e2e-project", "E2E Game", "--force"], { stdio: "inherit" });
}
