// Editor end-to-end tests (Electron).
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { launchEditor } from "./launch.mjs";

const PROJECT = path.resolve("tests/.tmp/e2e-project");
const D = id => `.dialog[data-dialog="${id}"]`;
let editor;

test.beforeEach(async () => {
    editor = await launchEditor(["--project", PROJECT]);
    await editor.waitForProject();
});

test.afterEach(async () => {
    await editor.forceClose();
});

test("every database tab and tool dialog opens without errors", async () => {
    const { win, errors } = editor;
    await win.keyboard.press("F9");
    await win.waitForSelector(D("database") + " .tabbar .tab");
    const tabs = await win.$$eval(D("database") + " .tabbar .tab", els => els.map(e => e.dataset.tab));
    expect(tabs.length).toBe(16);
    for (const id of tabs) {
        await win.locator(`${D("database")} .tab[data-tab="${id}"]`).dispatchEvent("mousedown");
        await expect(win.locator(D("database") + " .tab-content .hint", { hasText: "Loading" })).toHaveCount(0);
    }
    await win.locator(D("database") + ' button[data-button="cancel"]').click();
    for (const key of ["F10", "F11", "Control+f", "F1"]) {
        await win.keyboard.press(key);
        await win.waitForSelector(".dialog");
        await win.keyboard.press("Escape");
        await expect(win.locator(".dialog")).toHaveCount(0);
    }
    for (const action of ["resourceManager", "deploy"]) {
        await win.evaluate(id => { window.__app.actions.run(id); }, action);
        await win.waitForSelector(".dialog");
        await win.keyboard.press("Escape");
        await expect(win.locator(".dialog")).toHaveCount(0);
    }
    expect(errors()).toEqual([]);
});

test("paints autotiles, undoes, redoes and saves", async () => {
    const { win, errors } = editor;
    const pal = await win.locator(".palette-scroll canvas").boundingBox();
    const tile = pal.width / 8;
    await win.mouse.click(pal.x + tile * 1.5, pal.y + tile * 2.5);
    const view = await win.locator(".mapview").boundingBox();
    await win.keyboard.press("r");
    await win.mouse.move(view.x + 48 * 2 + 10, view.y + 48 * 2 + 10);
    await win.mouse.down();
    await win.mouse.move(view.x + 48 * 5 + 10, view.y + 48 * 4 + 10);
    await win.mouse.up();
    const cell = () => win.evaluate(() => {
        const m = window.__app.currentMap();
        return m.data[(0 * m.height + 3) * m.width + 3];
    });
    const painted = await cell();
    expect(painted).toBeGreaterThanOrEqual(2048);
    await win.keyboard.press("Control+z");
    expect(await cell()).not.toBe(painted);
    await win.keyboard.press("Control+y");
    expect(await cell()).toBe(painted);
    await win.keyboard.press("Control+s");
    await expect.poll(() => win.evaluate(() => window.__app.store.isDirty())).toBe(false);
    const map = JSON.parse(fs.readFileSync(path.join(PROJECT, "data/Map001.json"), "utf8"));
    expect(map.data[3 * map.width + 3]).toBe(painted);
    // The save backed up the previous data first.
    const backups = fs.readdirSync(path.join(PROJECT, "backups"));
    expect(backups.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(PROJECT, "backups", backups[0], "data", "Map001.json"))).toBe(true);
    expect(errors()).toEqual([]);
});

test("database edits are applied and saved", async () => {
    const { win, errors } = editor;
    await win.keyboard.press("F9");
    await win.waitForSelector(D("database") + " .db-form input");
    await win.locator(D("database") + " .db-form input").first().fill("Hero Renamed");
    await win.locator(D("database") + ' button[data-button="ok"]').click();
    expect(await win.evaluate(() => window.__app.store.data.Actors[1].name)).toBe("Hero Renamed");
    await win.keyboard.press("Control+z");
    expect(await win.evaluate(() => window.__app.store.data.Actors[1].name)).not.toBe("Hero Renamed");
    await win.keyboard.press("Control+y");
    await win.keyboard.press("Control+s");
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(PROJECT, "data/Actors.json"), "utf8"))[1].name).toBe("Hero Renamed");
    expect(errors()).toEqual([]);
});

test("plugin manager enables a plugin and edits its parameters", async () => {
    const { win, errors } = editor;
    await win.keyboard.press("F10");
    await win.waitForSelector(D("plugin-manager"));
    await win.locator(D("plugin-manager") + " .list-row.dim").last().dblclick();
    await win.waitForSelector(D("plugin-entry"));
    await win.locator(D("plugin-entry") + " select").first().selectOption("SimpleLightFog");
    await win.locator(D("plugin-entry") + " .listbox .list-row").first().dblclick();
    await win.locator(D("Default Darkness") + " input").first().fill("120");
    await win.locator(D("Default Darkness") + ' button[data-button="ok"]').click();
    await win.locator(D("plugin-entry") + ' button[data-button="ok"]').click();
    await win.locator(D("plugin-manager") + ' button[data-button="ok"]').click();
    await expect.poll(() => fs.readFileSync(path.join(PROJECT, "js/plugins.js"), "utf8")).toContain('"defaultDarkness":"120"');
    expect(errors()).toEqual([]);
});

test("playtest opens the game in its own window", async () => {
    const { app, win, errors } = editor;
    const [game] = await Promise.all([app.waitForEvent("window", { timeout: 20000 }), win.keyboard.press("Control+r")]);
    const gameErrors = [];
    game.on("pageerror", e => gameErrors.push(e.message));
    const scene = () => game.evaluate(() => (window.SceneManager && SceneManager._scene ? SceneManager._scene.constructor.name : null)).catch(() => null);
    await expect.poll(scene, { timeout: 20000 }).toBe("Scene_Title");
    expect(await game.evaluate(() => location.search)).toContain("test");
    // Saving in playtest writes save/*.rpgsave through the host bridge, and loads back.
    await game.evaluate(() => {
        DataManager.setupNewGame();
        $gameVariables.setValue(7, 77);
        return DataManager.saveGame(1);
    });
    await expect.poll(() => fs.existsSync(path.join(PROJECT, "save", "file1.rpgsave"))).toBe(true);
    const loaded = await game.evaluate(() => {
        $gameVariables.setValue(7, 0);
        return DataManager.loadGame(1).then(() => $gameVariables.value(7));
    });
    expect(loaded).toBe(77);
    expect(gameErrors).toEqual([]);
    expect(errors()).toEqual([]);
});

test("resource manager reports missing files", async () => {
    const { win, errors } = editor;
    await win.evaluate(async () => {
        const store = window.__app.store;
        store.data.Actors[1].faceName = "NoSuchFace";
        store.markDirty("Actors");
        await window.__app.save();
    });
    await win.evaluate(() => { window.__app.actions.run("resourceManager"); });
    await win.waitForSelector(D("resource-manager"));
    await win.getByRole("button", { name: "Missing Files…" }).click();
    await expect(win.locator(".dialog").last()).toContainText("img/faces/NoSuchFace");
    expect(errors()).toEqual([]);
});
