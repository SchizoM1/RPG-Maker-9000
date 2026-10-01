// projectTemplate.js — creates a new RPG Maker 9000 project folder:
// runtime scripts + RTP assets + starter database.
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const RUNTIME_DIR = path.join(APP_ROOT, "runtime");
const RTP_DIR = path.join(APP_ROOT, "assets");
const TEMPLATE_DATA_DIR = path.join(APP_ROOT, "templates", "data");
const EXAMPLE_PLUGINS_DIR = path.join(APP_ROOT, "plugins-examples");

const PROJECT_FILE = "game.rpg9kproject";
const RTP_FOLDERS = ["img", "audio", "fonts", "effects", "icon"];
const IMG_FOLDERS = [
    "animations", "battlebacks1", "battlebacks2", "characters", "enemies", "faces", "parallaxes",
    "pictures", "sv_actors", "sv_enemies", "system", "tilesets", "titles1", "titles2"
];
const AUDIO_FOLDERS = ["bgm", "bgs", "me", "se"];

function copyDir(src, dst, filter) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (filter && !filter(s, entry)) continue;
        if (entry.isDirectory()) copyDir(s, d, filter);
        else fs.copyFileSync(s, d);
    }
}

// Copies (or refreshes) the runtime engine files into a project.
function installRuntime(projectDir, { keepPlugins = true } = {}) {
    fs.mkdirSync(path.join(projectDir, "js", "plugins"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "css"), { recursive: true });
    for (const file of fs.readdirSync(path.join(RUNTIME_DIR, "js"))) {
        const src = path.join(RUNTIME_DIR, "js", file);
        if (fs.statSync(src).isDirectory()) continue;
        if (file === "plugins.js" && keepPlugins && fs.existsSync(path.join(projectDir, "js", "plugins.js"))) continue;
        fs.copyFileSync(src, path.join(projectDir, "js", file));
    }
    fs.copyFileSync(path.join(RUNTIME_DIR, "css", "game.css"), path.join(projectDir, "css", "game.css"));
    if (!fs.existsSync(path.join(projectDir, "index.html"))) {
        fs.copyFileSync(path.join(RUNTIME_DIR, "index.html"), path.join(projectDir, "index.html"));
    }
    // Effekseer runtime (optional, MIT-licensed) for MZ animations.
    const libs = path.join(RTP_DIR, "js", "libs");
    for (const lib of ["effekseer.min.js", "effekseer.wasm"]) {
        const src = path.join(libs, lib);
        if (fs.existsSync(src)) {
            fs.mkdirSync(path.join(projectDir, "js", "libs"), { recursive: true });
            fs.copyFileSync(src, path.join(projectDir, "js", "libs", lib));
        }
    }
}

// Copies RTP assets. With link=true, folders are symlinked (fast, for tests).
function installRtp(projectDir, { link = false } = {}) {
    for (const folder of RTP_FOLDERS) {
        const src = path.join(RTP_DIR, folder);
        const dst = path.join(projectDir, folder);
        if (!fs.existsSync(src)) continue;
        if (link) {
            if (!fs.existsSync(dst)) fs.symlinkSync(src, dst, "dir");
        } else {
            copyDir(src, dst, (s, entry) => !(entry.isFile() && s.endsWith(".txt")));
        }
    }
    for (const f of IMG_FOLDERS) fs.mkdirSync(path.join(projectDir, "img", f), { recursive: true });
    for (const f of AUDIO_FOLDERS) fs.mkdirSync(path.join(projectDir, "audio", f), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "fonts"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "movies"), { recursive: true });
}

function readTemplate(name) {
    const file = path.join(TEMPLATE_DATA_DIR, name + ".json");
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

async function loadDefaultData() {
    const url = pathToFileURL(path.join(APP_ROOT, "editor", "core", "defaultData.js")).href;
    return import(url);
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value));
}

function mapFileName(id) {
    return "Map" + String(id).padStart(3, "0") + ".json";
}

function setIndexTitle(projectDir, title) {
    const file = path.join(projectDir, "index.html");
    let html = fs.readFileSync(file, "utf8");
    html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escapeHtml(title) + "</title>");
    fs.writeFileSync(file, html);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

async function createProject(projectDir, { title = "New Game", link = false, database = null } = {}) {
    if (fs.existsSync(projectDir) && fs.readdirSync(projectDir).length > 0) {
        throw new Error("The folder is not empty: " + projectDir);
    }
    fs.mkdirSync(projectDir, { recursive: true });
    installRuntime(projectDir, { keepPlugins: false });
    installRtp(projectDir, { link });
    // Example plugins are available in the Plugin Manager but not enabled.
    if (fs.existsSync(EXAMPLE_PLUGINS_DIR)) copyDir(EXAMPLE_PLUGINS_DIR, path.join(projectDir, "js", "plugins"), (s, entry) => !entry.isFile() || s.endsWith(".js"));
    const dataDir = path.join(projectDir, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    let db = database;
    if (!db) {
        const { createDefaultDatabase } = await loadDefaultData();
        db = createDefaultDatabase(title, {
            tilesets: readTemplate("Tilesets"),
            animations: readTemplate("Animations")
        });
    }
    for (const [name, value] of Object.entries(db)) {
        if (name === "maps") continue;
        writeJson(path.join(dataDir, name + ".json"), value);
    }
    for (const [id, map] of Object.entries(db.maps || {})) {
        writeJson(path.join(dataDir, mapFileName(Number(id))), map);
    }
    writeJson(path.join(projectDir, PROJECT_FILE), { format: "rpg9k", version: 1, title });
    setIndexTitle(projectDir, title);
    return projectDir;
}

module.exports = {
    APP_ROOT,
    RUNTIME_DIR,
    RTP_DIR,
    PROJECT_FILE,
    createProject,
    installRuntime,
    installRtp,
    mapFileName,
    setIndexTitle,
    copyDir
};
