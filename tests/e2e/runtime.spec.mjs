// Exports the e2e project and plays the export in Chromium, over http and file://.
import { test, expect, chromium } from "@playwright/test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { deployProject } = require("../../electron/lib/deploy.js");
const { startStaticServer } = require("../../electron/lib/staticServer.js");

const PROJECT = path.resolve("tests/.tmp/e2e-project");
const OUT = path.resolve("tests/.tmp/e2e-export");
let browser;

test.beforeAll(async () => {
    const report = await deployProject(PROJECT, { outDir: OUT, excludeUnused: true, bundleData: true, zip: true, overwrite: true });
    expect(report.files).toBeGreaterThan(0);
    browser = await chromium.launch();
});

test.afterAll(async () => {
    await browser.close();
});

const sceneName = page => page.evaluate(() => (SceneManager._scene ? SceneManager._scene.constructor.name : null));

async function playToMap(page) {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => m.type() === "error" && errors.push(m.text()));
    await expect.poll(() => sceneName(page), { timeout: 20000 }).toBe("Scene_Title");
    // Wait for the command window to open, then choose New Game.
    await expect.poll(() => page.evaluate(() => SceneManager._scene._commandWindow.isOpen()), { timeout: 10000 }).toBe(true);
    await page.evaluate(() => SceneManager._scene._commandWindow.selectSymbol("newGame"));
    await page.keyboard.down("Enter");
    await page.waitForTimeout(100);
    await page.keyboard.up("Enter");
    await expect.poll(() => sceneName(page), { timeout: 20000 }).toBe("Scene_Map");
    await expect.poll(() => page.evaluate(() => $gameMap.mapId())).toBe(1);
    return errors;
}

test("export contains the bundled data and a zip", () => {
    expect(fs.existsSync(path.join(OUT, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(OUT, "js/data.js"))).toBe(true);
    expect(fs.readFileSync(path.join(OUT, "index.html"), "utf8")).toContain("js/data.js");
    expect(fs.existsSync(OUT + ".zip")).toBe(true);
    expect(fs.existsSync(path.join(OUT, "save"))).toBe(false);
});

test("exported game runs over http", async () => {
    const { server, url } = await startStaticServer(OUT);
    const page = await browser.newPage({ viewport: { width: 816, height: 624 } });
    try {
        await page.goto(url + "index.html");
        expect(await playToMap(page)).toEqual([]);
        // Over http the Effekseer runtime loads and MZ animations render.
        expect(await page.evaluate(() => EffekseerRenderer.isReady())).toBe(true);
        await page.evaluate(() => $gameTemp.requestAnimation([$gamePlayer], 66));
        await expect.poll(() => page.evaluate(() => SceneManager._scene._spriteset._animationSprites.some(s => !!s._handle))).toBe(true);
    } finally {
        await page.close();
        server.close();
    }
});

test("exported game runs from file://", async () => {
    const page = await browser.newPage({ viewport: { width: 816, height: 624 } });
    try {
        await page.goto(pathToFileURL(path.join(OUT, "index.html")).href);
        expect(await playToMap(page)).toEqual([]);
    } finally {
        await page.close();
    }
});
