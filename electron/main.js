// main.js — Electron main process for RPG Maker 9000.
"use strict";

const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const projectTemplate = require("./lib/projectTemplate.js");
const { startStaticServer } = require("./lib/staticServer.js");
const { deployProject, findMissingAssets } = require("./lib/deploy.js");
const media = require("./lib/media.js");

const APP_ROOT = projectTemplate.APP_ROOT;
const isDev = process.argv.includes("--dev");
const cliProject = (() => {
    const i = process.argv.indexOf("--project");
    return i >= 0 ? process.argv[i + 1] : null;
})();

// Allow a separate user data folder (used by automated tests).
const userDataArg = process.argv.find(a => a.startsWith("--user-data-dir="));
if (userDataArg) app.setPath("userData", userDataArg.split("=")[1]);

protocol.registerSchemesAsPrivileged([
    { scheme: "rpg9k", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let mainWindow = null;
let currentProject = null; // absolute directory
let playtest = { server: null, root: null, url: null, windows: new Set() };

//-----------------------------------------------------------------------------
// Settings (recent projects, window bounds)

function settingsFile() {
    return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
    try {
        return JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    } catch (e) {
        return { recentProjects: [] };
    }
}

function writeSettings(settings) {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

function addRecentProject(dir) {
    const settings = readSettings();
    settings.recentProjects = [dir, ...(settings.recentProjects || []).filter(p => p !== dir)].slice(0, 10);
    writeSettings(settings);
}

//-----------------------------------------------------------------------------
// Path safety: all renderer file access is confined to the open project.

function projectPath(rel) {
    if (!currentProject) throw new Error("No project is open");
    const resolved = path.resolve(currentProject, rel || ".");
    if (resolved !== currentProject && !resolved.startsWith(currentProject + path.sep)) {
        throw new Error("Path escapes the project folder: " + rel);
    }
    return resolved;
}

function atomicWrite(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
}

function findProjectDir(p) {
    if (!p) return null;
    let dir = path.resolve(p);
    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir);
    if (fs.existsSync(path.join(dir, projectTemplate.PROJECT_FILE))) return dir;
    // Also accept RPG Maker MZ/MV projects (game.rmmzproject / Game.rpgproject)
    if (fs.existsSync(path.join(dir, "data", "System.json")) && fs.existsSync(path.join(dir, "index.html"))) return dir;
    return null;
}

//-----------------------------------------------------------------------------
// Custom protocol: rpg9k://app/... (editor + runtime) and rpg9k://project/...

function registerProtocol() {
    protocol.handle("rpg9k", request => {
        const url = new URL(request.url);
        let base;
        if (url.hostname === "app") base = APP_ROOT;
        else if (url.hostname === "project" && currentProject) base = currentProject;
        else return new Response("Not found", { status: 404 });
        const rel = decodeURIComponent(url.pathname);
        const file = path.resolve(base, "." + rel);
        if (!file.startsWith(base + path.sep)) return new Response("Forbidden", { status: 403 });
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(file).href);
    });
}

//-----------------------------------------------------------------------------
// Windows

function createMainWindow() {
    const settings = readSettings();
    const bounds = settings.windowBounds || { width: 1280, height: 820 };
    mainWindow = new BrowserWindow({
        ...bounds,
        minWidth: 900,
        minHeight: 600,
        title: "RPG Maker 9000",
        backgroundColor: "#2b2b2b",
        icon: path.join(APP_ROOT, "editor", "icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    if (settings.maximized) mainWindow.maximize();
    mainWindow.loadURL("rpg9k://app/editor/index.html");
    mainWindow.on("close", e => {
        const s = readSettings();
        s.maximized = mainWindow.isMaximized();
        if (!s.maximized) s.windowBounds = mainWindow.getBounds();
        writeSettings(s);
        // Only ask the renderer when it has registered a close guard; a page
        // that is still loading (or has crashed) must not block closing.
        if (mainWindow._closeGuard && !mainWindow._allowClose) {
            e.preventDefault();
            mainWindow.webContents.send("app:before-close");
        }
    });
    mainWindow.webContents.on("did-start-navigation", (e, url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) mainWindow._closeGuard = false;
    });
    mainWindow.webContents.on("render-process-gone", () => {
        mainWindow._closeGuard = false;
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
        for (const w of playtest.windows) if (!w.isDestroyed()) w.close();
    });
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
}

//-----------------------------------------------------------------------------
// IPC: app / dialogs

ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    platform: process.platform,
    cliProject,
    recentProjects: readSettings().recentProjects || [],
    isDev
}));

ipcMain.handle("app:set-close-guard", (e, on) => {
    if (mainWindow && e.sender === mainWindow.webContents) mainWindow._closeGuard = !!on;
});

ipcMain.handle("app:confirm-close", () => {
    if (mainWindow) {
        mainWindow._allowClose = true;
        mainWindow.close();
    }
});

ipcMain.handle("app:set-title", (e, title) => {
    if (mainWindow) mainWindow.setTitle(title);
});

ipcMain.handle("app:toggle-devtools", () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
});

ipcMain.handle("app:open-external", (e, url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.handle("app:show-project-folder", (e, rel) => {
    if (!currentProject) return;
    const dir = projectPath(rel || ".");
    if (rel === "backups") fs.mkdirSync(dir, { recursive: true });
    shell.openPath(fs.existsSync(dir) ? dir : currentProject);
});

ipcMain.handle("dialog:choose-folder", async (e, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: options.title || "Choose Folder",
        defaultPath: options.defaultPath,
        properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:open-project", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Open Project",
        properties: ["openFile"],
        filters: [
            { name: "RPG Maker 9000 Project", extensions: ["rpg9kproject", "rmmzproject", "rpgproject"] },
            { name: "All Files", extensions: ["*"] }
        ]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:choose-files", async (e, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: options.title || "Import",
        properties: ["openFile", "multiSelections"],
        filters: options.filters || [{ name: "All Files", extensions: ["*"] }]
    });
    return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("dialog:message", async (e, options) => {
    const result = await dialog.showMessageBox(mainWindow, {
        type: options.type || "info",
        title: options.title || "RPG Maker 9000",
        message: options.message || "",
        detail: options.detail,
        buttons: options.buttons || ["OK"],
        defaultId: options.defaultId || 0,
        cancelId: options.cancelId
    });
    return result.response;
});

//-----------------------------------------------------------------------------
// IPC: projects

ipcMain.handle("project:create", async (e, { parentDir, folderName, title }) => {
    const dir = path.join(parentDir, folderName);
    await projectTemplate.createProject(dir, { title });
    currentProject = dir;
    addRecentProject(dir);
    return { dir };
});

ipcMain.handle("project:open", async (e, p) => {
    const dir = findProjectDir(p);
    if (!dir) throw new Error("Not an RPG Maker 9000 project: " + p);
    currentProject = dir;
    addRecentProject(dir);
    // Keep the runtime scripts current (never touches data or plugins).
    try {
        if (fs.existsSync(path.join(dir, projectTemplate.PROJECT_FILE))) {
            projectTemplate.installRuntime(dir, { keepPlugins: true });
        }
    } catch (err) {
        console.warn("Runtime update failed:", err);
    }
    return { dir, isRpg9k: fs.existsSync(path.join(dir, projectTemplate.PROJECT_FILE)) };
});

ipcMain.handle("project:close", () => {
    currentProject = null;
});

ipcMain.handle("project:remove-recent", (e, dir) => {
    const settings = readSettings();
    settings.recentProjects = (settings.recentProjects || []).filter(p => p !== dir);
    writeSettings(settings);
});

//-----------------------------------------------------------------------------
// IPC: file system (project-relative)

//-----------------------------------------------------------------------------
// Backups: before a save overwrites data/, the current on-disk data/ and
// js/plugins.js are copied to backups/<timestamp>/. At most one backup per
// BACKUP_INTERVAL, and only the newest BACKUP_KEEP are kept.

const BACKUP_KEEP = 10;
const BACKUP_INTERVAL = 5 * 60 * 1000;
let lastBackup = { project: null, time: 0 };

function backupProject(force = false) {
    const now = Date.now();
    if (!force && lastBackup.project === currentProject && now - lastBackup.time < BACKUP_INTERVAL) return null;
    const dataDir = path.join(currentProject, "data");
    if (!fs.existsSync(dataDir)) return null;
    const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const root = path.join(currentProject, "backups");
    const dst = path.join(root, stamp);
    fs.mkdirSync(path.join(dst, "data"), { recursive: true });
    for (const f of fs.readdirSync(dataDir)) {
        if (f.endsWith(".json")) fs.copyFileSync(path.join(dataDir, f), path.join(dst, "data", f));
    }
    const pluginsJs = path.join(currentProject, "js", "plugins.js");
    if (fs.existsSync(pluginsJs)) fs.copyFileSync(pluginsJs, path.join(dst, "plugins.js"));
    const all = fs.readdirSync(root).filter(d => fs.statSync(path.join(root, d)).isDirectory()).sort();
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) fs.rmSync(path.join(root, old), { recursive: true, force: true });
    lastBackup = { project: currentProject, time: now };
    return stamp;
}

ipcMain.handle("project:missing-assets", () => {
    if (!currentProject) throw new Error("No project is open");
    return findMissingAssets(currentProject);
});

ipcMain.handle("project:backup", (e, options = {}) => {
    if (!currentProject) throw new Error("No project is open");
    return backupProject(!!options.force);
});

ipcMain.handle("fs:read-text", (e, rel) => fs.readFileSync(projectPath(rel), "utf8"));

ipcMain.handle("fs:read-json", (e, rel) => JSON.parse(fs.readFileSync(projectPath(rel), "utf8")));

ipcMain.handle("fs:write-text", (e, rel, text) => {
    atomicWrite(projectPath(rel), text);
});

ipcMain.handle("fs:write-json", (e, rel, value) => {
    atomicWrite(projectPath(rel), JSON.stringify(value));
});

ipcMain.handle("fs:exists", (e, rel) => fs.existsSync(projectPath(rel)));

ipcMain.handle("fs:list", (e, rel, options = {}) => {
    const dir = projectPath(rel);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).map(d => ({
        name: d.name,
        isDirectory: d.isDirectory() || (d.isSymbolicLink() && fs.statSync(path.join(dir, d.name)).isDirectory()),
        size: options.stat && d.isFile() ? fs.statSync(path.join(dir, d.name)).size : undefined
    }));
});

ipcMain.handle("fs:delete", (e, rel) => {
    const file = projectPath(rel);
    if (fs.existsSync(file)) fs.rmSync(file, { recursive: true, force: true });
});

ipcMain.handle("fs:rename", (e, fromRel, toRel) => {
    fs.renameSync(projectPath(fromRel), projectPath(toRel));
});

// Copies external files (chosen via dialog) into a project folder.
ipcMain.handle("fs:import", async (e, absPaths, relDir, options = {}) => {
    const dstDir = projectPath(relDir);
    fs.mkdirSync(dstDir, { recursive: true });
    const imported = [];
    for (const src of absPaths) {
        const ext = path.extname(src).toLowerCase();
        if ((ext === ".mid" || ext === ".midi") && options.convertMidi !== false) {
            const out = path.join(dstDir, path.basename(src, ext) + ".ogg");
            await media.midiToOgg(src, out);
            imported.push(path.basename(out));
        } else {
            const out = path.join(dstDir, path.basename(src));
            fs.copyFileSync(src, out);
            imported.push(path.basename(out));
        }
    }
    return imported;
});

//-----------------------------------------------------------------------------
// Playtest

async function ensurePlaytestServer() {
    if (playtest.server && playtest.root === currentProject) return playtest.url;
    if (playtest.server) playtest.server.close();
    const { server, url } = await startStaticServer(currentProject);
    playtest.server = server;
    playtest.root = currentProject;
    playtest.url = url;
    return url;
}

ipcMain.handle("playtest:start", async (e, options = {}) => {
    if (!currentProject) throw new Error("No project is open");
    const url = await ensurePlaytestServer();
    const system = JSON.parse(fs.readFileSync(path.join(currentProject, "data", "System.json"), "utf8"));
    const adv = system.advanced || {};
    const win = new BrowserWindow({
        width: adv.screenWidth || 816,
        height: adv.screenHeight || 624,
        useContentSize: true,
        title: system.gameTitle || "Playtest",
        backgroundColor: "#000000",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "playtestPreload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            additionalArguments: ["--rpg9k-project=" + currentProject]
        }
    });
    win.setMenu(null);
    win._projectDir = currentProject;
    playtest.windows.add(win);
    win.on("closed", () => playtest.windows.delete(win));
    const query = ["test"].concat(options.flags || []).join("&");
    await win.loadURL(url + "index.html?" + query);
    return true;
});

function playtestSaveDir(event) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const dir = path.join(win._projectDir, "save");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function saveFileName(name) {
    if (!/^[\w-]+$/.test(name)) throw new Error("Invalid save name");
    return name + ".rpgsave";
}

ipcMain.handle("playtest:save-file", (e, name, data) => {
    atomicWrite(path.join(playtestSaveDir(e), saveFileName(name)), data);
});

ipcMain.handle("playtest:load-file", (e, name) => {
    const file = path.join(playtestSaveDir(e), saveFileName(name));
    if (!fs.existsSync(file)) throw new Error("Savefile not found: " + name);
    return fs.readFileSync(file, "utf8");
});

ipcMain.handle("playtest:remove-file", (e, name) => {
    const file = path.join(playtestSaveDir(e), saveFileName(name));
    if (fs.existsSync(file)) fs.unlinkSync(file);
});

ipcMain.handle("playtest:list-files", e => {
    return fs
        .readdirSync(playtestSaveDir(e))
        .filter(f => f.endsWith(".rpgsave"))
        .map(f => f.slice(0, -".rpgsave".length));
});

ipcMain.handle("playtest:reload", e => {
    BrowserWindow.fromWebContents(e.sender).webContents.reloadIgnoringCache();
});

ipcMain.handle("playtest:devtools", e => {
    BrowserWindow.fromWebContents(e.sender).webContents.toggleDevTools();
});

ipcMain.handle("playtest:close", e => {
    BrowserWindow.fromWebContents(e.sender).close();
});

//-----------------------------------------------------------------------------
// Deployment and media tools

ipcMain.handle("deploy:run", async (e, options) => {
    if (!currentProject) throw new Error("No project is open");
    return deployProject(currentProject, options, progress => {
        if (mainWindow) mainWindow.webContents.send("deploy:progress", progress);
    });
});

ipcMain.handle("media:midi-available", () => media.describeMidiSupport());

//-----------------------------------------------------------------------------

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerProtocol();
    createMainWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on("window-all-closed", () => {
    if (playtest.server) playtest.server.close();
    if (process.platform !== "darwin") app.quit();
});
