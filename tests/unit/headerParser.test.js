import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parsePluginHeader, parseType, defaultParameters, checkPluginOrder, parameterTree } from "../../editor/plugins/headerParser.js";

const SAMPLE = `/*:
 * @target MZ
 * @plugindesc Shows a light fog.
 * @author Tester
 * @base CoreLib
 * @orderAfter CoreLib
 * @help
 * Line one of help.
 *   Indented line.
 *
 * @param opacity
 * @text Fog Opacity
 * @desc How dense
 * the fog is.
 * @type number
 * @min 0
 * @max 255
 * @default 128
 *
 * @param mode
 * @type select
 * @option Soft
 * @value soft
 * @option Hard
 * @default soft
 *
 * @param points
 * @type struct<Point>[]
 * @default []
 * @parent opacity
 *
 * @command setFog
 * @text Set Fog
 * @desc Changes fog.
 *
 * @arg level
 * @type number
 * @default 3
 */
/*~struct~Point:
 * @param x
 * @type number
 * @default 0
 * @param y
 * @type number
 * @default 0
 */
/*:ja
 * @plugindesc 霧
 */
(() => {})();
`;

describe("plugin header parser", () => {
    const h = parsePluginHeader(SAMPLE, "Fog");
    it("reads metadata and help", () => {
        expect(h.target).toBe("MZ");
        expect(h.description).toBe("Shows a light fog.");
        expect(h.base).toEqual(["CoreLib"]);
        expect(h.help).toContain("Indented line.");
    });
    it("reads params with multi-line desc and options", () => {
        expect(h.params.map(p => p.name)).toEqual(["opacity", "mode", "points"]);
        expect(h.params[0].desc).toBe("How dense\nthe fog is.");
        expect(h.params[0].max).toBe(255);
        expect(h.params[1].options).toEqual([{ label: "Soft", value: "soft" }, { label: "Hard", value: "Hard" }]);
        expect(defaultParameters(h.params)).toEqual({ opacity: "128", mode: "soft", points: "[]" });
    });
    it("reads commands, args and structs", () => {
        expect(h.commands[0].name).toBe("setFog");
        expect(h.commands[0].args[0].default).toBe("3");
        expect(h.structs.Point.map(p => p.name)).toEqual(["x", "y"]);
        expect(parseType("struct<Point>[]")).toEqual({ base: "struct", struct: "Point", array: 1 });
        expect(parameterTree(h.params)[0].children[0].param.name).toBe("points");
    });
    it("warns about plugin order", () => {
        const w = checkPluginOrder([{ name: "Fog", status: true }, { name: "CoreLib", status: true }], { Fog: h });
        expect(w.length).toBe(2);
    });
    it("parses the MZ plugins shipped in assets/", () => {
        const dir = path.resolve("assets/js/plugins");
        if (!fs.existsSync(dir)) return;
        for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
            const hdr = parsePluginHeader(fs.readFileSync(path.join(dir, f), "utf8"), f);
            expect(hdr === null || typeof hdr.description === "string").toBe(true);
        }
    });
});
