// deploy.js — exports a project as a standalone web game folder (and zip).
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp"];
const AUDIO_EXT = [".ogg", ".m4a", ".mp3", ".wav"];

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Collects every asset reference found in the database, maps and plugins.
// Returns a Set of "folder/name" keys (e.g. "img/faces/Actor1", "audio/se/Cursor2").
function collectUsedAssets(projectDir) {
    const dataDir = path.join(projectDir, "data");
    const used = new Set();
    const add = (folder, name) => {
        if (name && typeof name === "string") used.add(folder + "/" + name);
    };
    const addAudio = (kind, audio) => {
        if (audio && typeof audio === "object" && audio.name) add("audio/" + kind, audio.name);
    };
    const load = name => {
        const file = path.join(dataDir, name + ".json");
        return fs.existsSync(file) ? readJson(file) : [];
    };

    const system = load("System");
    add("img/titles1", system.title1Name);
    add("img/titles2", system.title2Name);
    add("img/battlebacks1", system.battleback1Name);
    add("img/battlebacks2", system.battleback2Name);
    add("img/enemies", system.battlerName);
    add("img/sv_enemies", system.battlerName);
    for (const s of system.sounds || []) addAudio("se", s);
    addAudio("bgm", system.titleBgm);
    addAudio("bgm", system.battleBgm);
    addAudio("me", system.victoryMe);
    addAudio("me", system.defeatMe);
    addAudio("me", system.gameoverMe);
    for (const v of ["boat", "ship", "airship"]) {
        if (system[v]) {
            addAudio("bgm", system[v].bgm);
            add("img/characters", system[v].characterName);
        }
    }
    // Default battlebacks chosen by terrain in the overworld.
    for (const n of ["Grassland", "Ship", "Wasteland", "DirtField", "Desert", "Lava1", "Lava2", "Snowfield", "Clouds", "PoisonSwamp"]) {
        add("img/battlebacks1", n);
    }
    for (const n of ["Grassland", "Ship", "Forest", "Cliff", "Wasteland", "Desert", "Lava", "Snowfield", "Clouds", "PoisonSwamp"]) {
        add("img/battlebacks2", n);
    }

    for (const a of load("Actors")) {
        if (!a) continue;
        add("img/characters", a.characterName);
        add("img/faces", a.faceName);
        add("img/sv_actors", a.battlerName);
    }
    for (const e of load("Enemies")) {
        if (!e) continue;
        add("img/enemies", e.battlerName);
        add("img/sv_enemies", e.battlerName);
    }
    for (const t of load("Tilesets")) {
        if (!t) continue;
        for (const n of t.tilesetNames) add("img/tilesets", n);
    }
    let effectsUsed = false;
    for (const a of load("Animations")) {
        if (!a) continue;
        if (a.effectName) {
            add("effects", a.effectName);
            effectsUsed = true;
        }
        add("img/animations", a.animation1Name);
        add("img/animations", a.animation2Name);
        for (const t of a.soundTimings || []) addAudio("se", t.se);
        for (const t of a.timings || []) addAudio("se", t.se);
    }

    const scanList = list => {
        for (const cmd of list || []) scanCommand(cmd);
    };
    const scanMoveRoute = route => {
        for (const c of (route && route.list) || []) {
            if (c.code === 41) add("img/characters", c.parameters[0]);
            if (c.code === 44) addAudio("se", c.parameters[0]);
        }
    };
    const scanCommand = cmd => {
        const p = cmd.parameters || [];
        switch (cmd.code) {
            case 101:
                add("img/faces", p[0]);
                break;
            case 132:
            case 140:
                addAudio("bgm", cmd.code === 140 ? p[1] : p[0]);
                break;
            case 133:
            case 139:
                addAudio("me", p[0]);
                break;
            case 205:
                scanMoveRoute(p[1]);
                break;
            case 231:
                add("img/pictures", p[1]);
                break;
            case 241:
                addAudio("bgm", p[0]);
                break;
            case 245:
                addAudio("bgs", p[0]);
                break;
            case 249:
                addAudio("me", p[0]);
                break;
            case 250:
                addAudio("se", p[0]);
                break;
            case 261:
                add("movies", p[0]);
                break;
            case 283:
                add("img/battlebacks1", p[0]);
                add("img/battlebacks2", p[1]);
                break;
            case 284:
                add("img/parallaxes", p[0]);
                break;
            case 322:
                add("img/characters", p[1]);
                add("img/faces", p[3]);
                add("img/sv_actors", p[5]);
                break;
            case 323:
                add("img/characters", p[1]);
                break;
        }
    };
    for (const ce of load("CommonEvents")) if (ce) scanList(ce.list);
    for (const troop of load("Troops")) if (troop) for (const page of troop.pages) scanList(page.list);

    for (const file of fs.readdirSync(dataDir)) {
        if (!/^Map\d+\.json$/.test(file)) continue;
        const map = readJson(path.join(dataDir, file));
        addAudio("bgm", map.bgm);
        addAudio("bgs", map.bgs);
        add("img/parallaxes", map.parallaxName);
        add("img/battlebacks1", map.battleback1Name);
        add("img/battlebacks2", map.battleback2Name);
        for (const ev of map.events || []) {
            if (!ev) continue;
            for (const page of ev.pages) {
                add("img/characters", page.image.characterName);
                scanMoveRoute(page.moveRoute);
                scanList(page.list);
            }
        }
    }

    // Plugins: parameter strings and @requiredAssets declarations.
    const plugins = readPluginList(projectDir).filter(p => p.status);
    for (const plugin of plugins) {
        const file = path.join(projectDir, "js", "plugins", plugin.name + ".js");
        if (fs.existsSync(file)) {
            const src = fs.readFileSync(file, "utf8");
            for (const m of src.matchAll(/@requiredAssets\s+(\S+)/g)) used.add(m[1].replace(/\.\w+$/, ""));
        }
        const walk = v => {
            if (typeof v === "string") {
                used.add("*/" + v);
                try {
                    const parsed = JSON.parse(v);
                    if (typeof parsed === "object") walk(parsed);
                } catch (e) {
                    // not JSON
                }
            } else if (v && typeof v === "object") Object.values(v).forEach(walk);
        };
        walk(plugin.parameters);
    }
    return { used, effectsUsed };
}

function readPluginList(projectDir) {
    const file = path.join(projectDir, "js", "plugins.js");
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, "utf8");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end < start) return [];
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
        return [];
    }
}

function copyFile(src, dst) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
}

function listFiles(dir, base = dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const isDir = entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(full).isDirectory());
        if (isDir) out.push(...listFiles(full, base));
        else out.push(path.relative(base, full));
    }
    return out;
}

// Lists references in the data whose files don't exist, e.g. "img/faces/Hero".
// Plugin parameter strings are skipped: their folder isn't known.
const MISSING_EXTS = { img: [".png"], audio: [".ogg", ".m4a"], effects: [".efkefc"], movies: [".webm", ".mp4"] };

function findMissingAssets(projectDir) {
    const { used } = collectUsedAssets(projectDir);
    const missing = [];
    for (const key of used) {
        const top = key.split("/")[0];
        const exts = MISSING_EXTS[top];
        if (!exts) continue;
        if (!exts.some(ext => fs.existsSync(path.join(projectDir, key + ext)))) missing.push(key);
    }
    return missing.sort();
}

// Decides whether an asset file is referenced.
function isAssetUsed(rel, used) {
    const norm = rel.split(path.sep).join("/");
    const noExt = norm.replace(/\.[^./]+$/, "");
    if (norm.startsWith("img/system/")) return true;
    if (used.has(noExt)) return true;
    const base = path.posix.basename(noExt);
    if (used.has("*/" + base)) return true;
    // Plugin parameters may hold "folder/name" paths.
    for (const key of [noExt.replace(/^img\//, ""), noExt.replace(/^audio\//, "")]) {
        if (used.has("*/" + key)) return true;
    }
    return false;
}

//-----------------------------------------------------------------------------
// Minimal ZIP writer (deflate)

function crc32(buf) {
    let table = crc32.table;
    if (!table) {
        table = crc32.table = new Int32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c;
        }
    }
    let crc = -1;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

function writeZip(rootDir, zipFile, prefix) {
    const files = listFiles(rootDir);
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const rel of files) {
        const name = Buffer.from((prefix ? prefix + "/" : "") + rel.split(path.sep).join("/"), "utf8");
        const data = fs.readFileSync(path.join(rootDir, rel));
        const compressed = /\.(png|jpg|jpeg|ogg|m4a|mp4|webm|woff2?)$/i.test(rel) ? null : zlib.deflateRawSync(data);
        const stored = !compressed || compressed.length >= data.length;
        const body = stored ? data : compressed;
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(stored ? 0 : 8, 8);
        local.writeUInt32LE(0, 10);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        chunks.push(local, name, body);
        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0);
        cen.writeUInt16LE(20, 4);
        cen.writeUInt16LE(20, 6);
        cen.writeUInt16LE(0x0800, 8);
        cen.writeUInt16LE(stored ? 0 : 8, 10);
        cen.writeUInt32LE(0, 12);
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(body.length, 20);
        cen.writeUInt32LE(data.length, 24);
        cen.writeUInt16LE(name.length, 28);
        cen.writeUInt32LE(offset, 42);
        central.push(cen, name);
        offset += local.length + name.length + body.length;
    }
    const centralSize = central.reduce((s, b) => s + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    fs.writeFileSync(zipFile, Buffer.concat([...chunks, ...central, end]));
}

//-----------------------------------------------------------------------------

async function deployProject(projectDir, options, onProgress = () => {}) {
    const outDir = path.resolve(options.outDir);
    if (outDir === projectDir || outDir.startsWith(projectDir + path.sep)) {
        throw new Error("Choose an output folder outside the project.");
    }
    if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
        if (!options.overwrite) throw new Error("The output folder is not empty: " + outDir);
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });
    const report = { files: 0, skipped: 0, outDir, zip: null };

    const { used, effectsUsed } = options.excludeUnused ? collectUsedAssets(projectDir) : { used: null, effectsUsed: true };
    const plugins = readPluginList(projectDir);
    const enabledPlugins = new Set(plugins.filter(p => p.status).map(p => p.name + ".js"));
    const system = readJson(path.join(projectDir, "data", "System.json"));
    const fonts = new Set([system.advanced && system.advanced.mainFontFilename, system.advanced && system.advanced.numberFontFilename]);

    const all = listFiles(projectDir);
    const total = all.length;
    let done = 0;
    for (const rel of all) {
        done++;
        if (done % 50 === 0) onProgress({ done, total });
        const norm = rel.split(path.sep).join("/");
        const top = norm.split("/")[0];
        let include = false;
        if (["index.html", "package.json"].includes(norm)) include = true;
        else if (top === "css" || top === "icon") include = true;
        else if (top === "data") include = /\.json$/.test(norm) && !/^data\/Test_/.test(norm);
        else if (top === "js") {
            if (norm.startsWith("js/plugins/")) include = enabledPlugins.has(path.posix.basename(norm));
            else if (norm.startsWith("js/libs/effekseer")) include = effectsUsed;
            else include = true;
        } else if (top === "fonts") include = !options.excludeUnused || fonts.has(path.posix.basename(norm)) || norm.endsWith(".css");
        else if (top === "effects") {
            if (!options.excludeUnused) include = true;
            else if (norm.endsWith(".efkefc")) include = used.has(norm.replace(/\.efkefc$/, ""));
            else include = effectsUsed; // textures/models used by effects
        } else if (top === "img") {
            include = IMG_EXT.includes(path.extname(norm).toLowerCase()) && (!options.excludeUnused || isAssetUsed(rel, used));
        } else if (top === "audio") {
            include = AUDIO_EXT.includes(path.extname(norm).toLowerCase()) && (!options.excludeUnused || isAssetUsed(rel, used));
        } else if (top === "movies") include = !options.excludeUnused || isAssetUsed(rel, used);
        if (include) {
            copyFile(path.join(projectDir, rel), path.join(outDir, rel));
            report.files++;
        } else {
            report.skipped++;
        }
    }

    // index.html title and optional bundled data for file:// play.
    const indexFile = path.join(outDir, "index.html");
    let html = fs.readFileSync(indexFile, "utf8");
    html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + String(system.gameTitle).replace(/</g, "&lt;") + "</title>");
    if (options.bundleData) {
        const bundle = {};
        for (const file of fs.readdirSync(path.join(outDir, "data"))) {
            if (file.endsWith(".json")) bundle[file] = readJson(path.join(outDir, "data", file));
        }
        fs.writeFileSync(path.join(outDir, "js", "data.js"), "window.$rpg9kBundledData = " + JSON.stringify(bundle) + ";\n");
        html = html.replace("<!-- RPG9K:DATA -->", '<script type="text/javascript" src="js/data.js"></script>');
    }
    fs.writeFileSync(indexFile, html);
    fs.writeFileSync(
        path.join(outDir, "README.txt"),
        system.gameTitle + "\n\nMade with RPG Maker 9000. Open index.html in a web browser, or upload this folder to any static web host.\n"
    );

    if (options.zip) {
        const zipFile = outDir.replace(/[\\/]+$/, "") + ".zip";
        writeZip(outDir, zipFile, "");
        report.zip = zipFile;
    }
    onProgress({ done: total, total, finished: true });
    return report;
}

module.exports = { deployProject, collectUsedAssets, findMissingAssets, isAssetUsed, writeZip, readPluginList, crc32 };
