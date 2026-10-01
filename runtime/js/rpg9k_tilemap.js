//=============================================================================
// rpg9k_tilemap.js — tile ID math, autotile shapes and the Canvas tilemap.
// TileUtils is shared with the editor so painting and rendering agree.
//=============================================================================
"use strict";

//-----------------------------------------------------------------------------
// TileUtils — pure tile ID helpers (no DOM)

var TileUtils = (() => {
    const T = {
        TILE_ID_B: 0,
        TILE_ID_C: 256,
        TILE_ID_D: 512,
        TILE_ID_E: 768,
        TILE_ID_A5: 1536,
        TILE_ID_A1: 2048,
        TILE_ID_A2: 2816,
        TILE_ID_A3: 4352,
        TILE_ID_A4: 5888,
        TILE_ID_MAX: 8192
    };

    // Quarter-tile source positions for each autotile shape, derived from the
    // block layouts rather than hand-typed. Each entry is [TL, TR, BL, BR] with
    // [qx, qy] in half-tile units inside the autotile block.
    //
    // Floor blocks are 2x3 tiles (4x6 quarters): the top-left tile is the
    // isolated preview, the top-right tile holds inner corners, and the bottom
    // 2x2 tiles hold the edges and interior.
    function floorQuarter(corner, sideA, sideB, diag) {
        // corner: 0 TL, 1 TR, 2 BL, 3 BR. sideA is the horizontal neighbour
        // (left/right), sideB the vertical one (up/down); true = same kind.
        const table = [
            // interior, inner corner, horizontal edge, vertical edge, outer corner
            [[2, 4], [2, 0], [0, 4], [2, 2], [0, 2]],
            [[1, 4], [3, 0], [3, 4], [1, 2], [3, 2]],
            [[2, 3], [2, 1], [0, 3], [2, 5], [0, 5]],
            [[1, 3], [3, 1], [3, 3], [1, 5], [3, 5]]
        ][corner];
        if (sideA && sideB) return diag ? table[0] : table[1];
        if (!sideA && sideB) return table[2];
        if (sideA && !sideB) return table[3];
        return table[4];
    }

    function buildFloorTable() {
        const table = [];
        const add = q => table.push(q);
        // 0-15: all four sides connected; bits = missing diagonals (TL,TR,BR,BL)
        for (let i = 0; i < 16; i++) {
            add([
                floorQuarter(0, true, true, !(i & 1)),
                floorQuarter(1, true, true, !(i & 2)),
                floorQuarter(2, true, true, !(i & 8)),
                floorQuarter(3, true, true, !(i & 4))
            ]);
        }
        // 16-19: left open; bits = TR, BR diagonals missing
        for (let i = 0; i < 4; i++) {
            add([
                floorQuarter(0, false, true, true),
                floorQuarter(1, true, true, !(i & 1)),
                floorQuarter(2, false, true, true),
                floorQuarter(3, true, true, !(i & 2))
            ]);
        }
        // 20-23: top open; bits = BR, BL
        for (let i = 0; i < 4; i++) {
            add([
                floorQuarter(0, true, false, true),
                floorQuarter(1, true, false, true),
                floorQuarter(2, true, true, !(i & 2)),
                floorQuarter(3, true, true, !(i & 1))
            ]);
        }
        // 24-27: right open; bits = BL, TL
        for (let i = 0; i < 4; i++) {
            add([
                floorQuarter(0, true, true, !(i & 2)),
                floorQuarter(1, false, true, true),
                floorQuarter(2, true, true, !(i & 1)),
                floorQuarter(3, false, true, true)
            ]);
        }
        // 28-31: bottom open; bits = TL, TR
        for (let i = 0; i < 4; i++) {
            add([
                floorQuarter(0, true, true, !(i & 1)),
                floorQuarter(1, true, true, !(i & 2)),
                floorQuarter(2, true, false, true),
                floorQuarter(3, true, false, true)
            ]);
        }
        // 32: left+right open, 33: top+bottom open
        add([floorQuarter(0, false, true), floorQuarter(1, false, true), floorQuarter(2, false, true), floorQuarter(3, false, true)]);
        add([floorQuarter(0, true, false), floorQuarter(1, true, false), floorQuarter(2, true, false), floorQuarter(3, true, false)]);
        // 34-35: top+left open (bit: BR)
        for (let i = 0; i < 2; i++) {
            add([floorQuarter(0, false, false), floorQuarter(1, true, false), floorQuarter(2, false, true), floorQuarter(3, true, true, !(i & 1))]);
        }
        // 36-37: top+right open (bit: BL)
        for (let i = 0; i < 2; i++) {
            add([floorQuarter(0, true, false), floorQuarter(1, false, false), floorQuarter(2, true, true, !(i & 1)), floorQuarter(3, false, true)]);
        }
        // 38-39: bottom+right open (bit: TL)
        for (let i = 0; i < 2; i++) {
            add([floorQuarter(0, true, true, !(i & 1)), floorQuarter(1, false, true), floorQuarter(2, true, false), floorQuarter(3, false, false)]);
        }
        // 40-41: bottom+left open (bit: TR)
        for (let i = 0; i < 2; i++) {
            add([floorQuarter(0, false, true), floorQuarter(1, true, true, !(i & 1)), floorQuarter(2, false, false), floorQuarter(3, true, false)]);
        }
        // 42: top+left+right, 43: top+left+bottom, 44: left+bottom+right,
        // 45: top+right+bottom, 46: all open, 47: isolated preview tile
        add([floorQuarter(0, false, false), floorQuarter(1, false, false), floorQuarter(2, false, true), floorQuarter(3, false, true)]);
        add([floorQuarter(0, false, false), floorQuarter(1, true, false), floorQuarter(2, false, false), floorQuarter(3, true, false)]);
        add([floorQuarter(0, false, true), floorQuarter(1, false, true), floorQuarter(2, false, false), floorQuarter(3, false, false)]);
        add([floorQuarter(0, true, false), floorQuarter(1, false, false), floorQuarter(2, true, false), floorQuarter(3, false, false)]);
        add([floorQuarter(0, false, false), floorQuarter(1, false, false), floorQuarter(2, false, false), floorQuarter(3, false, false)]);
        add([[0, 0], [1, 0], [0, 1], [1, 1]]);
        return table;
    }

    // Wall blocks are 2x2 tiles; shape bits: 1 left, 2 top, 4 right, 8 bottom
    // edge present (neighbour differs).
    function buildWallTable() {
        const table = [];
        for (let i = 0; i < 16; i++) {
            const l = i & 1, t = i & 2, r = i & 4, b = i & 8;
            table.push([
                [l ? 0 : 2, t ? 0 : 2],
                [r ? 3 : 1, t ? 0 : 2],
                [l ? 0 : 2, b ? 3 : 1],
                [r ? 3 : 1, b ? 3 : 1]
            ]);
        }
        return table;
    }

    // Waterfall blocks are 2x1 tiles; bits: 1 left edge, 2 right edge.
    function buildWaterfallTable() {
        const table = [];
        for (let i = 0; i < 4; i++) {
            const l = i & 1, r = i & 2;
            table.push([[l ? 0 : 2, 0], [r ? 3 : 1, 0], [l ? 0 : 2, 1], [r ? 3 : 1, 1]]);
        }
        return table;
    }

    T.FLOOR_AUTOTILE_TABLE = buildFloorTable();
    T.WALL_AUTOTILE_TABLE = buildWallTable();
    T.WATERFALL_AUTOTILE_TABLE = buildWaterfallTable();

    const floorIndex = new Map();
    T.FLOOR_AUTOTILE_TABLE.forEach((q, i) => {
        const key = JSON.stringify(q);
        if (!floorIndex.has(key)) floorIndex.set(key, i);
    });

    T.isVisibleTile = id => id > 0 && id < T.TILE_ID_MAX;
    T.isAutotile = id => id >= T.TILE_ID_A1;
    T.getAutotileKind = id => Math.floor((id - T.TILE_ID_A1) / 48);
    T.getAutotileShape = id => (id - T.TILE_ID_A1) % 48;
    T.makeAutotileId = (kind, shape) => T.TILE_ID_A1 + kind * 48 + shape;
    T.isSameKindTile = (a, b) =>
        T.isAutotile(a) && T.isAutotile(b) ? T.getAutotileKind(a) === T.getAutotileKind(b) : a === b;
    T.isTileA1 = id => id >= T.TILE_ID_A1 && id < T.TILE_ID_A2;
    T.isTileA2 = id => id >= T.TILE_ID_A2 && id < T.TILE_ID_A3;
    T.isTileA3 = id => id >= T.TILE_ID_A3 && id < T.TILE_ID_A4;
    T.isTileA4 = id => id >= T.TILE_ID_A4 && id < T.TILE_ID_MAX;
    T.isTileA5 = id => id >= T.TILE_ID_A5 && id < T.TILE_ID_A1;
    T.isWaterTile = id => (T.isTileA1(id) ? !(id >= T.TILE_ID_A1 + 96 && id < T.TILE_ID_A1 + 192) : false);
    T.isWaterfallTile = id =>
        id >= T.TILE_ID_A1 + 192 && id < T.TILE_ID_A2 ? T.getAutotileKind(id) % 2 === 1 : false;
    T.isGroundTile = id => T.isTileA1(id) || T.isTileA2(id) || T.isTileA5(id);
    T.isShadowingTile = id => T.isTileA3(id) || T.isTileA4(id);
    T.isRoofTile = id => T.isTileA3(id) && T.getAutotileKind(id) % 16 < 8;
    T.isWallTopTile = id => T.isTileA4(id) && T.getAutotileKind(id) % 16 < 8;
    T.isWallSideTile = id => (T.isTileA3(id) || T.isTileA4(id)) && T.getAutotileKind(id) % 16 >= 8;
    T.isWallTile = id => T.isWallTopTile(id) || T.isWallSideTile(id);
    T.isFloorTypeAutotile = id =>
        (T.isTileA1(id) && !T.isWaterfallTile(id)) || T.isTileA2(id) || T.isWallTopTile(id);
    T.isWallTypeAutotile = id => T.isRoofTile(id) || T.isWallSideTile(id);
    T.isWaterfallTypeAutotile = id => T.isWaterfallTile(id);

    // Which of the 9 tileset sheets a tile ID lives on (A1..A5 = 0..4, B..E = 5..8)
    T.sheetIndex = id => {
        if (T.isTileA1(id)) return 0;
        if (T.isTileA2(id)) return 1;
        if (T.isTileA3(id)) return 2;
        if (T.isTileA4(id)) return 3;
        if (T.isTileA5(id)) return 4;
        return 5 + Math.floor(id / 256);
    };

    // Shape from neighbour connectivity. `same(dx, dy)` returns true when the
    // neighbour at the offset is the same kind (off-map counts as same).
    T.floorShape = same => {
        const L = same(-1, 0), R = same(1, 0), U = same(0, -1), D = same(0, 1);
        const quarters = [
            floorQuarter(0, L, U, same(-1, -1)),
            floorQuarter(1, R, U, same(1, -1)),
            floorQuarter(2, L, D, same(-1, 1)),
            floorQuarter(3, R, D, same(1, 1))
        ];
        const i = floorIndex.get(JSON.stringify(quarters));
        return i === undefined ? 46 : i;
    };

    T.wallShape = same => {
        return (same(-1, 0) ? 0 : 1) | (same(0, -1) ? 0 : 2) | (same(1, 0) ? 0 : 4) | (same(0, 1) ? 0 : 8);
    };

    T.waterfallShape = same => {
        return (same(-1, 0) ? 0 : 1) | (same(1, 0) ? 0 : 2);
    };

    // Computes the correct autotile ID for a cell given a tile lookup.
    // getTile(x, y) returns the tile ID on the same layer, or null if off-map.
    // A4 wall sides and A3 walls connect across the whole wall column in MZ;
    // here walls connect to any same-kind neighbour, matching MZ's editor for
    // single-wall painting.
    T.computeAutotileId = (tileId, x, y, getTile) => {
        if (!T.isAutotile(tileId)) return tileId;
        const kind = T.getAutotileKind(tileId);
        const same = (dx, dy) => {
            const t = getTile(x + dx, y + dy);
            if (t === null || t === undefined) return true;
            return T.isAutotile(t) && T.getAutotileKind(t) === kind;
        };
        let shape;
        if (T.isWaterfallTypeAutotile(tileId)) shape = T.waterfallShape(same);
        else if (T.isWallTypeAutotile(tileId)) {
            // Wall sides only look at left/right and at the vertical run.
            shape = T.wallShape(same);
        } else shape = T.floorShape(same);
        return T.makeAutotileId(kind, shape);
    };

    // Source rectangle of an autotile block in its sheet, in tile units,
    // plus which quarter table applies. animFrame drives water animation.
    T.autotileSource = (tileId, animFrame) => {
        const kind = T.getAutotileKind(tileId);
        const tx = kind % 8;
        const ty = Math.floor(kind / 8);
        let bx = 0, by = 0, setNumber = 0;
        let table = T.FLOOR_AUTOTILE_TABLE;
        let isTable = false;
        if (T.isTileA1(tileId)) {
            const waterSurfaceIndex = [0, 1, 2, 1][animFrame % 4];
            setNumber = 0;
            if (kind === 0) {
                bx = waterSurfaceIndex * 2;
                by = 0;
            } else if (kind === 1) {
                bx = waterSurfaceIndex * 2;
                by = 3;
            } else if (kind === 2) {
                bx = 6;
                by = 0;
            } else if (kind === 3) {
                bx = 6;
                by = 3;
            } else {
                bx = Math.floor(tx / 4) * 8;
                by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
                if (kind % 2 === 0) {
                    bx += waterSurfaceIndex * 2;
                } else {
                    bx += 6;
                    table = T.WATERFALL_AUTOTILE_TABLE;
                    by += animFrame % 3;
                }
            }
        } else if (T.isTileA2(tileId)) {
            setNumber = 1;
            bx = tx * 2;
            by = (ty - 2) * 3;
            isTable = true;
        } else if (T.isTileA3(tileId)) {
            setNumber = 2;
            bx = tx * 2;
            by = (ty - 6) * 2;
            table = T.WALL_AUTOTILE_TABLE;
        } else if (T.isTileA4(tileId)) {
            setNumber = 3;
            bx = tx * 2;
            by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
            if (ty % 2 === 1) table = T.WALL_AUTOTILE_TABLE;
        }
        return { setNumber, bx, by, table, isTable };
    };

    // Source rectangle for a normal (B-E, A5) tile, in pixels.
    T.normalTileSource = (tileId, tw, th) => {
        const setNumber = T.isTileA5(tileId) ? 4 : 5 + Math.floor(tileId / 256);
        const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * tw;
        const sy = (Math.floor((tileId % 256) / 8) % 16) * th;
        return { setNumber, sx, sy };
    };

    // Autotile kinds available on each A sheet, for palette building.
    T.A1_KINDS = 16;
    T.A2_KINDS = 32;
    T.A3_KINDS = 32;
    T.A4_KINDS = 48;

    // Tile flags
    T.FLAG_STAR = 0x10;
    T.FLAG_LADDER = 0x20;
    T.FLAG_BUSH = 0x40;
    T.FLAG_COUNTER = 0x80;
    T.FLAG_DAMAGE = 0x100;
    T.FLAG_BOAT = 0x200;
    T.FLAG_SHIP = 0x400;
    T.FLAG_AIRSHIP = 0x800;

    return T;
})();

//-----------------------------------------------------------------------------
// Tilemap — draws map layers with characters sorted between them.
// Lower and upper layers are painted into offscreen buffers that are only
// repainted when the view crosses a tile boundary, the animation frame
// changes, or the map data changes.

var Tilemap = class extends Container {
    initialize() {
        super.initialize();
        this._width = Graphics.width;
        this._height = Graphics.height;
        this._margin = 20;
        this._mapWidth = 0;
        this._mapHeight = 0;
        this._mapData = null;
        this._bitmaps = [];
        this.tileWidth = 48;
        this.tileHeight = 48;
        this.origin = new Point();
        this.flags = [];
        this.animationCount = 0;
        this.horizontalWrap = false;
        this.verticalWrap = false;
        this._lowerCanvas = null;
        this._upperCanvas = null;
        this._paintKey = "";
        this._needsRepaint = true;
        this._editorMode = false;
    }

    get width() {
        return this._width;
    }
    set width(v) {
        this._width = v;
        this._needsRepaint = true;
    }
    get height() {
        return this._height;
    }
    set height(v) {
        this._height = v;
        this._needsRepaint = true;
    }

    get animationFrame() {
        return Math.floor(this.animationCount / 30);
    }

    setData(width, height, data) {
        this._mapWidth = width;
        this._mapHeight = height;
        this._mapData = data;
        this._needsRepaint = true;
    }

    setBitmaps(bitmaps) {
        this._bitmaps = bitmaps;
        for (const b of bitmaps) {
            if (b) b.addLoadListener(() => (this._needsRepaint = true));
        }
        this._needsRepaint = true;
    }

    isReady() {
        return this._bitmaps.every(b => !b || b.isReady() || b.isError());
    }

    refresh() {
        this._needsRepaint = true;
    }

    refreshTileset() {
        this._needsRepaint = true;
    }

    update() {
        this.animationCount++;
        super.update();
    }

    updateTransform() {}

    render(ctx) {
        if (!this.visible || this.alpha <= 0) return;
        ctx.save();
        this._applyTransform(ctx);
        this._paintIfNeeded();
        const tw = this.tileWidth, th = this.tileHeight;
        const ox = Math.round(this.origin.x), oy = Math.round(this.origin.y);
        const startX = Math.floor(ox / tw), startY = Math.floor(oy / th);
        const dx = startX * tw - ox, dy = startY * th - oy;
        const children = this.children.slice().sort(Tilemap.compareChildOrder);
        if (this._lowerCanvas) ctx.drawImage(this._lowerCanvas, dx, dy);
        let i = 0;
        for (; i < children.length && children[i].z < 4; i++) children[i].render(ctx);
        if (this._upperCanvas) ctx.drawImage(this._upperCanvas, dx, dy);
        for (; i < children.length; i++) children[i].render(ctx);
        ctx.restore();
    }

    static compareChildOrder(a, b) {
        if (a.z !== b.z) return a.z - b.z;
        if (a.y !== b.y) return a.y - b.y;
        return a.spriteId - b.spriteId;
    }

    _paintIfNeeded() {
        const tw = this.tileWidth, th = this.tileHeight;
        const ox = Math.round(this.origin.x), oy = Math.round(this.origin.y);
        const startX = Math.floor(ox / tw), startY = Math.floor(oy / th);
        const cols = Math.ceil(this._width / tw) + 1;
        const rows = Math.ceil(this._height / th) + 1;
        const frame = this.animationFrame;
        const key = startX + "," + startY + "," + cols + "," + rows + "," + frame;
        if (!this._needsRepaint && key === this._paintKey) return;
        this._paintKey = key;
        this._needsRepaint = false;
        const w = cols * tw, h = rows * th;
        if (!this._lowerCanvas) {
            this._lowerCanvas = document.createElement("canvas");
            this._upperCanvas = document.createElement("canvas");
        }
        for (const c of [this._lowerCanvas, this._upperCanvas]) {
            if (c.width !== w || c.height !== h) {
                c.width = w;
                c.height = h;
            } else {
                c.getContext("2d").clearRect(0, 0, w, h);
            }
        }
        const lower = this._lowerCanvas.getContext("2d");
        const upper = this._upperCanvas.getContext("2d");
        lower.imageSmoothingEnabled = false;
        upper.imageSmoothingEnabled = false;
        if (!this._mapData) return;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                this._paintTile(lower, upper, startX + x, startY + y, x * tw, y * th, frame);
            }
        }
    }

    _paintTile(lower, upper, mx, my, dx, dy, frame) {
        if (this.horizontalWrap) mx = mx.mod(this._mapWidth);
        if (this.verticalWrap) my = my.mod(this._mapHeight);
        if (mx < 0 || my < 0 || mx >= this._mapWidth || my >= this._mapHeight) return;
        const t0 = this._readMapData(mx, my, 0);
        const t1 = this._readMapData(mx, my, 1);
        const t2 = this._readMapData(mx, my, 2);
        const t3 = this._readMapData(mx, my, 3);
        const shadowBits = this._readMapData(mx, my, 4);
        const upperTileId1 = this._readMapData(mx, my - 1, 1);
        for (const tileId of [t0, t1]) {
            if (!tileId) continue;
            this._drawTile(this._isHigherTile(tileId) ? upper : lower, tileId, dx, dy, frame);
        }
        this._drawShadow(lower, shadowBits, dx, dy);
        // Table tiles (A2 + counter flag) overdraw the top of the tile below.
        if (this._isTableTile(upperTileId1) && !this._isTableTile(t1)) {
            if (!TileUtils.isShadowingTile(t0)) this._drawTableEdge(lower, upperTileId1, dx, dy, frame);
        }
        for (const tileId of [t2, t3]) {
            if (!tileId) continue;
            this._drawTile(this._isHigherTile(tileId) ? upper : lower, tileId, dx, dy, frame);
        }
    }

    _readMapData(x, y, z) {
        if (!this._mapData) return 0;
        const w = this._mapWidth, h = this._mapHeight;
        if (this.horizontalWrap) x = x.mod(w);
        if (this.verticalWrap) y = y.mod(h);
        if (x >= 0 && x < w && y >= 0 && y < h) return this._mapData[(z * h + y) * w + x] || 0;
        return 0;
    }

    _isHigherTile(tileId) {
        return !!(this.flags[tileId] & 0x10);
    }

    _isTableTile(tileId) {
        return TileUtils.isTileA2(tileId) && !!(this.flags[tileId] & 0x80);
    }

    _drawTile(ctx, tileId, dx, dy, frame) {
        Tilemap.drawTile(ctx, this._bitmaps, tileId, dx, dy, this.tileWidth, this.tileHeight, frame, this.flags);
    }

    _drawTableEdge(ctx, tileId, dx, dy, frame) {
        if (!TileUtils.isTileA2(tileId)) return;
        const src = TileUtils.autotileSource(tileId, frame);
        const bitmap = this._bitmaps[src.setNumber];
        if (!bitmap || !bitmap.isReady() || !bitmap.source) return;
        const w1 = this.tileWidth / 2, h1 = this.tileHeight / 2;
        const shape = TileUtils.getAutotileShape(tileId);
        const table = src.table[shape];
        for (let i = 0; i < 2; i++) {
            const qsx = table[2 + i][0];
            const qsy = table[2 + i][1];
            const sx1 = (src.bx * 2 + qsx) * w1;
            const sy1 = (src.by * 2 + qsy) * h1 + h1 / 2;
            ctx.drawImage(bitmap.source, sx1, sy1, w1, h1 / 2, dx + i * w1, dy, w1, h1 / 2);
        }
    }

    _drawShadow(ctx, shadowBits, dx, dy) {
        if (!(shadowBits & 0x0f)) return;
        const w1 = this.tileWidth / 2, h1 = this.tileHeight / 2;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        for (let i = 0; i < 4; i++) {
            if (shadowBits & (1 << i)) ctx.fillRect(dx + (i % 2) * w1, dy + Math.floor(i / 2) * h1, w1, h1);
        }
    }

    // Draws one tile ID onto a 2D context. Shared by the editor.
    static drawTile(ctx, bitmaps, tileId, dx, dy, tw, th, frame, flags, scale) {
        if (!TileUtils.isVisibleTile(tileId)) return;
        scale = scale || 1;
        if (TileUtils.isAutotile(tileId)) {
            Tilemap.drawAutotile(ctx, bitmaps, tileId, dx, dy, tw, th, frame || 0, flags, scale);
        } else {
            const src = TileUtils.normalTileSource(tileId, tw, th);
            const bitmap = bitmaps[src.setNumber];
            if (!bitmap || !bitmap.isReady() || !bitmap.source) return;
            if (src.sx + tw > bitmap.width || src.sy + th > bitmap.height) return;
            ctx.drawImage(bitmap.source, src.sx, src.sy, tw, th, dx, dy, tw * scale, th * scale);
        }
    }

    static drawAutotile(ctx, bitmaps, tileId, dx, dy, tw, th, frame, flags, scale) {
        const src = TileUtils.autotileSource(tileId, frame);
        const bitmap = bitmaps[src.setNumber];
        if (!bitmap || !bitmap.isReady() || !bitmap.source) return;
        const shape = TileUtils.getAutotileShape(tileId);
        const table = src.table[shape];
        if (!table) return;
        const w1 = tw / 2, h1 = th / 2;
        const isTable = src.isTable && flags && flags[tileId] & 0x80;
        for (let i = 0; i < 4; i++) {
            const qsx = table[i][0];
            const qsy = table[i][1];
            const sx1 = (src.bx * 2 + qsx) * w1;
            const sy1 = (src.by * 2 + qsy) * h1;
            const dx1 = dx + (i % 2) * w1 * scale;
            const dy1 = dy + Math.floor(i / 2) * h1 * scale;
            if (sx1 + w1 > bitmap.width || sy1 + h1 > bitmap.height) continue;
            if (isTable && (qsy === 1 || qsy === 5)) {
                // Table legs: shift the bottom quarter up by half.
                const qsx2 = qsy === 1 ? (4 - qsx) % 4 : qsx;
                const qsy2 = 3;
                const sx2 = (src.bx * 2 + qsx2) * w1;
                const sy2 = (src.by * 2 + qsy2) * h1;
                ctx.drawImage(bitmap.source, sx2, sy2, w1, h1, dx1, dy1, w1 * scale, h1 * scale);
                ctx.drawImage(bitmap.source, sx1, sy1, w1, h1 / 2, dx1, dy1 + (h1 / 2) * scale, w1 * scale, (h1 / 2) * scale);
            } else {
                ctx.drawImage(bitmap.source, sx1, sy1, w1, h1, dx1, dy1, w1 * scale, h1 * scale);
            }
        }
    }
};
// MZ-compatible static aliases
Object.assign(Tilemap, TileUtils);
var ShaderTilemap = Tilemap;

//-----------------------------------------------------------------------------
// Weather — rain, storm and snow particles

var Weather = class extends Container {
    initialize() {
        super.initialize();
        this._width = Graphics.width;
        this._height = Graphics.height;
        this._particles = [];
        this.type = "none";
        this.power = 0;
        this.origin = new Point();
        this._dimmer = 0;
    }

    update() {
        this._updateDimmer();
        this._updateAllParticles();
    }

    _updateDimmer() {
        this._dimmer = (this.power * 6).clamp(0, 255);
    }

    _updateAllParticles() {
        const maxSprites = Math.floor(this.power * 10);
        while (this._particles.length < maxSprites) {
            this._particles.push({ x: 0, y: 0, opacity: 0, ax: 0, ay: 0 });
        }
        this._particles.length = maxSprites;
        for (const p of this._particles) this._updateParticle(p);
    }

    _updateParticle(p) {
        switch (this.type) {
            case "rain":
                p.ax -= 6;
                p.ay += 12;
                p.opacity -= 6;
                break;
            case "storm":
                p.ax -= 8;
                p.ay += 16;
                p.opacity -= 8;
                break;
            case "snow":
                p.ax -= 2;
                p.ay += 3;
                p.opacity -= 3;
                break;
        }
        if (p.opacity < 40) this._rebornParticle(p);
    }

    _rebornParticle(p) {
        p.ax = Math.randomInt(Graphics.width + 100) - 100 + this.origin.x;
        p.ay = Math.randomInt(Graphics.height + 200) - 200 + this.origin.y;
        p.opacity = 160 + Math.randomInt(60);
    }

    _renderSelf(ctx) {
        if (this.type === "none" || this.power <= 0) return;
        ctx.save();
        if (this._dimmer > 0) {
            ctx.fillStyle = "rgba(0,0,0," + this._dimmer / 255 / 2 + ")";
            ctx.fillRect(0, 0, this._width, this._height);
        }
        const w = Graphics.width + 100, h = Graphics.height + 200;
        ctx.strokeStyle = "white";
        ctx.fillStyle = "white";
        for (const p of this._particles) {
            const x = (p.ax - this.origin.x).mod(w) - 100;
            const y = (p.ay - this.origin.y).mod(h) - 200;
            ctx.globalAlpha = p.opacity / 255;
            if (this.type === "snow") {
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.lineWidth = this.type === "storm" ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - (this.type === "storm" ? 6 : 3), y + (this.type === "storm" ? 40 : 32));
                ctx.stroke();
            }
        }
        ctx.restore();
    }
};
