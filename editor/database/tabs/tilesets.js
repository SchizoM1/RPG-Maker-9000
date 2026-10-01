// Tilesets tab — sheet assignment and the flag editor.
import { h } from "../../ui/dom.js";
import { fieldset, field } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindSelect, bindImage } from "../dbFields.js";
import { tilesetBitmaps, onImageLoaded, invalidateImages } from "../../core/images.js";

const SLOTS = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"];
const MODES = [
    ["passage", "Passage"],
    ["passage4", "Passage (4 dir)"],
    ["ladder", "Ladder"],
    ["bush", "Bush"],
    ["counter", "Counter"],
    ["damage", "Damage Floor"],
    ["terrain", "Terrain Tag"]
];
const FLAG_BITS = { ladder: 0x20, bush: 0x40, counter: 0x80, damage: 0x100 };

function cellsFor(tileset, tab) {
    const T = window.TileUtils;
    const names = tileset.tilesetNames;
    const out = [];
    if (tab === "A") {
        if (names[0]) for (let k = 0; k < 16; k++) out.push(T.TILE_ID_A1 + k * 48);
        if (names[1]) for (let k = 0; k < 32; k++) out.push(T.TILE_ID_A2 + k * 48);
        if (names[2]) for (let k = 0; k < 32; k++) out.push(T.TILE_ID_A3 + k * 48);
        if (names[3]) for (let k = 0; k < 48; k++) out.push(T.TILE_ID_A4 + k * 48);
        if (names[4]) for (let i = 0; i < 128; i++) out.push(T.TILE_ID_A5 + i);
    } else {
        const base = { B: 0, C: 256, D: 512, E: 768 }[tab];
        for (let row = 0; row < 32; row++) for (let col = 0; col < 8; col++) out.push(base + (row < 16 ? row * 8 + col : 128 + (row - 16) * 8 + col));
    }
    return out;
}

function setFlag(tileset, tileId, fn) {
    const T = window.TileUtils;
    if (T.isAutotile(tileId)) {
        const base = T.makeAutotileId(T.getAutotileKind(tileId), 0);
        for (let i = 0; i < 48; i++) tileset.flags[base + i] = fn(tileset.flags[base + i] || 0);
    } else {
        tileset.flags[tileId] = fn(tileset.flags[tileId] || 0);
    }
}

export function tilesetsTab(env) {
    return listTab(env, "Tilesets", (ts, ui) => {
        let tab = "A";
        let mode = "passage";
        const TILE = 32;
        const canvas = h("canvas", { width: 8 * TILE, height: TILE });
        const scroll = h("div", { class: "palette-scroll", style: { height: "540px", width: "276px", flex: "none" } }, canvas);
        const draw = () => {
            const cells = cellsFor(ts, tab);
            const bitmaps = tilesetBitmaps(ts);
            canvas.height = Math.max(1, Math.ceil(cells.length / 8)) * TILE;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const T = window.TileUtils;
            ctx.save();
            ctx.scale(TILE / 48, TILE / 48);
            cells.forEach((id, i) => {
                const x = (i % 8) * 48, y = Math.floor(i / 8) * 48;
                let drawId = id;
                if (T.isAutotile(id)) drawId = T.makeAutotileId(T.getAutotileKind(id), T.isWallTypeAutotile(id) ? 15 : T.isWaterfallTypeAutotile(id) ? 3 : 47);
                window.Tilemap.drawTile(ctx, bitmaps, drawId, x, y, 48, 48, 0, ts.flags);
            });
            ctx.restore();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            cells.forEach((id, i) => {
                const x = (i % 8) * TILE, y = Math.floor(i / 8) * TILE;
                const f = ts.flags[id] || 0;
                const cx = x + TILE / 2, cy = y + TILE / 2;
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0,0,0,0.8)";
                ctx.fillStyle = "#fff";
                ctx.font = "bold 18px sans-serif";
                const mark = text => {
                    ctx.strokeText(text, cx, cy + 1);
                    ctx.fillText(text, cx, cy + 1);
                };
                if (mode === "passage") {
                    if (f & 0x10) mark("☆");
                    else if ((f & 0x0f) === 0x0f) mark("×");
                    else mark("○");
                } else if (mode === "passage4") {
                    ctx.font = "bold 12px sans-serif";
                    const arrows = [[0x08, cx, y + 7, "▲"], [0x01, cx, y + TILE - 6, "▼"], [0x02, x + 6, cy, "◀"], [0x04, x + TILE - 6, cy, "▶"]];
                    for (const [bit, ax, ay, ch] of arrows) {
                        if (!(f & bit)) {
                            ctx.strokeText(ch, ax, ay);
                            ctx.fillText(ch, ax, ay);
                        } else {
                            ctx.fillStyle = "rgba(255,255,255,0.6)";
                            ctx.fillText("·", ax, ay);
                            ctx.fillStyle = "#fff";
                        }
                    }
                } else if (mode === "terrain") {
                    mark(String(f >> 12));
                } else {
                    mark(f & FLAG_BITS[mode] ? "○" : "·");
                }
            });
        };
        canvas.addEventListener("contextmenu", e => e.preventDefault());
        canvas.addEventListener("mousedown", e => {
            const r = canvas.getBoundingClientRect();
            const px = e.clientX - r.left, py = e.clientY - r.top;
            const col = Math.floor(px / TILE), row = Math.floor(py / TILE);
            const cells = cellsFor(ts, tab);
            const id = cells[row * 8 + col];
            if (id === undefined) return;
            const T = window.TileUtils;
            const isUpper = !T.isAutotile(id) && !T.isTileA5(id);
            if (mode === "passage") {
                setFlag(ts, id, f => {
                    if (f & 0x10) return f & ~0x1f; // star -> o
                    if ((f & 0x0f) === 0x0f) return isUpper ? (f & ~0x0f) | 0x10 : f & ~0x0f; // x -> star (upper) / o
                    return f | 0x0f; // o -> x
                });
            } else if (mode === "passage4") {
                const lx = px - col * TILE, ly = py - row * TILE;
                const dx = lx - TILE / 2, dy = ly - TILE / 2;
                const bit = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0x02 : 0x04) : dy < 0 ? 0x08 : 0x01;
                setFlag(ts, id, f => f ^ bit);
            } else if (mode === "terrain") {
                setFlag(ts, id, f => {
                    let t = f >> 12;
                    t = e.button === 2 ? (t + 7) % 8 : (t + 1) % 8;
                    return (f & 0x0fff) | (t << 12);
                });
            } else {
                setFlag(ts, id, f => f ^ FLAG_BITS[mode]);
            }
            draw();
        });
        onImageLoaded(() => draw());
        const tabBar = h("div", { class: "tabbar" });
        ["A", "B", "C", "D", "E"].forEach(t => {
            const el = h("div", { class: "tab" + (t === tab ? " active" : "") }, t);
            el.addEventListener("mousedown", () => {
                tab = t;
                [...tabBar.children].forEach(c => c.classList.toggle("active", c === el));
                draw();
            });
            tabBar.appendChild(el);
        });
        const modeList = h("div", { class: "col", style: { gap: "3px" } });
        MODES.forEach(([id, label]) => {
            const b = h("button", { class: "btn small" + (id === mode ? " primary" : "") }, label);
            b.addEventListener("click", () => {
                mode = id;
                [...modeList.children].forEach(c => c.classList.toggle("primary", c === b));
                draw();
            });
            modeList.appendChild(b);
        });
        draw();
        const images = SLOTS.map((slot, i) => field(slot, bindImage(ts.tilesetNames, i, "tilesets", {
            width: 170,
            onChange: () => {
                invalidateImages();
                draw();
            }
        })));
        return h(
            "div",
            { class: "row", style: { alignItems: "flex-start" } },
            h(
                "div",
                { class: "col", style: { width: "380px" } },
                fieldset("General Settings", h("div", { class: "col" }, field("Name", bindText(ts, "name", { onChange: ui.updateName })), field("Mode", bindSelect(ts, "mode", [[0, "World Type"], [1, "Area Type"], [2, "VX Compatible"]])))),
                fieldset("Images", h("div", { class: "grid-2" }, ...images)),
                field("Note", bindArea(ts, "note", { rows: 3 }))
            ),
            h("div", { class: "col" }, tabBar, scroll),
            fieldset("Flags", modeList, h("div", { class: "hint", style: { maxWidth: "150px" } }, "Click tiles to toggle. Terrain: left-click +1, right-click −1."))
        );
    });
}
