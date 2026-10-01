import { describe, it, expect } from "vitest";
import { loadRuntime } from "../helpers/loadRuntime.js";

const rt = loadRuntime();
const T = rt.TileUtils;

// Reference layout of the MZ/MV floor autotile quarters (public format spec).
const FLOOR_REFERENCE = [
    [[2,4],[1,4],[2,3],[1,3]],[[2,0],[1,4],[2,3],[1,3]],[[2,4],[3,0],[2,3],[1,3]],[[2,0],[3,0],[2,3],[1,3]],
    [[2,4],[1,4],[2,3],[3,1]],[[2,0],[1,4],[2,3],[3,1]],[[2,4],[3,0],[2,3],[3,1]],[[2,0],[3,0],[2,3],[3,1]],
    [[2,4],[1,4],[2,1],[1,3]],[[2,0],[1,4],[2,1],[1,3]],[[2,4],[3,0],[2,1],[1,3]],[[2,0],[3,0],[2,1],[1,3]],
    [[2,4],[1,4],[2,1],[3,1]],[[2,0],[1,4],[2,1],[3,1]],[[2,4],[3,0],[2,1],[3,1]],[[2,0],[3,0],[2,1],[3,1]],
    [[0,4],[1,4],[0,3],[1,3]],[[0,4],[3,0],[0,3],[1,3]],[[0,4],[1,4],[0,3],[3,1]],[[0,4],[3,0],[0,3],[3,1]],
    [[2,2],[1,2],[2,3],[1,3]],[[2,2],[1,2],[2,3],[3,1]],[[2,2],[1,2],[2,1],[1,3]],[[2,2],[1,2],[2,1],[3,1]],
    [[2,4],[3,4],[2,3],[3,3]],[[2,4],[3,4],[2,1],[3,3]],[[2,0],[3,4],[2,3],[3,3]],[[2,0],[3,4],[2,1],[3,3]],
    [[2,4],[1,4],[2,5],[1,5]],[[2,0],[1,4],[2,5],[1,5]],[[2,4],[3,0],[2,5],[1,5]],[[2,0],[3,0],[2,5],[1,5]],
    [[0,4],[3,4],[0,3],[3,3]],[[2,2],[1,2],[2,5],[1,5]],[[0,2],[1,2],[0,3],[1,3]],[[0,2],[1,2],[0,3],[3,1]],
    [[2,2],[3,2],[2,3],[3,3]],[[2,2],[3,2],[2,1],[3,3]],[[2,4],[3,4],[2,5],[3,5]],[[2,0],[3,4],[2,5],[3,5]],
    [[0,4],[1,4],[0,5],[1,5]],[[0,4],[3,0],[0,5],[1,5]],[[0,2],[3,2],[0,3],[3,3]],[[0,2],[1,2],[0,5],[1,5]],
    [[0,4],[3,4],[0,5],[3,5]],[[2,2],[3,2],[2,5],[3,5]],[[0,2],[3,2],[0,5],[3,5]],[[0,0],[1,0],[0,1],[1,1]]
];

describe("TileUtils", () => {
    it("derives the 48-shape floor table", () => {
        expect(JSON.parse(JSON.stringify(T.FLOOR_AUTOTILE_TABLE))).toEqual(FLOOR_REFERENCE);
    });

    it("derives wall and waterfall tables", () => {
        expect(T.WALL_AUTOTILE_TABLE.length).toBe(16);
        expect(JSON.parse(JSON.stringify(T.WALL_AUTOTILE_TABLE[0]))).toEqual([[2,2],[1,2],[2,1],[1,1]]);
        expect(JSON.parse(JSON.stringify(T.WALL_AUTOTILE_TABLE[15]))).toEqual([[0,0],[3,0],[0,3],[3,3]]);
        expect(JSON.parse(JSON.stringify(T.WATERFALL_AUTOTILE_TABLE))).toEqual([
            [[2,0],[1,0],[2,1],[1,1]],[[0,0],[1,0],[0,1],[1,1]],[[2,0],[3,0],[2,1],[3,1]],[[0,0],[3,0],[0,1],[3,1]]
        ]);
    });

    it("maps every neighbour combination to a floor shape", () => {
        const seen = new Set();
        for (let m = 0; m < 256; m++) {
            const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
            const same = (dx, dy) => !!(m & (1 << dirs.findIndex(d => d[0] === dx && d[1] === dy)));
            const shape = T.floorShape(same);
            expect(shape).toBeGreaterThanOrEqual(0);
            expect(shape).toBeLessThan(47);
            seen.add(shape);
        }
        expect(seen.size).toBe(47);
    });

    it("computes shapes from painted neighbours", () => {
        const grass = T.makeAutotileId(16, 0); // an A2 kind
        const grid = [
            [0, 0, 0],
            [0, grass, 0],
            [0, 0, 0]
        ];
        const get = (x, y) => (x < 0 || y < 0 || x > 2 || y > 2 ? null : grid[y][x]);
        expect(T.getAutotileShape(T.computeAutotileId(grass, 1, 1, get))).toBe(46);
        const full = (x, y) => grass;
        expect(T.getAutotileShape(T.computeAutotileId(grass, 1, 1, full))).toBe(0);
    });

    it("classifies tile IDs", () => {
        expect(T.isTileA1(2048)).toBe(true);
        expect(T.isTileA5(1536)).toBe(true);
        expect(T.sheetIndex(300)).toBe(6);
        expect(T.normalTileSource(9, 48, 48)).toEqual({ setNumber: 5, sx: 48, sy: 48 });
        expect(T.normalTileSource(128, 48, 48)).toEqual({ setNumber: 5, sx: 384, sy: 0 });
    });
});
