import { describe, it, expect, beforeAll } from "vitest";
import { loadRuntime } from "../helpers/loadRuntime.js";

let P, T;
beforeAll(async () => {
    const rt = loadRuntime();
    globalThis.TileUtils = rt.TileUtils;
    T = rt.TileUtils;
    P = await import("../../editor/map/paint.js");
});

function makeMap(w = 6, h = 5) {
    return { width: w, height: h, data: new Array(w * h * 6).fill(0), events: [null] };
}

describe("paint", () => {
    it("places ground autotiles on layer 0 and reshapes neighbours", () => {
        const map = makeMap();
        const grass = T.makeAutotileId(16, 0); // A2 kind 0
        const s = new P.EditSession(map);
        P.paintCells(s, P.rectCells(1, 1, 3, 3), { w: 1, h: 1, tiles: [grass] }, 1, 1, 1);
        // centre fully connected
        expect(T.getAutotileShape(P.getTile(map, 2, 2, 0))).toBe(0);
        // corner cell has two open sides
        expect(T.getAutotileShape(P.getTile(map, 1, 1, 0))).toBe(34);
        expect(s.diff().length).toBe(9);
    });

    it("stacks B-E tiles on layers 2 then 3 and erases with tile 0", () => {
        const map = makeMap();
        const s = new P.EditSession(map);
        P.placeTile(s, 0, 0, 5, 1);
        P.placeTile(s, 0, 0, 9, 1);
        expect([P.getTile(map, 0, 0, 2), P.getTile(map, 0, 0, 3)]).toEqual([5, 9]);
        P.placeTile(s, 0, 0, 0, 1);
        expect([P.getTile(map, 0, 0, 2), P.getTile(map, 0, 0, 3)]).toEqual([0, 0]);
    });

    it("puts area-mode A2 decorations on layer 1", () => {
        const map = makeMap();
        const s = new P.EditSession(map);
        const deco = T.makeAutotileId(16 + 4, 0);
        P.placeTile(s, 2, 2, T.makeAutotileId(16, 0), 1);
        P.placeTile(s, 2, 2, deco, 1);
        expect(T.getAutotileKind(P.getTile(map, 2, 2, 0))).toBe(16);
        expect(T.getAutotileKind(P.getTile(map, 2, 2, 1))).toBe(20);
    });

    it("undoes via diffs", () => {
        const map = makeMap();
        const before = map.data.slice();
        const s = new P.EditSession(map);
        P.paintCells(s, P.ellipseCells(0, 0, 5, 4), { w: 1, h: 1, tiles: [T.makeAutotileId(16, 0)] }, 0, 0, 1);
        P.applyDiff(map, s.diff(), true);
        expect(map.data).toEqual(before);
    });

    it("flood fills contiguous areas", () => {
        const map = makeMap(4, 4);
        const s = new P.EditSession(map);
        P.placeTile(s, 1, 0, 3, 1);
        P.placeTile(s, 1, 1, 3, 1);
        P.placeTile(s, 1, 2, 3, 1);
        P.placeTile(s, 1, 3, 3, 1);
        expect(P.floodCells(map, 0, 0).length).toBe(4);
        expect(P.floodCells(map, 3, 3).length).toBe(8);
    });

    it("resizes with an anchor", () => {
        const map = makeMap(2, 2);
        map.data[0] = 7;
        map.events.push({ id: 1, x: 1, y: 1, pages: [] });
        const r = P.resizeMapData(map, 4, 4, 8);
        expect(r.data[(0 * 4 + 2) * 4 + 2]).toBe(7);
        expect(r.events[1].x).toBe(3);
    });
});
