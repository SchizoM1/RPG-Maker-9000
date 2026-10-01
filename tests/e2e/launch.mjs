// Launches the editor under Playwright (Electron) and runs a scripted check.
import { _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

export async function launchEditor(args = []) {
    const userData = path.resolve("tests/.tmp/userdata");
    fs.mkdirSync(userData, { recursive: true });
    const app = await electron.launch({
        args: [path.resolve("."), "--user-data-dir=" + userData, ...args],
        env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" }
    });
    const win = await app.firstWindow();
    const logs = [];
    win.on("console", m => logs.push(m.type() + ": " + m.text()));
    win.on("pageerror", e => logs.push("pageerror: " + e.stack));
    // Quits without the unsaved-changes prompt (tests may leave the project dirty).
    const forceClose = async () => {
        await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
        await app.close().catch(() => {});
    };
    // Polls until the project and its first map are open (CSP forbids waitForFunction).
    const waitForProject = async () => {
        for (let i = 0; i < 120; i++) {
            if (await win.evaluate(() => !!(window.__app && window.__app.currentMap && window.__app.currentMap()))) return;
            await win.waitForTimeout(250);
        }
        throw new Error("Project did not open");
    };
    // Console errors and page exceptions, minus Electron's dev-mode noise.
    const errors = () => logs.filter(l => (l.startsWith("error") || l.startsWith("pageerror")) && !l.includes("Security Warning"));
    return { app, win, logs, forceClose, waitForProject, errors };
}
