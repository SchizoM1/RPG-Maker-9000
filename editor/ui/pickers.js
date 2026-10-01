// pickers.js — dialogs for choosing database entries, switches/variables,
// audio files, images, character graphics and faces.
import { h, clear, pad, idName } from "./dom.js";
import { openDialog, promptDialog } from "./dialog.js";
import { ListBox, numberInput, button, field, selectInput } from "./widgets.js";
import { api, projectUrl } from "../core/api.js";
import { loadImage, whenReady, tilesetBitmaps } from "../core/images.js";

//-----------------------------------------------------------------------------
// Generic list picker

export async function listPicker({ title, items, value, width = 360, height = 420 }) {
    let chosen = value;
    const list = new ListBox({
        onChange: i => (chosen = items[i] ? items[i].value : chosen),
        onActivate: () => dialog.onButton("ok")
    });
    list.el.style.height = height - 110 + "px";
    list.setItems(items.map(it => ({ label: it.label })));
    const start = items.findIndex(it => it.value === value);
    if (start >= 0) setTimeout(() => list.select(start), 0);
    let dialog;
    const p = openDialog({
        title,
        width,
        body: list.el,
        onOpen: d => (dialog = d)
    });
    const ok = await p;
    return ok ? chosen : undefined;
}

// Items for a database array: "0001: Name"
export function databaseItems(array, allowNone = false, noneLabel = "(None)") {
    const items = [];
    if (allowNone) items.push({ value: 0, label: noneLabel });
    for (let id = 1; id < array.length; id++) {
        items.push({ value: id, label: idName(id, array[id] ? array[id].name : "") });
    }
    return items;
}

export function databasePicker(store, kind, value, options = {}) {
    return listPicker({
        title: options.title || "Select " + kind,
        items: databaseItems(store.data[kind], options.allowNone, options.noneLabel),
        value
    });
}

//-----------------------------------------------------------------------------
// Switch / variable picker (MZ style: groups of 20 with name editing)

export async function switchVariablePicker(store, kind, value) {
    const system = store.system;
    const key = kind === "switch" ? "switches" : "variables";
    const names = system[key];
    let selected = Math.max(1, value || 1);
    let group = Math.floor((selected - 1) / 20);
    const groupList = new ListBox({ onChange: i => showGroup(i) });
    const entryList = new ListBox({
        onChange: i => {
            selected = group * 20 + i + 1;
            nameInput.value = names[selected] || "";
        },
        onActivate: () => dialog.onButton("ok")
    });
    groupList.el.style.width = "170px";
    groupList.el.style.height = "340px";
    entryList.el.style.width = "260px";
    entryList.el.style.height = "340px";
    const nameInput = h("input", { type: "text" });
    nameInput.addEventListener("input", () => {
        if (selected < names.length) {
            names[selected] = nameInput.value;
            store.markDirty("System");
            entryList.items[selected - 1 - group * 20].label = pad(selected) + ": " + nameInput.value;
            entryList.rows[selected - 1 - group * 20].textContent = pad(selected) + ": " + nameInput.value;
        }
    });
    const refreshGroups = () => {
        const count = Math.ceil((names.length - 1) / 20);
        const items = [];
        for (let g = 0; g < count; g++) items.push({ label: "[ " + pad(g * 20 + 1) + " - " + pad(g * 20 + 20) + " ]" });
        groupList.setItems(items);
    };
    const showGroup = g => {
        group = g;
        const items = [];
        for (let id = g * 20 + 1; id <= g * 20 + 20 && id < names.length; id++) items.push({ label: pad(id) + ": " + (names[id] || "") });
        entryList.setItems(items, false);
        const idx = selected - 1 - g * 20;
        if (idx >= 0 && idx < items.length) entryList.select(idx, true);
        else entryList.select(0, true);
    };
    const changeMax = async () => {
        const v = await promptDialog("Maximum number:", String(names.length - 1), "Change Maximum");
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 1 && n <= 5000) {
            while (names.length - 1 < n) names.push("");
            names.length = n + 1;
            store.markDirty("System");
            refreshGroups();
            groupList.select(Math.min(group, Math.ceil(n / 20) - 1));
        }
    };
    refreshGroups();
    let dialog;
    setTimeout(() => groupList.select(group), 0);
    const result = await openDialog({
        title: kind === "switch" ? "Switch" : "Variable",
        body: h(
            "div",
            { class: "col" },
            h("div", { class: "row", style: { alignItems: "stretch" } }, groupList.el, entryList.el),
            h("div", { class: "row center" }, button("Change Maximum…", changeMax), field("Name", nameInput, { grow: true }))
        ),
        onOpen: d => (dialog = d)
    });
    return result ? selected : undefined;
}

export function switchVariableLabel(store, kind, id) {
    const names = kind === "switch" ? store.system.switches : store.system.variables;
    return pad(id) + (names[id] ? " " + names[id] : "");
}

//-----------------------------------------------------------------------------
// Audio picker

const AUDIO_EXTS = [".ogg", ".m4a", ".mp3", ".wav"];

export async function listAssetNames(dir, exts) {
    const entries = await api.fs.list(dir);
    const names = new Set();
    for (const e of entries) {
        if (e.isDirectory) continue;
        const dot = e.name.lastIndexOf(".");
        const ext = dot >= 0 ? e.name.slice(dot).toLowerCase() : "";
        if (!exts || exts.includes(ext)) names.add(dot >= 0 ? e.name.slice(0, dot) : e.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

let previewAudio = null;
export function stopAudioPreview() {
    if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
    }
}

export async function playAudioPreview(folder, audio) {
    stopAudioPreview();
    if (!audio || !audio.name) return;
    const entries = await api.fs.list("audio/" + folder);
    const file = entries.find(e => e.name.startsWith(audio.name + ".") && AUDIO_EXTS.some(x => e.name.toLowerCase().endsWith(x)));
    if (!file) return;
    previewAudio = new Audio(projectUrl("audio/" + folder + "/" + file.name));
    previewAudio.volume = Math.max(0, Math.min(1, (audio.volume == null ? 90 : audio.volume) / 100));
    previewAudio.playbackRate = Math.max(0.5, Math.min(1.5, (audio.pitch || 100) / 100));
    previewAudio.loop = folder === "bgm" || folder === "bgs";
    previewAudio.play().catch(() => 0);
}

export async function audioPicker(folder, audio, options = {}) {
    const current = { name: "", volume: 90, pitch: 100, pan: 0, ...(audio || {}) };
    const names = await listAssetNames("audio/" + folder, AUDIO_EXTS);
    const items = [{ label: "(None)", value: "" }, ...names.map(n => ({ label: n, value: n }))];
    const list = new ListBox({
        onChange: i => (current.name = items[i].value),
        onActivate: () => playAudioPreview(folder, current)
    });
    list.el.style.height = "360px";
    list.el.style.width = "300px";
    list.setItems(items.map(it => ({ label: it.label })));
    const slider = (label, key, min, max) => {
        const value = h("span", { style: { width: "36px", textAlign: "right" } }, String(current[key]));
        const input = h("input", { type: "range", min, max, value: current[key], style: { width: "160px" } });
        input.addEventListener("input", () => {
            current[key] = Number(input.value);
            value.textContent = input.value;
            if (previewAudio) {
                previewAudio.volume = current.volume / 100;
                previewAudio.playbackRate = Math.max(0.5, Math.min(1.5, current.pitch / 100));
            }
        });
        return field(label, h("div", { class: "row center" }, input, value));
    };
    const controls = h(
        "div",
        { class: "col", style: { width: "200px" } },
        button("▶ Play", () => playAudioPreview(folder, current)),
        button("■ Stop", stopAudioPreview),
        slider("Volume", "volume", 0, 100),
        slider("Pitch", "pitch", 50, 150),
        slider("Pan", "pan", -100, 100)
    );
    const start = items.findIndex(it => it.value === current.name);
    setTimeout(() => list.select(Math.max(0, start)), 0);
    const ok = await openDialog({
        title: options.title || folder.toUpperCase(),
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, controls),
        onClose: stopAudioPreview
    });
    return ok ? { name: current.name, volume: current.volume, pitch: current.pitch, pan: current.pan } : undefined;
}

export function audioLabel(audio) {
    if (!audio || !audio.name) return "(None)";
    return audio.name + " (" + audio.volume + ", " + audio.pitch + ", " + audio.pan + ")";
}

//-----------------------------------------------------------------------------
// Image picker (single images: parallaxes, pictures, titles, battlebacks, …)

export async function imagePicker(folder, name, options = {}) {
    const names = await listAssetNames("img/" + folder, [".png"]);
    const items = [{ label: "(None)", value: "" }, ...names.map(n => ({ label: n, value: n }))];
    let chosen = name || "";
    const canvas = h("canvas", { width: 480, height: 360 });
    const preview = h("div", { class: "image-thumb", style: { width: "484px", height: "364px", cursor: "default" } }, canvas);
    const draw = async () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!chosen) return;
        const bmp = await whenReady(loadImage(folder, chosen));
        if (!bmp || !bmp.source || chosen !== current) return;
        const scale = Math.min(1, canvas.width / bmp.width, canvas.height / bmp.height);
        const w = bmp.width * scale, hh = bmp.height * scale;
        ctx.imageSmoothingEnabled = scale < 1;
        ctx.drawImage(bmp.source, (canvas.width - w) / 2, (canvas.height - hh) / 2, w, hh);
    };
    let current = chosen;
    const list = new ListBox({
        onChange: i => {
            chosen = items[i].value;
            current = chosen;
            draw();
        },
        onActivate: () => dialog.onButton("ok")
    });
    list.el.style.height = "364px";
    list.el.style.width = "240px";
    list.setItems(items.map(it => ({ label: it.label })));
    let dialog;
    const start = items.findIndex(it => it.value === chosen);
    setTimeout(() => list.select(Math.max(0, start)), 0);
    const ok = await openDialog({
        title: options.title || "Select Image",
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, preview),
        onOpen: d => (dialog = d)
    });
    return ok ? chosen : undefined;
}

//-----------------------------------------------------------------------------
// Character / tile picker (event images). value: {characterName,
// characterIndex, direction, pattern, tileId}

export async function characterPicker(store, value, options = {}) {
    const state = { tileId: 0, characterName: "", characterIndex: 0, direction: 2, pattern: 1, ...(value || {}) };
    const names = await listAssetNames("img/characters", [".png"]);
    const TILES = "__tiles__";
    const items = [{ label: "(None)", value: "" }];
    if (options.tileset) items.push({ label: "B-E Tiles", value: TILES });
    names.forEach(n => items.push({ label: n, value: n }));
    const canvas = h("canvas", { width: 576, height: 384 });
    const wrap = h("div", { class: "image-thumb", style: { width: "600px", height: "420px", overflow: "auto", display: "block", cursor: "crosshair" } }, canvas);
    let mode = state.tileId > 0 ? TILES : state.characterName;
    let bitmap = null;
    let tileTab = state.tileId > 0 ? Math.floor(state.tileId / 256) : 0;

    const drawSheet = async () => {
        const ctx = canvas.getContext("2d");
        if (mode === TILES) {
            const bitmaps = tilesetBitmaps(options.tileset);
            const b = bitmaps[5 + tileTab];
            if (b) await whenReady(b);
            canvas.width = 384;
            canvas.height = 32 * 48;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < 256; i++) {
                const col = i % 8, row = Math.floor(i / 8);
                const id = tileTab * 256 + (row < 16 ? row * 8 + col : 128 + (row - 16) * 8 + col);
                window.Tilemap.drawTile(ctx, bitmaps, id, col * 48, row * 48, 48, 48, 0, options.tileset.flags);
            }
            if (state.tileId > 0 && Math.floor(state.tileId / 256) === tileTab) {
                const local = state.tileId % 256;
                const row = local < 128 ? Math.floor(local / 8) : 16 + Math.floor((local - 128) / 8);
                const col = local % 8;
                outline(ctx, col * 48, row * 48, 48, 48);
            }
            return;
        }
        if (!mode) {
            canvas.width = 576;
            canvas.height = 384;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        bitmap = await whenReady(loadImage("characters", mode));
        if (!bitmap || !bitmap.source) return;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap.source, 0, 0);
        const big = isBig(mode);
        const pw = bitmap.width / (big ? 3 : 12), ph = bitmap.height / (big ? 4 : 8);
        if (mode === state.characterName) {
            const n = big ? 0 : state.characterIndex;
            const x = ((n % 4) * 3 + state.pattern) * pw;
            const y = (Math.floor(n / 4) * 4 + (state.direction - 2) / 2) * ph;
            outline(ctx, x, y, pw, ph);
        }
    };

    canvas.addEventListener("mousedown", e => {
        const r = canvas.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * canvas.width;
        const y = ((e.clientY - r.top) / r.height) * canvas.height;
        if (mode === TILES) {
            const col = Math.floor(x / 48), row = Math.floor(y / 48);
            const local = row < 16 ? row * 8 + col : 128 + (row - 16) * 8 + col;
            state.tileId = tileTab * 256 + local;
            state.characterName = "";
            state.characterIndex = 0;
        } else if (mode && bitmap) {
            const big = isBig(mode);
            const pw = bitmap.width / (big ? 3 : 12), ph = bitmap.height / (big ? 4 : 8);
            const cx = Math.floor(x / pw), cy = Math.floor(y / ph);
            state.tileId = 0;
            state.characterName = mode;
            state.characterIndex = big ? 0 : Math.floor(cy / 4) * 4 + Math.floor(cx / 3);
            state.pattern = cx % 3;
            state.direction = (cy % 4) * 2 + 2;
        }
        drawSheet();
    });

    const tabSelect = selectInput(tileTab, [[0, "B"], [1, "C"], [2, "D"], [3, "E"]], v => {
        tileTab = v;
        drawSheet();
    });
    const tabRow = h("div", { class: "row center", style: { display: mode === TILES ? "flex" : "none" } }, "Sheet:", tabSelect);
    const list = new ListBox({
        onChange: i => {
            mode = items[i].value;
            tabRow.style.display = mode === TILES ? "flex" : "none";
            if (!mode) {
                state.tileId = 0;
                state.characterName = "";
                state.characterIndex = 0;
            }
            drawSheet();
        },
        onActivate: () => dialog.onButton("ok")
    });
    list.el.style.width = "220px";
    list.el.style.height = "420px";
    list.setItems(items.map(it => ({ label: it.label })));
    let dialog;
    const start = items.findIndex(it => it.value === mode);
    setTimeout(() => list.select(Math.max(0, start)), 0);
    const ok = await openDialog({
        title: options.title || "Select an Image",
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, h("div", { class: "col" }, tabRow, wrap)),
        onOpen: d => (dialog = d)
    });
    return ok ? state : undefined;
}

function isBig(name) {
    const sign = (name || "").match(/^[!$]+/);
    return !!(sign && sign[0].includes("$"));
}

function outline(ctx, x, y, w, hh) {
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, hh - 3);
    ctx.strokeStyle = "#3d7bd9";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, hh - 3);
    ctx.restore();
}

// Draws an event/actor graphic into a small canvas (for thumbnails).
export async function drawCharacterThumb(canvas, value, tileset) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    if (value.tileId > 0 && tileset) {
        const bitmaps = tilesetBitmaps(tileset);
        const b = bitmaps[5 + Math.floor(value.tileId / 256)];
        if (b) await whenReady(b);
        window.Tilemap.drawTile(ctx, bitmaps, value.tileId, (canvas.width - 48) / 2, (canvas.height - 48) / 2, 48, 48, 0, tileset.flags);
        return;
    }
    if (!value.characterName) return;
    const bmp = await whenReady(loadImage("characters", value.characterName));
    if (!bmp || !bmp.source) return;
    const big = isBig(value.characterName);
    const pw = bmp.width / (big ? 3 : 12), ph = bmp.height / (big ? 4 : 8);
    const n = big ? 0 : value.characterIndex || 0;
    const sx = ((n % 4) * 3 + (value.pattern == null ? 1 : value.pattern)) * pw;
    const sy = (Math.floor(n / 4) * 4 + ((value.direction || 2) - 2) / 2) * ph;
    const scale = Math.min(1, canvas.width / pw, canvas.height / ph);
    ctx.drawImage(bmp.source, sx, sy, pw, ph, (canvas.width - pw * scale) / 2, (canvas.height - ph * scale) / 2, pw * scale, ph * scale);
}

//-----------------------------------------------------------------------------
// Face picker: returns {faceName, faceIndex}

export async function facePicker(faceName, faceIndex) {
    const state = { faceName: faceName || "", faceIndex: faceIndex || 0 };
    const names = await listAssetNames("img/faces", [".png"]);
    const items = [{ label: "(None)", value: "" }, ...names.map(n => ({ label: n, value: n }))];
    const canvas = h("canvas", { width: 576, height: 288 });
    const wrap = h("div", { class: "image-thumb", style: { width: "580px", height: "292px", cursor: "crosshair" } }, canvas);
    let mode = state.faceName;
    const draw = async () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!mode) return;
        const bmp = await whenReady(loadImage("faces", mode));
        if (!bmp || !bmp.source) return;
        ctx.drawImage(bmp.source, 0, 0, canvas.width, canvas.height);
        if (mode === state.faceName) {
            const fw = canvas.width / 4, fh = canvas.height / 2;
            outline(ctx, (state.faceIndex % 4) * fw, Math.floor(state.faceIndex / 4) * fh, fw, fh);
        }
    };
    canvas.addEventListener("mousedown", e => {
        if (!mode) return;
        const r = canvas.getBoundingClientRect();
        const col = Math.floor(((e.clientX - r.left) / r.width) * 4);
        const row = Math.floor(((e.clientY - r.top) / r.height) * 2);
        state.faceName = mode;
        state.faceIndex = row * 4 + col;
        draw();
    });
    canvas.addEventListener("dblclick", () => dialog.onButton("ok"));
    const list = new ListBox({
        onChange: i => {
            mode = items[i].value;
            if (!mode) {
                state.faceName = "";
                state.faceIndex = 0;
            }
            draw();
        }
    });
    list.el.style.width = "220px";
    list.el.style.height = "292px";
    list.setItems(items.map(it => ({ label: it.label })));
    let dialog;
    setTimeout(() => list.select(Math.max(0, items.findIndex(it => it.value === mode))), 0);
    const ok = await openDialog({
        title: "Select a Face",
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, wrap),
        onOpen: d => (dialog = d)
    });
    return ok ? state : undefined;
}

export async function drawFaceThumb(canvas, faceName, faceIndex) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!faceName) return;
    const bmp = await whenReady(loadImage("faces", faceName));
    if (!bmp || !bmp.source) return;
    const fw = bmp.width / 4, fh = bmp.height / 2;
    ctx.drawImage(bmp.source, (faceIndex % 4) * fw, Math.floor(faceIndex / 4) * fh, fw, fh, 0, 0, canvas.width, canvas.height);
}

//-----------------------------------------------------------------------------
// Icon picker (IconSet.png)

export async function iconPicker(iconIndex) {
    let chosen = iconIndex || 0;
    const bmp = await whenReady(loadImage("system", "IconSet"));
    const size = 32;
    const cols = 16;
    const rows = bmp && bmp.source ? Math.ceil(bmp.height / size) : 20;
    const canvas = h("canvas", { width: cols * size, height: rows * size });
    const draw = () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (bmp && bmp.source) ctx.drawImage(bmp.source, 0, 0);
        outline(ctx, (chosen % cols) * size, Math.floor(chosen / cols) * size, size, size);
    };
    canvas.addEventListener("mousedown", e => {
        const r = canvas.getBoundingClientRect();
        chosen = Math.floor((e.clientY - r.top) / size) * cols + Math.floor((e.clientX - r.left) / size);
        info.textContent = "Index: " + chosen;
        draw();
    });
    canvas.addEventListener("dblclick", () => dialog.onButton("ok"));
    const info = h("div", { class: "hint" }, "Index: " + chosen);
    draw();
    let dialog;
    const ok = await openDialog({
        title: "Select an Icon",
        body: h("div", { class: "col" }, h("div", { class: "image-thumb", style: { display: "block", overflow: "auto", maxHeight: "480px", cursor: "crosshair" } }, canvas), info),
        onOpen: d => {
            dialog = d;
            const y = Math.floor(chosen / cols) * size;
            canvas.parentElement.scrollTop = Math.max(0, y - 200);
        }
    });
    return ok ? chosen : undefined;
}

export async function drawIcon(canvas, iconIndex) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bmp = await whenReady(loadImage("system", "IconSet"));
    if (!bmp || !bmp.source) return;
    ctx.drawImage(bmp.source, (iconIndex % 16) * 32, Math.floor(iconIndex / 16) * 32, 32, 32, 0, 0, canvas.width, canvas.height);
}

//-----------------------------------------------------------------------------
// Map position picker (for Transfer Player etc.): returns {mapId, x, y}

export async function mapPositionPicker(store, value) {
    const state = { mapId: value && value.mapId ? value.mapId : 1, x: value ? value.x || 0 : 0, y: value ? value.y || 0 : 0 };
    const infos = store.mapInfos();
    const mapItems = [];
    const walk = (parentId, depth) => {
        for (const info of store.childrenOf(parentId)) {
            mapItems.push({ value: info.id, label: "  ".repeat(depth) + pad(info.id, 3) + ": " + info.name });
            walk(info.id, depth + 1);
        }
    };
    walk(0, 0);
    const canvas = h("canvas", { width: 10, height: 10 });
    const wrap = h("div", { class: "image-thumb", style: { width: "640px", height: "460px", overflow: "auto", display: "block", cursor: "crosshair" } }, canvas);
    const posLabel = h("div", { class: "hint" });
    const TILE = 24;
    let map = null;
    const draw = async () => {
        map = await store.loadMap(state.mapId);
        const tileset = store.data.Tilesets[map.tilesetId];
        const bitmaps = tilesetBitmaps(tileset);
        await Promise.all(bitmaps.filter(Boolean).map(whenReady));
        canvas.width = map.width * TILE;
        canvas.height = map.height * TILE;
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.scale(0.5, 0.5);
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                for (let z = 0; z < 4; z++) {
                    const id = map.data[(z * map.height + y) * map.width + x];
                    if (id) window.Tilemap.drawTile(ctx, bitmaps, id, x * 48, y * 48, 48, 48, 0, tileset ? tileset.flags : []);
                }
            }
        }
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        for (let x = 0; x <= map.width; x++) ctx.strokeRect(x * TILE + 0.5, 0, 0, canvas.height);
        for (let y = 0; y <= map.height; y++) ctx.strokeRect(0, y * TILE + 0.5, canvas.width, 0);
        outline(ctx, state.x * TILE - 1, state.y * TILE - 1, TILE + 2, TILE + 2);
        posLabel.textContent = "Map " + pad(state.mapId, 3) + " (" + state.x + ", " + state.y + ")";
    };
    canvas.addEventListener("mousedown", e => {
        const r = canvas.getBoundingClientRect();
        state.x = Math.max(0, Math.min(map.width - 1, Math.floor((e.clientX - r.left) / TILE)));
        state.y = Math.max(0, Math.min(map.height - 1, Math.floor((e.clientY - r.top) / TILE)));
        draw();
    });
    canvas.addEventListener("dblclick", () => dialog.onButton("ok"));
    const list = new ListBox({
        onChange: i => {
            if (mapItems[i] && mapItems[i].value !== state.mapId) {
                state.mapId = mapItems[i].value;
                state.x = 0;
                state.y = 0;
            }
            draw();
        }
    });
    list.el.style.width = "220px";
    list.el.style.height = "460px";
    list.setItems(mapItems.map(m => ({ label: m.label })));
    let dialog;
    setTimeout(() => list.select(Math.max(0, mapItems.findIndex(m => m.value === state.mapId))), 0);
    void infos;
    const ok = await openDialog({
        title: "Select Position",
        body: h("div", { class: "col" }, h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, wrap), posLabel),
        onOpen: d => (dialog = d)
    });
    return ok ? state : undefined;
}

//-----------------------------------------------------------------------------
// Color tone editor: [r, g, b, gray]

export async function tonePicker(tone, title = "Color Tone") {
    const t = (tone || [0, 0, 0, 0]).slice();
    const preview = h("div", { class: "color-swatch", style: { width: "120px", height: "80px" } });
    const update = () => {
        const base = 128;
        const c = i => Math.max(0, Math.min(255, base + t[i]));
        preview.style.background = `rgb(${c(0)},${c(1)},${c(2)})`;
        preview.style.filter = `grayscale(${t[3] / 255})`;
    };
    const slider = (label, i, min, max) => {
        const num = numberInput(t[i], v => {
            t[i] = v;
            range.value = v;
            update();
        }, { min, max, width: 64 });
        const range = h("input", { type: "range", min, max, value: t[i], style: { width: "200px" } });
        range.addEventListener("input", () => {
            t[i] = Number(range.value);
            num.value = range.value;
            update();
        });
        return h("div", { class: "row center" }, h("span", { style: { width: "50px" } }, label), range, num);
    };
    const presets = [
        ["Normal", [0, 0, 0, 0]],
        ["Dark", [-68, -68, -68, 0]],
        ["Sepia", [34, -34, -68, 170]],
        ["Sunset", [68, -34, -34, 0]],
        ["Night", [-68, -68, 0, 68]]
    ];
    const presetRow = h("div", { class: "row", style: { flexWrap: "wrap" } }, presets.map(([name, v]) => button(name, () => {
        t.splice(0, 4, ...v);
        dialogBody.replaceWith((dialogBody = build()));
        update();
    }, { small: true })));
    const build = () => h("div", { class: "col" }, slider("Red", 0, -255, 255), slider("Green", 1, -255, 255), slider("Blue", 2, -255, 255), slider("Gray", 3, 0, 255));
    let dialogBody = build();
    update();
    const ok = await openDialog({ title, body: h("div", { class: "row", style: { alignItems: "flex-start" } }, h("div", { class: "col" }, dialogBody, presetRow), preview) });
    return ok ? t : undefined;
}

export async function colorPicker(color, title = "Color") {
    // color: [r, g, b, a]
    const c = (color || [255, 255, 255, 255]).slice();
    const swatch = h("div", { class: "color-swatch", style: { width: "120px", height: "80px" } });
    const update = () => (swatch.style.background = `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`);
    const row = (label, i) => {
        const input = numberInput(c[i], v => {
            c[i] = v;
            update();
        }, { min: 0, max: 255, width: 70 });
        return field(label, input);
    };
    update();
    const ok = await openDialog({
        title,
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, h("div", { class: "grid-2" }, row("Red", 0), row("Green", 1), row("Blue", 2), row("Strength", 3)), swatch)
    });
    return ok ? c : undefined;
}

export { clear };
