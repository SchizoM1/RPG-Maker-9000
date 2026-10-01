// tilePalette.js — the tileset palette (tabs A–E and R for regions).
import { h, clear } from "../ui/dom.js";
import { tilesetBitmaps, onImageLoaded } from "../core/images.js";
import { regionColor } from "./mapView.js";

const TILE = 48;
const COLS = 8;

export class TilePalette {
    constructor(app) {
        this.app = app;
        this.tab = "A";
        this.tileset = null;
        this.bitmaps = [];
        this.selection = null; // {tab, x0, y0, x1, y1}
        this.customBrush = null;
        this.regionId = 1;
        this.tabbar = h("div", { class: "tabbar" });
        this.canvas = h("canvas", { width: COLS * TILE, height: TILE });
        this.scroll = h("div", { class: "palette-scroll" }, this.canvas);
        this.el = h("div", { class: "palette" }, this.tabbar, this.scroll);
        this.canvas.addEventListener("mousedown", e => this.onMouseDown(e));
        window.addEventListener("mousemove", e => this.onMouseMove(e));
        window.addEventListener("mouseup", () => (this.dragging = false));
        this.scrollPositions = {};
        new ResizeObserver(() => this.fitWidth()).observe(this.scroll);
        onImageLoaded(() => this.requestRender());
        this.renderTabs();
    }

    setTileset(tileset) {
        this.tileset = tileset;
        this.bitmaps = tilesetBitmaps(tileset);
        this.renderTabs();
        this.requestRender();
    }

    availableTabs() {
        const names = this.tileset ? this.tileset.tilesetNames : [];
        const tabs = [];
        if (names.slice(0, 5).some(n => n)) tabs.push("A");
        ["B", "C", "D", "E"].forEach((t, i) => {
            if (names[5 + i]) tabs.push(t);
        });
        return tabs;
    }

    renderTabs() {
        clear(this.tabbar);
        const available = this.availableTabs();
        const all = this.app.mode === "region" ? ["R"] : ["A", "B", "C", "D", "E"];
        if (this.app.mode === "region") this.tab = "R";
        else if (this.tab === "R") this.tab = available[0] || "A";
        for (const t of all) {
            const disabled = t !== "R" && !available.includes(t);
            const el = h("div", { class: "tab" + (t === this.tab ? " active" : "") + (disabled ? " disabled" : ""), dataset: { tab: t } }, t);
            el.addEventListener("mousedown", () => this.showTab(t));
            this.tabbar.appendChild(el);
        }
    }

    showTab(tab) {
        this.scrollPositions[this.tab] = this.scroll.scrollTop;
        this.tab = tab;
        this.renderTabs();
        this.render();
        this.scroll.scrollTop = this.scrollPositions[tab] || 0;
    }

    onModeChanged() {
        this.renderTabs();
        this.render();
    }

    // Tile IDs for the current tab, in display order (8 per row).
    cells(tab = this.tab) {
        const T = window.TileUtils;
        const names = this.tileset ? this.tileset.tilesetNames : [];
        const out = [];
        if (tab === "A") {
            if (names[0]) for (let k = 0; k < 16; k++) out.push(T.TILE_ID_A1 + k * 48);
            if (names[1]) for (let k = 0; k < 32; k++) out.push(T.TILE_ID_A2 + k * 48);
            if (names[2]) for (let k = 0; k < 32; k++) out.push(T.TILE_ID_A3 + k * 48);
            if (names[3]) for (let k = 0; k < 48; k++) out.push(T.TILE_ID_A4 + k * 48);
            if (names[4]) for (let i = 0; i < 128; i++) out.push(T.TILE_ID_A5 + i);
        } else if (tab === "R") {
            for (let r = 0; r < 256; r++) out.push(r);
        } else {
            const base = { B: 0, C: 256, D: 512, E: 768 }[tab];
            for (let row = 0; row < 32; row++) {
                for (let col = 0; col < 8; col++) out.push(base + (row < 16 ? row * 8 + col : 128 + (row - 16) * 8 + col));
            }
        }
        return out;
    }

    requestRender() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this.render();
        });
    }

    fitWidth() {
        const w = this.scroll.clientWidth;
        if (w > 0) this.canvas.style.width = Math.min(w, COLS * TILE * 1.25) + "px";
    }

    render() {
        const cells = this.cells();
        const rows = Math.max(1, Math.ceil(cells.length / COLS));
        const canvas = this.canvas;
        if (canvas.height !== rows * TILE) canvas.height = rows * TILE;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const T = window.TileUtils;
        const flags = this.tileset ? this.tileset.flags : [];
        cells.forEach((id, i) => {
            const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE;
            if (this.tab === "R") {
                if (id > 0) {
                    ctx.fillStyle = regionColor(id, 0.8);
                    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
                }
                ctx.fillStyle = "#fff";
                ctx.font = "bold 15px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(id === 0 ? "—" : String(id), x + 24, y + 25);
                return;
            }
            // checkerboard for transparency
            ctx.fillStyle = (Math.floor(i / COLS) + i) % 2 ? "#202124" : "#1a1b1d";
            ctx.fillRect(x, y, TILE, TILE);
            if (T.isAutotile(id)) {
                let shape = 47;
                if (T.isWaterfallTypeAutotile(id)) shape = 3;
                else if (T.isWallTypeAutotile(id)) shape = 15;
                window.Tilemap.drawTile(ctx, this.bitmaps, T.makeAutotileId(T.getAutotileKind(id), shape), x, y, TILE, TILE, 0, flags);
            } else {
                window.Tilemap.drawTile(ctx, this.bitmaps, id, x, y, TILE, TILE, 0, flags);
            }
        });
        if (this.tab !== "R") {
            ctx.strokeStyle = "rgba(255,255,255,0.05)";
            ctx.beginPath();
            for (let c = 1; c < COLS; c++) {
                ctx.moveTo(c * TILE + 0.5, 0);
                ctx.lineTo(c * TILE + 0.5, canvas.height);
            }
            ctx.stroke();
        }
        // selection
        const sel = this.selection;
        if (sel && sel.tab === this.tab && !this.customBrush) {
            const x0 = Math.min(sel.x0, sel.x1), y0 = Math.min(sel.y0, sel.y1);
            const w = Math.abs(sel.x1 - sel.x0) + 1, hh = Math.abs(sel.y1 - sel.y0) + 1;
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#fff";
            ctx.strokeRect(x0 * TILE + 1.5, y0 * TILE + 1.5, w * TILE - 3, hh * TILE - 3);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#000";
            ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, w * TILE - 1, hh * TILE - 1);
        }
        if (this.tab === "R") {
            const i = this.regionId;
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#fff";
            ctx.strokeRect((i % COLS) * TILE + 1.5, Math.floor(i / COLS) * TILE + 1.5, TILE - 3, TILE - 3);
        }
    }

    cellFromEvent(e) {
        const r = this.canvas.getBoundingClientRect();
        const scale = r.width / this.canvas.width;
        const x = Math.floor((e.clientX - r.left) / scale / TILE);
        const y = Math.floor((e.clientY - r.top) / scale / TILE);
        return { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, y) };
    }

    onMouseDown(e) {
        if (e.button !== 0) return;
        const c = this.cellFromEvent(e);
        const cells = this.cells();
        const index = c.y * COLS + c.x;
        if (index >= cells.length) return;
        if (this.tab === "R") {
            this.regionId = cells[index];
            this.render();
            this.app.updateStatus();
            return;
        }
        this.customBrush = null;
        this.selection = { tab: this.tab, x0: c.x, y0: c.y, x1: c.x, y1: c.y };
        this.dragging = !window.TileUtils.isAutotile(cells[index]);
        this.render();
        this.app.onBrushChanged();
    }

    onMouseMove(e) {
        if (!this.dragging || !this.selection) return;
        const c = this.cellFromEvent(e);
        const cells = this.cells();
        if (c.y * COLS + c.x >= cells.length) return;
        // Multi-selection never includes autotiles.
        const x0 = Math.min(this.selection.x0, c.x), x1 = Math.max(this.selection.x0, c.x);
        const y0 = Math.min(this.selection.y0, c.y), y1 = Math.max(this.selection.y0, c.y);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (window.TileUtils.isAutotile(cells[y * COLS + x])) return;
        if (this.selection.x1 !== c.x || this.selection.y1 !== c.y) {
            this.selection.x1 = c.x;
            this.selection.y1 = c.y;
            this.render();
            this.app.onBrushChanged();
        }
    }

    // Returns {w, h, tiles} for the current selection.
    getBrush() {
        if (this.customBrush) return this.customBrush;
        const sel = this.selection;
        if (!sel) return { w: 1, h: 1, tiles: [0] };
        const cells = this.cells(sel.tab);
        const x0 = Math.min(sel.x0, sel.x1), y0 = Math.min(sel.y0, sel.y1);
        const w = Math.abs(sel.x1 - sel.x0) + 1, hh = Math.abs(sel.y1 - sel.y0) + 1;
        const tiles = [];
        for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) tiles.push(cells[y * COLS + x] || 0);
        return { w, h: hh, tiles };
    }

    selectedTileId() {
        return this.getBrush().tiles[0];
    }

    // Right-click pick from the map: switch to the right tab and select it.
    selectTile(tileId) {
        const T = window.TileUtils;
        this.customBrush = null;
        let tab = "B";
        if (T.isAutotile(tileId) || T.isTileA5(tileId)) tab = "A";
        else tab = ["B", "C", "D", "E"][Math.floor(tileId / 256)] || "B";
        const cells = this.cells(tab);
        let index = cells.indexOf(tileId);
        if (index < 0) index = 0;
        this.scrollPositions[this.tab] = this.scroll.scrollTop;
        this.tab = tab;
        const x = index % COLS, y = Math.floor(index / COLS);
        this.selection = { tab, x0: x, y0: y, x1: x, y1: y };
        this.renderTabs();
        this.render();
        const top = y * TILE * (this.canvas.getBoundingClientRect().width / this.canvas.width || 1);
        if (top < this.scroll.scrollTop || top > this.scroll.scrollTop + this.scroll.clientHeight - TILE) this.scroll.scrollTop = top - 60;
        this.app.onBrushChanged();
    }

    setCustomBrush(brush) {
        this.customBrush = brush;
        this.render();
        this.app.onBrushChanged();
    }

    selectRegion(id) {
        this.regionId = id;
        this.render();
    }

    describeSelection() {
        if (this.app.mode === "region") return "Region " + this.regionId;
        const b = this.getBrush();
        if (b.w > 1 || b.h > 1) return "Brush " + b.w + "×" + b.h;
        return "Tile " + b.tiles[0];
    }
}
