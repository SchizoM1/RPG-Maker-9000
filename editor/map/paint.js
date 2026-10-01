// paint.js — pure map editing logic (no DOM). Uses the runtime's TileUtils
// (global) so painting and rendering share one set of autotile rules.
//
// Map data layout (MZ): data[(z * height + y) * width + x], z = 0..5
//   0,1: A-tile layers   2,3: upper (B-E) layers   4: shadows   5: regions

const TU = () => globalThis.TileUtils;

export const LAYER_SHADOW = 4;
export const LAYER_REGION = 5;

export function tileIndex(map, x, y, z) {
    return (z * map.height + y) * map.width + x;
}

export function inBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function getTile(map, x, y, z) {
    if (!inBounds(map, x, y)) return 0;
    return map.data[tileIndex(map, x, y, z)] || 0;
}

// Records every changed cell so the edit can be undone.
export class EditSession {
    constructor(map) {
        this.map = map;
        this.changes = new Map(); // index -> original value
        this.touched = new Set(); // "x,y"
    }

    get(x, y, z) {
        return getTile(this.map, x, y, z);
    }

    set(x, y, z, value) {
        if (!inBounds(this.map, x, y)) return;
        const i = tileIndex(this.map, x, y, z);
        const old = this.map.data[i] || 0;
        if (old === value) return;
        if (!this.changes.has(i)) this.changes.set(i, old);
        this.map.data[i] = value;
        this.touched.add(x + "," + y);
    }

    isEmpty() {
        for (const [i, old] of this.changes) if (this.map.data[i] !== old) return false;
        return true;
    }

    // Returns [[index, oldValue, newValue], ...] for the undo stack.
    diff() {
        const out = [];
        for (const [i, old] of this.changes) {
            if (this.map.data[i] !== old) out.push([i, old, this.map.data[i]]);
        }
        return out;
    }
}

export function applyDiff(map, diff, undo) {
    for (const [i, oldValue, newValue] of diff) map.data[i] = undo ? oldValue : newValue;
}

// Cells touched by a diff (for redraw), as a Set of "x,y".
export function diffCells(map, diff) {
    const cells = new Set();
    const plane = map.width * map.height;
    for (const [i] of diff) {
        const rem = i % plane;
        cells.add((rem % map.width) + "," + Math.floor(rem / map.width));
    }
    return cells;
}

//-----------------------------------------------------------------------------
// Layer rules

// Autotiles that decorate the ground and go on layer 1 instead of layer 0.
export function isOverlayTile(tileId, tilesetMode) {
    const T = TU();
    if (T.isTileA1(tileId)) {
        const kind = T.getAutotileKind(tileId);
        return kind === 2 || kind === 3;
    }
    if (T.isTileA2(tileId) && tilesetMode === 1) {
        const kind = T.getAutotileKind(tileId) - 16;
        return kind % 8 >= 4;
    }
    return false;
}

export function isATile(tileId) {
    const T = TU();
    return T.isAutotile(tileId) || T.isTileA5(tileId);
}

// Places one tile using MZ's automatic layer choice. Tile 0 of sheet B
// (the blank) erases the upper layers.
export function placeTile(session, x, y, tileId, tilesetMode) {
    if (!inBounds(session.map, x, y)) return;
    const T = TU();
    if (tileId === 0) {
        session.set(x, y, 2, 0);
        session.set(x, y, 3, 0);
        return;
    }
    if (isATile(tileId)) {
        if (isOverlayTile(tileId, tilesetMode)) {
            session.set(x, y, 1, tileId);
        } else {
            session.set(x, y, 0, tileId);
            session.set(x, y, 1, 0);
        }
        return;
    }
    const z2 = session.get(x, y, 2);
    const z3 = session.get(x, y, 3);
    if (z2 === tileId || z3 === tileId) return;
    if (!z2) session.set(x, y, 2, tileId);
    else session.set(x, y, 3, tileId);
    void T;
}

// Clears everything visible at a cell (Eraser tool): layers 0-3.
export function eraseCell(session, x, y) {
    for (let z = 0; z < 4; z++) session.set(x, y, z, 0);
}

// Recomputes autotile shapes for the touched cells and their neighbours.
export function refreshAutotiles(session, cells = session.touched) {
    const T = TU();
    const map = session.map;
    const targets = new Set();
    for (const key of cells) {
        const [cx, cy] = key.split(",").map(Number);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = cx + dx, y = cy + dy;
                if (inBounds(map, x, y)) targets.add(x + "," + y);
            }
        }
    }
    for (const key of targets) {
        const [x, y] = key.split(",").map(Number);
        for (let z = 0; z < 2; z++) {
            const tileId = getTile(map, x, y, z);
            if (!T.isAutotile(tileId)) continue;
            const get = (tx, ty) => (inBounds(map, tx, ty) ? getTile(map, tx, ty, z) : null);
            const shaped = T.computeAutotileId(tileId, x, y, get);
            if (shaped !== tileId) {
                const i = tileIndex(map, x, y, z);
                if (!session.changes.has(i)) session.changes.set(i, tileId);
                map.data[i] = shaped;
            }
        }
    }
}

// Normalises an autotile ID to its kind's base (shape 0) for palette use.
export function baseTileId(tileId) {
    const T = TU();
    return T.isAutotile(tileId) ? T.makeAutotileId(T.getAutotileKind(tileId), 0) : tileId;
}

// Right-click pick: the topmost visible tile at a cell.
export function pickTile(map, x, y) {
    for (let z = 3; z >= 0; z--) {
        const id = getTile(map, x, y, z);
        if (id) return { tileId: baseTileId(id), layer: z };
    }
    return { tileId: 0, layer: 0 };
}

//-----------------------------------------------------------------------------
// Shapes

export function lineCells(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        cells.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
    return cells;
}

export function rectCells(x0, y0, x1, y1) {
    const cells = [];
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) cells.push([x, y]);
    return cells;
}

export function ellipseCells(x0, y0, x1, y1) {
    const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
    const cx = (ax + bx) / 2, cy = (ay + by) / 2;
    const rx = (bx - ax + 1) / 2, ry = (by - ay + 1) / 2;
    const cells = [];
    for (let y = ay; y <= by; y++) {
        for (let x = ax; x <= bx; x++) {
            const nx = (x - cx) / rx, ny = (y - cy) / ry;
            if (nx * nx + ny * ny <= 1.0001) cells.push([x, y]);
        }
    }
    return cells;
}

// Signature used by flood fill: autotiles compare by kind.
function cellSignature(map, x, y, layers) {
    const T = TU();
    return layers
        .map(z => {
            const id = getTile(map, x, y, z);
            return T.isAutotile(id) ? "k" + T.getAutotileKind(id) : String(id);
        })
        .join("|");
}

export function floodCells(map, x, y, layers = [0, 1, 2, 3]) {
    if (!inBounds(map, x, y)) return [];
    const target = cellSignature(map, x, y, layers);
    const seen = new Uint8Array(map.width * map.height);
    const out = [];
    const stack = [[x, y]];
    while (stack.length) {
        const [cx, cy] = stack.pop();
        if (!inBounds(map, cx, cy)) continue;
        const k = cy * map.width + cx;
        if (seen[k]) continue;
        seen[k] = 1;
        if (cellSignature(map, cx, cy, layers) !== target) continue;
        out.push([cx, cy]);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return out;
}

// A brush is a rectangle of tile IDs: {w, h, tiles: [row-major]}.
export function brushTileAt(brush, originX, originY, x, y) {
    const bx = (((x - originX) % brush.w) + brush.w) % brush.w;
    const by = (((y - originY) % brush.h) + brush.h) % brush.h;
    return brush.tiles[by * brush.w + bx];
}

export function paintCells(session, cells, brush, originX, originY, tilesetMode) {
    for (const [x, y] of cells) {
        placeTile(session, x, y, brushTileAt(brush, originX, originY, x, y), tilesetMode);
    }
    refreshAutotiles(session);
}

// Stamps a brush with its top-left at (x, y) (pencil with multi-tile brush).
export function stampBrush(session, x, y, brush, tilesetMode) {
    for (let by = 0; by < brush.h; by++) {
        for (let bx = 0; bx < brush.w; bx++) {
            placeTile(session, x + bx, y + by, brush.tiles[by * brush.w + bx], tilesetMode);
        }
    }
    refreshAutotiles(session);
}

//-----------------------------------------------------------------------------
// Shadows and regions

// quarter: 0 TL, 1 TR, 2 BL, 3 BR
export function setShadowQuarter(session, x, y, quarter, on) {
    const bits = session.get(x, y, LAYER_SHADOW);
    const bit = 1 << quarter;
    session.set(x, y, LAYER_SHADOW, on ? bits | bit : bits & ~bit);
}

export function shadowQuarterOn(map, x, y, quarter) {
    return !!(getTile(map, x, y, LAYER_SHADOW) & (1 << quarter));
}

export function setRegion(session, x, y, regionId) {
    session.set(x, y, LAYER_REGION, regionId);
}

//-----------------------------------------------------------------------------
// Map resizing (Map Properties). anchor: 0..8 = TL, T, TR, L, C, R, BL, B, BR

export function resizeMapData(map, newWidth, newHeight, anchor = 0) {
    const ax = anchor % 3, ay = Math.floor(anchor / 3);
    const offsetX = ax === 0 ? 0 : ax === 1 ? Math.floor((newWidth - map.width) / 2) : newWidth - map.width;
    const offsetY = ay === 0 ? 0 : ay === 1 ? Math.floor((newHeight - map.height) / 2) : newHeight - map.height;
    const data = new Array(newWidth * newHeight * 6).fill(0);
    for (let z = 0; z < 6; z++) {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const nx = x + offsetX, ny = y + offsetY;
                if (nx < 0 || ny < 0 || nx >= newWidth || ny >= newHeight) continue;
                data[(z * newHeight + ny) * newWidth + nx] = map.data[(z * map.height + y) * map.width + x] || 0;
            }
        }
    }
    const events = map.events.map(ev => {
        if (!ev) return ev;
        return { ...ev, x: ev.x + offsetX, y: ev.y + offsetY };
    }).map(ev => (ev && (ev.x < 0 || ev.y < 0 || ev.x >= newWidth || ev.y >= newHeight) ? null : ev));
    return { data, events, offsetX, offsetY };
}
