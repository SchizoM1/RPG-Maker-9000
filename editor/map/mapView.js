// mapView.js — the map canvas: renders layers with the runtime Tilemap code,
// handles drawing tools, region painting and event mode interactions.
import { h } from "../ui/dom.js";
import { loadImage, tilesetBitmaps, onImageLoaded, characterFrame } from "../core/images.js";
import * as P from "./paint.js";

const TILE = 48;
const CHUNK = 16;

export class MapView {
    constructor(app) {
        this.app = app;
        this.store = app.store;
        this.el = h("div", { class: "mapview", tabIndex: 0 });
        this.canvas = h("canvas", { class: "view" });
        this.spacer = h("div", { class: "spacer" });
        this.el.append(this.canvas, this.spacer);
        this.ctx = this.canvas.getContext("2d");
        this.zoom = 1;
        this.mapId = 0;
        this.map = null;
        this.tileset = null;
        this.bitmaps = [];
        this.chunks = new Map();
        this.hover = null;
        this.stroke = null;
        this.pan = null;
        this.spaceDown = false;
        this.eventCursor = { x: 0, y: 0 };
        this.dragEvent = null;
        this._raf = 0;

        new ResizeObserver(() => this.resize()).observe(this.el);
        this.el.addEventListener("scroll", () => this.requestRedraw());
        this.el.addEventListener("mousedown", e => this.onMouseDown(e));
        window.addEventListener("mousemove", e => this.onMouseMove(e));
        window.addEventListener("mouseup", e => this.onMouseUp(e));
        this.el.addEventListener("dblclick", e => this.onDoubleClick(e));
        this.el.addEventListener("contextmenu", e => e.preventDefault());
        this.el.addEventListener("mouseleave", () => {
            this.hover = null;
            this.requestRedraw();
            this.app.updateStatus();
        });
        this.el.addEventListener("wheel", e => this.onWheel(e), { passive: false });
        this.el.addEventListener("keydown", e => this.onKeyDown(e));
        this.el.addEventListener("keyup", e => {
            if (e.key === " ") this.spaceDown = false;
        });
        onImageLoaded(() => {
            this.chunks.clear();
            this.requestRedraw();
        });
    }

    // --- map binding ---------------------------------------------------------

    setMap(mapId, map) {
        this.mapId = mapId;
        this.map = map;
        this.refreshTileset();
        this.eventCursor = { x: 0, y: 0 };
        this.updateSpacer();
        this.requestRedraw();
    }

    clearMap() {
        this.mapId = 0;
        this.map = null;
        this.chunks.clear();
        this.updateSpacer();
        this.requestRedraw();
    }

    refreshTileset() {
        if (!this.map) return;
        this.tileset = this.store.data.Tilesets[this.map.tilesetId] || null;
        this.bitmaps = tilesetBitmaps(this.tileset);
        this.chunks.clear();
        this.requestRedraw();
    }

    // Called after map data changed; cells: Set("x,y") or null for all.
    invalidate(cells) {
        if (!cells) {
            this.chunks.clear();
        } else {
            for (const key of cells) {
                const [x, y] = key.split(",").map(Number);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        this.chunks.delete(Math.floor((x + dx) / CHUNK) + "," + Math.floor((y + dy) / CHUNK));
                    }
                }
            }
        }
        this.requestRedraw();
    }

    setZoom(zoom, anchor) {
        zoom = Math.max(0.25, Math.min(3, zoom));
        if (zoom === this.zoom) return;
        const rect = this.el.getBoundingClientRect();
        const ax = anchor ? anchor.x - rect.left : rect.width / 2;
        const ay = anchor ? anchor.y - rect.top : rect.height / 2;
        const worldX = (this.el.scrollLeft + ax) / this.zoom;
        const worldY = (this.el.scrollTop + ay) / this.zoom;
        this.zoom = zoom;
        this.updateSpacer();
        this.el.scrollLeft = worldX * zoom - ax;
        this.el.scrollTop = worldY * zoom - ay;
        this.requestRedraw();
        this.app.bus.emit("zoom-changed", zoom);
    }

    updateSpacer() {
        const w = this.map ? this.map.width * TILE * this.zoom : 0;
        const hh = this.map ? this.map.height * TILE * this.zoom : 0;
        this.spacer.style.width = w + "px";
        this.spacer.style.height = hh + "px";
    }

    resize() {
        const w = this.el.clientWidth, hh = this.el.clientHeight;
        if (this.canvas.width !== w || this.canvas.height !== hh) {
            this.canvas.width = Math.max(1, w);
            this.canvas.height = Math.max(1, hh);
            this.canvas.style.marginBottom = -hh + "px";
            this.requestRedraw();
        }
    }

    requestRedraw() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this.draw();
        });
    }

    // --- rendering -------------------------------------------------------------

    getChunk(cx, cy) {
        const key = cx + "," + cy;
        let canvas = this.chunks.get(key);
        if (canvas) return canvas;
        canvas = document.createElement("canvas");
        canvas.width = CHUNK * TILE;
        canvas.height = CHUNK * TILE;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        const map = this.map;
        const flags = this.tileset ? this.tileset.flags : [];
        const x0 = cx * CHUNK, y0 = cy * CHUNK;
        for (let y = y0; y < Math.min(map.height, y0 + CHUNK); y++) {
            for (let x = x0; x < Math.min(map.width, x0 + CHUNK); x++) {
                const dx = (x - x0) * TILE, dy = (y - y0) * TILE;
                for (let z = 0; z < 4; z++) {
                    const id = map.data[(z * map.height + y) * map.width + x];
                    if (id) window.Tilemap.drawTile(ctx, this.bitmaps, id, dx, dy, TILE, TILE, 0, flags);
                    if (z === 1) this.drawShadow(ctx, map.data[(4 * map.height + y) * map.width + x], dx, dy);
                }
            }
        }
        this.chunks.set(key, canvas);
        return canvas;
    }

    drawShadow(ctx, bits, dx, dy) {
        if (!(bits & 15)) return;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 4; i++) {
            if (bits & (1 << i)) ctx.fillRect(dx + (i % 2) * 24, dy + Math.floor(i / 2) * 24, 24, 24);
        }
    }

    draw() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#151618";
        ctx.fillRect(0, 0, W, H);
        const map = this.map;
        if (!map) return;
        const z = this.zoom;
        const sx = this.el.scrollLeft, sy = this.el.scrollTop;
        const mapW = map.width * TILE * z, mapH = map.height * TILE * z;
        ctx.fillStyle = "#000";
        ctx.fillRect(-sx, -sy, mapW, mapH);
        this.drawParallax(ctx, sx, sy, mapW, mapH);
        const cs = CHUNK * TILE * z;
        const cx0 = Math.max(0, Math.floor(sx / cs)), cy0 = Math.max(0, Math.floor(sy / cs));
        const cx1 = Math.min(Math.ceil(map.width / CHUNK) - 1, Math.floor((sx + W) / cs));
        const cy1 = Math.min(Math.ceil(map.height / CHUNK) - 1, Math.floor((sy + H) / cs));
        for (let cy = cy0; cy <= cy1; cy++) {
            for (let cx = cx0; cx <= cx1; cx++) {
                ctx.drawImage(this.getChunk(cx, cy), cx * cs - sx, cy * cs - sy, cs, cs);
            }
        }
        const mode = this.app.mode;
        ctx.save();
        ctx.translate(-sx, -sy);
        ctx.scale(z, z);
        const vx0 = Math.floor(sx / (TILE * z)), vy0 = Math.floor(sy / (TILE * z));
        const vx1 = Math.min(map.width - 1, Math.floor((sx + W) / (TILE * z)));
        const vy1 = Math.min(map.height - 1, Math.floor((sy + H) / (TILE * z)));
        if (mode === "region") this.drawRegions(ctx, vx0, vy0, vx1, vy1);
        if (mode !== "map" || this.app.settings.showGrid) this.drawGrid(ctx, vx0, vy0, vx1, vy1);
        this.drawEvents(ctx, mode === "event");
        this.drawStartPositions(ctx);
        this.drawCursor(ctx);
        ctx.restore();
    }

    drawParallax(ctx, sx, sy, mapW, mapH) {
        const map = this.map;
        if (!map.parallaxShow || !map.parallaxName) return;
        const bmp = loadImage("parallaxes", map.parallaxName);
        if (!bmp || !bmp.isReady() || !bmp.source || !bmp.width) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-sx, -sy, mapW, mapH);
        ctx.clip();
        const w = bmp.width * this.zoom, hh = bmp.height * this.zoom;
        for (let y = -sy; y < -sy + mapH; y += hh) {
            for (let x = -sx; x < -sx + mapW; x += w) ctx.drawImage(bmp.source, x, y, w, hh);
        }
        ctx.restore();
    }

    drawGrid(ctx, x0, y0, x1, y1) {
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1 / this.zoom;
        ctx.beginPath();
        for (let x = x0; x <= x1 + 1; x++) {
            ctx.moveTo(x * TILE, y0 * TILE);
            ctx.lineTo(x * TILE, (y1 + 1) * TILE);
        }
        for (let y = y0; y <= y1 + 1; y++) {
            ctx.moveTo(x0 * TILE, y * TILE);
            ctx.lineTo((x1 + 1) * TILE, y * TILE);
        }
        ctx.stroke();
    }

    drawRegions(ctx, x0, y0, x1, y1) {
        const map = this.map;
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const r = map.data[(5 * map.height + y) * map.width + x];
                if (!r) continue;
                ctx.fillStyle = regionColor(r, 0.45);
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                ctx.fillStyle = "#fff";
                ctx.fillText(String(r), x * TILE + 24, y * TILE + 25);
            }
        }
    }

    drawEvents(ctx, eventMode) {
        const map = this.map;
        for (const ev of map.events) {
            if (!ev) continue;
            const x = ev.x * TILE, y = ev.y * TILE;
            const page = ev.pages[0];
            if (eventMode) {
                ctx.fillStyle = "rgba(255,255,255,0.18)";
                ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
            }
            this.drawEventGraphic(ctx, page, x, y);
            if (eventMode) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
            }
        }
    }

    drawEventGraphic(ctx, page, x, y) {
        if (!page) return;
        const img = page.image;
        if (img.tileId > 0) {
            window.Tilemap.drawTile(ctx, this.bitmaps, img.tileId, x, y, TILE, TILE, 0, this.tileset ? this.tileset.flags : []);
        } else if (img.characterName) {
            const f = characterFrame(img.characterName, img.characterIndex, img.direction, img.pattern);
            if (f) {
                const scale = Math.min(1, (TILE - 4) / f.sh, (TILE - 4) / f.sw);
                const w = f.sw * scale, hh = f.sh * scale;
                ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, x + (TILE - w) / 2, y + TILE - hh - 2, w, hh);
            } else {
                this.app.requestRedrawSoon();
            }
        }
    }

    drawStartPositions(ctx) {
        const system = this.store.system;
        const marks = [];
        if (system.startMapId === this.mapId) marks.push({ x: system.startX, y: system.startY, label: "S", color: "#3d7bd9" });
        for (const [key, label] of [["boat", "B"], ["ship", "Sh"], ["airship", "A"]]) {
            const v = system[key];
            if (v && v.startMapId === this.mapId) marks.push({ x: v.startX, y: v.startY, label, color: "#d98f3d", vehicle: v });
        }
        for (const m of marks) {
            const x = m.x * TILE, y = m.y * TILE;
            if (m.label === "S") {
                const actor = this.store.data.Actors[system.partyMembers[0]];
                if (actor && actor.characterName) {
                    const f = characterFrame(actor.characterName, actor.characterIndex, 2, 1);
                    if (f) ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, x + (TILE - f.sw) / 2, y + TILE - f.sh, f.sw, f.sh);
                }
            } else if (m.vehicle.characterName) {
                const f = characterFrame(m.vehicle.characterName, m.vehicle.characterIndex, 4, 1);
                if (f) ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, x + (TILE - f.sw) / 2, y + TILE - f.sh, f.sw, f.sh);
            }
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = m.color;
            ctx.fillRect(x + 2, y + 2, 18, 14);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(m.label, x + 5, y + 3);
        }
    }

    drawCursor(ctx) {
        const mode = this.app.mode;
        ctx.lineWidth = 2 / this.zoom;
        if (mode === "event") {
            const c = this.eventCursor;
            ctx.strokeStyle = "#ffd33d";
            ctx.lineWidth = 3;
            ctx.strokeRect(c.x * TILE + 1.5, c.y * TILE + 1.5, TILE - 3, TILE - 3);
            return;
        }
        if (this.stroke && (this.stroke.tool === "rect" || this.stroke.tool === "ellipse") && this.stroke.end) {
            const cells = this.stroke.tool === "rect"
                ? P.rectCells(this.stroke.start.x, this.stroke.start.y, this.stroke.end.x, this.stroke.end.y)
                : P.ellipseCells(this.stroke.start.x, this.stroke.start.y, this.stroke.end.x, this.stroke.end.y);
            ctx.fillStyle = "rgba(61,123,217,0.35)";
            for (const [x, y] of cells) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
        if (this.pick && this.pick.end) {
            const r = normRect(this.pick.start, this.pick.end);
            ctx.strokeStyle = "#ffd33d";
            ctx.strokeRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
            return;
        }
        if (!this.hover) return;
        const brush = this.currentBrush();
        const w = brush ? brush.w : 1, hh = brush ? brush.h : 1;
        ctx.strokeStyle = "#fff";
        if (this.app.tool === "shadow" && mode === "map") {
            const q = this.hover.quarter || 0;
            ctx.strokeRect(this.hover.x * TILE + (q % 2) * 24, this.hover.y * TILE + Math.floor(q / 2) * 24, 24, 24);
        } else {
            ctx.strokeRect(this.hover.x * TILE, this.hover.y * TILE, w * TILE, hh * TILE);
        }
    }

    // --- coordinates -------------------------------------------------------

    cellAt(e) {
        const r = this.el.getBoundingClientRect();
        const px = (e.clientX - r.left + this.el.scrollLeft) / this.zoom;
        const py = (e.clientY - r.top + this.el.scrollTop) / this.zoom;
        const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
        const quarter = (px % TILE >= 24 ? 1 : 0) + (py % TILE >= 24 ? 2 : 0);
        return { x, y, quarter, inside: this.map && P.inBounds(this.map, x, y) };
    }

    currentBrush() {
        if (this.app.mode === "region") return { w: 1, h: 1, tiles: [this.app.palette.regionId] };
        return this.app.palette.getBrush();
    }

    // --- mouse -------------------------------------------------------------------

    onMouseDown(e) {
        this.el.focus();
        if (!this.map) return;
        if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
            e.preventDefault();
            this.pan = { x: e.clientX, y: e.clientY, sl: this.el.scrollLeft, st: this.el.scrollTop };
            return;
        }
        const cell = this.cellAt(e);
        if (e.target === this.el && e.offsetX >= this.el.clientWidth) return; // scrollbar
        if (this.app.mode === "event") return this.onEventMouseDown(e, cell);
        if (!cell.inside) return;
        if (e.button === 0) this.beginStroke(cell);
        else if (e.button === 2) this.pick = { start: cell, end: cell };
        this.requestRedraw();
    }

    onMouseMove(e) {
        if (this.pan) {
            this.el.scrollLeft = this.pan.sl - (e.clientX - this.pan.x);
            this.el.scrollTop = this.pan.st - (e.clientY - this.pan.y);
            return;
        }
        if (!this.map) return;
        const inView = e.target === this.canvas || e.target === this.el || this.el.contains(e.target);
        const cell = this.cellAt(e);
        if (inView || this.stroke || this.pick || this.dragEvent) {
            const prev = this.hover;
            this.hover = cell.inside ? cell : null;
            if (!prev || !this.hover || prev.x !== cell.x || prev.y !== cell.y || prev.quarter !== cell.quarter) {
                this.app.updateStatus();
                this.requestRedraw();
            }
        }
        if (this.stroke && cell.inside) this.continueStroke(cell);
        if (this.pick) {
            this.pick.end = { x: clamp(cell.x, 0, this.map.width - 1), y: clamp(cell.y, 0, this.map.height - 1) };
            this.requestRedraw();
        }
        if (this.dragEvent && cell.inside) {
            this.dragEvent.to = { x: cell.x, y: cell.y };
            this.eventCursor = { x: cell.x, y: cell.y };
            this.requestRedraw();
        }
    }

    onMouseUp(e) {
        if (this.pan) {
            this.pan = null;
            return;
        }
        if (this.stroke) this.endStroke();
        if (this.pick) this.endPick();
        if (this.dragEvent) this.endEventDrag();
    }

    onDoubleClick(e) {
        if (!this.map || this.app.mode !== "event") return;
        const cell = this.cellAt(e);
        if (!cell.inside) return;
        this.eventCursor = { x: cell.x, y: cell.y };
        this.app.events.editAt(cell.x, cell.y);
    }

    onWheel(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            this.setZoom(this.zoom * (e.deltaY < 0 ? 1.25 : 0.8), { x: e.clientX, y: e.clientY });
        }
    }

    onKeyDown(e) {
        if (e.key === " ") {
            this.spaceDown = true;
            e.preventDefault();
            return;
        }
        if (this.app.mode !== "event" || !this.map) return;
        const c = this.eventCursor;
        const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (move && !e.ctrlKey) {
            e.preventDefault();
            c.x = clamp(c.x + move[0], 0, this.map.width - 1);
            c.y = clamp(c.y + move[1], 0, this.map.height - 1);
            this.scrollToCell(c.x, c.y);
            this.app.updateStatus();
            this.requestRedraw();
        } else if (e.key === "Enter") {
            e.preventDefault();
            this.app.events.editAt(c.x, c.y);
        }
    }

    scrollToCell(x, y) {
        const z = this.zoom;
        const left = x * TILE * z, top = y * TILE * z;
        const el = this.el;
        if (left < el.scrollLeft) el.scrollLeft = left;
        if (top < el.scrollTop) el.scrollTop = top;
        if (left + TILE * z > el.scrollLeft + el.clientWidth) el.scrollLeft = left + TILE * z - el.clientWidth;
        if (top + TILE * z > el.scrollTop + el.clientHeight) el.scrollTop = top + TILE * z - el.clientHeight;
    }

    // --- drawing tools ---------------------------------------------------------

    beginStroke(cell) {
        const tool = this.app.tool;
        const mode = this.app.mode;
        const brush = this.currentBrush();
        if (!brush) return;
        const session = new P.EditSession(this.map);
        this.stroke = { tool, mode, brush, session, start: cell, last: cell, end: cell };
        const tsMode = this.tileset ? this.tileset.mode : 1;
        if (tool === "pencil") {
            this.paintAt(cell.x, cell.y);
        } else if (tool === "fill") {
            const layers = mode === "region" ? [5] : [0, 1, 2, 3];
            const cells = P.floodCells(this.map, cell.x, cell.y, layers);
            if (mode === "region") for (const [x, y] of cells) P.setRegion(session, x, y, brush.tiles[0]);
            else P.paintCells(session, cells, brush, cell.x, cell.y, tsMode);
            this.endStroke();
        } else if (tool === "shadow" && mode === "map") {
            this.stroke.shadowOn = !P.shadowQuarterOn(this.map, cell.x, cell.y, cell.quarter);
            P.setShadowQuarter(session, cell.x, cell.y, cell.quarter, this.stroke.shadowOn);
            this.invalidate(session.touched);
        }
    }

    paintAt(x, y) {
        const s = this.stroke;
        const tsMode = this.tileset ? this.tileset.mode : 1;
        if (s.mode === "region") {
            P.setRegion(s.session, x, y, s.brush.tiles[0]);
        } else if (s.brush.layers) {
            // Brush copied from the map (all four layers).
            for (let by = 0; by < s.brush.h; by++) {
                for (let bx = 0; bx < s.brush.w; bx++) {
                    const cellLayers = s.brush.layers[by * s.brush.w + bx];
                    for (let z = 0; z < 4; z++) s.session.set(x + bx, y + by, z, cellLayers[z]);
                }
            }
            P.refreshAutotiles(s.session);
        } else {
            const cells = [];
            for (let by = 0; by < s.brush.h; by++) for (let bx = 0; bx < s.brush.w; bx++) cells.push([x + bx, y + by]);
            P.paintCells(s.session, cells, s.brush, s.start.x, s.start.y, tsMode);
        }
        this.invalidate(new Set(s.session.touched));
    }

    continueStroke(cell) {
        const s = this.stroke;
        if (s.last && s.last.x === cell.x && s.last.y === cell.y && s.last.quarter === cell.quarter) return;
        if (s.tool === "pencil") {
            for (const [x, y] of P.lineCells(s.last.x, s.last.y, cell.x, cell.y).slice(1)) this.paintAt(x, y);
        } else if (s.tool === "shadow" && s.mode === "map") {
            P.setShadowQuarter(s.session, cell.x, cell.y, cell.quarter, s.shadowOn);
            this.invalidate(s.session.touched);
        } else if (s.tool === "rect" || s.tool === "ellipse") {
            s.end = cell;
            this.requestRedraw();
        }
        s.last = cell;
    }

    endStroke() {
        const s = this.stroke;
        this.stroke = null;
        if (!s) return;
        const tsMode = this.tileset ? this.tileset.mode : 1;
        if (s.tool === "rect" || s.tool === "ellipse") {
            const cells = s.tool === "rect" ? P.rectCells(s.start.x, s.start.y, s.end.x, s.end.y) : P.ellipseCells(s.start.x, s.start.y, s.end.x, s.end.y);
            if (s.mode === "region") for (const [x, y] of cells) P.setRegion(s.session, x, y, s.brush.tiles[0]);
            else P.paintCells(s.session, cells, s.brush, s.start.x, s.start.y, tsMode);
        }
        const diff = s.session.diff();
        if (diff.length) this.app.commitMapDiff(this.mapId, diff, labelFor(s));
        this.invalidate(P.diffCells(this.map, diff));
    }

    endPick() {
        const p = this.pick;
        this.pick = null;
        const r = normRect(p.start, p.end || p.start);
        if (this.app.mode === "region") {
            this.app.palette.selectRegion(P.getTile(this.map, r.x, r.y, 5));
        } else if (r.w === 1 && r.h === 1) {
            const picked = P.pickTile(this.map, r.x, r.y);
            this.app.palette.selectTile(picked.tileId);
        } else {
            const layers = [];
            for (let y = r.y; y < r.y + r.h; y++) {
                for (let x = r.x; x < r.x + r.w; x++) {
                    layers.push([0, 1, 2, 3].map(z => P.baseTileId(P.getTile(this.map, x, y, z))));
                }
            }
            this.app.palette.setCustomBrush({ w: r.w, h: r.h, tiles: layers.map(l => l[3] || l[2] || l[1] || l[0]), layers });
        }
        this.requestRedraw();
    }

    // --- event mode ------------------------------------------------------------

    onEventMouseDown(e, cell) {
        if (!cell.inside) return;
        this.eventCursor = { x: cell.x, y: cell.y };
        this.app.updateStatus();
        const ev = this.app.events.eventAt(cell.x, cell.y);
        if (e.button === 0 && ev) this.dragEvent = { id: ev.id, from: { x: cell.x, y: cell.y }, to: null };
        if (e.button === 2) this.app.events.showContextMenu(e.clientX, e.clientY, cell.x, cell.y);
        this.requestRedraw();
    }

    endEventDrag() {
        const d = this.dragEvent;
        this.dragEvent = null;
        if (d.to && (d.to.x !== d.from.x || d.to.y !== d.from.y)) this.app.events.moveEvent(d.id, d.to.x, d.to.y);
    }
}

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

function normRect(a, b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

function labelFor(stroke) {
    if (stroke.mode === "region") return "Region";
    return { pencil: "Pencil", rect: "Rectangle", ellipse: "Ellipse", fill: "Fill", shadow: "Shadow Pen" }[stroke.tool] || "Draw";
}

export function regionColor(r, alpha = 1) {
    const hue = (r * 137.508) % 360;
    return `hsla(${hue}, 70%, 50%, ${alpha})`;
}
