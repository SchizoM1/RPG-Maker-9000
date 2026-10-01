// Serves a project, opens it in Chromium, reports errors and screenshots.
// Usage: node tools/smoke.mjs <projectDir> [outPrefix] [script.json]
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const { startStaticServer } = require("../electron/lib/staticServer.js");

const dir = path.resolve(process.argv[2] || "tests/.tmp/sample");
const out = process.argv[3] || "tests/.tmp/shot";
const steps = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], "utf8")) : [{ wait: 2500 }, { shot: "title" }];
const query = process.env.QUERY || "?test";

const { server, url } = await startStaticServer(dir);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 624 } });
const errors = [];
page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.type() + ": " + msg.text());
});
page.on("pageerror", err => errors.push("pageerror: " + err.stack));
await page.goto(url + "index.html" + query);
for (const step of steps) {
    if (step.wait) await page.waitForTimeout(step.wait);
    if (step.key) {
        for (let i = 0; i < (step.times || 1); i++) {
            await page.keyboard.down(step.key);
            await page.waitForTimeout(step.hold || 80);
            await page.keyboard.up(step.key);
            await page.waitForTimeout(step.gap || 120);
        }
    }
    if (step.eval) console.log("eval:", JSON.stringify(await page.evaluate(step.eval)));
    if (step.shot) await page.screenshot({ path: `${out}-${step.shot}.png` });
}
console.log(errors.length ? errors.join("\n") : "no console errors");
await browser.close();
server.close();
