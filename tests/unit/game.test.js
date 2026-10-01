// Runs the real game objects headlessly: interpreter commands, damage math,
// traits and JsonEx save round trips.
import { describe, it, expect, beforeEach } from "vitest";
import { loadRuntime } from "../helpers/loadRuntime.js";
import { createDefaultDatabase } from "../../editor/core/defaultData.js";

const FILES = [
    "rpg9k_core.js", "rpg9k_tilemap.js", "rpg9k_window.js", "rpg9k_audio.js", "rpg9k_fallbacks.js",
    "rpg9k_managers.js", "rpg9k_battlers.js", "rpg9k_objects.js", "rpg9k_interpreter.js", "rpg9k_battle.js"
];

let rt;
const cmd = (code, parameters = [], indent = 0) => ({ code, indent, parameters });

function newGame() {
    rt = loadRuntime(FILES);
    const db = createDefaultDatabase("Test");
    for (const [key, value] of Object.entries(db)) if (key !== "maps") rt["$data" + key] = value;
    rt.$dataMap = db.maps ? db.maps[1] : null;
    rt.DataManager.createGameObjects();
    rt.$gameParty.setupStartingMembers();
    return db;
}

// Runs a command list to completion (bounded).
function run(list) {
    const interpreter = new rt.Game_Interpreter();
    interpreter.setup([...list, cmd(0)]);
    for (let i = 0; i < 1000 && interpreter.isRunning(); i++) interpreter.update();
    expect(interpreter.isRunning()).toBe(false);
    return interpreter;
}

describe("Game_Interpreter", () => {
    beforeEach(newGame);

    it("sets switches and variables (121, 122)", () => {
        run([
            cmd(121, [1, 3, 0]), // switches 1..3 ON
            cmd(122, [1, 1, 0, 0, 7]), // v1 = 7
            cmd(122, [1, 1, 3, 0, 5]), // v1 *= 5
            cmd(122, [2, 2, 0, 1, 1]), // v2 = v1
            cmd(122, [3, 3, 0, 4, "1 + 2 * 3"]) // v3 = script
        ]);
        expect([1, 2, 3, 4].map(id => rt.$gameSwitches.value(id))).toEqual([true, true, true, false]);
        expect(rt.$gameVariables.value(1)).toBe(35);
        expect(rt.$gameVariables.value(2)).toBe(35);
        expect(rt.$gameVariables.value(3)).toBe(7);
    });

    it("branches with If / Else (111, 411, 412)", () => {
        const list = v => [
            cmd(122, [1, 1, 0, 0, v]),
            cmd(111, [1, 1, 0, 5, 1]), // if v1 >= 5
            cmd(121, [10, 10, 0], 1),
            cmd(0, [], 1),
            cmd(411),
            cmd(121, [11, 11, 0], 1),
            cmd(0, [], 1),
            cmd(412)
        ];
        run(list(9));
        expect([rt.$gameSwitches.value(10), rt.$gameSwitches.value(11)]).toEqual([true, false]);
        newGame();
        run(list(2));
        expect([rt.$gameSwitches.value(10), rt.$gameSwitches.value(11)]).toEqual([false, true]);
    });

    it("loops until Break Loop (112, 113, 413)", () => {
        run([
            cmd(112),
            cmd(122, [1, 1, 1, 0, 1], 1), // v1 += 1
            cmd(111, [1, 1, 0, 10, 1], 1), // if v1 >= 10
            cmd(113, [], 2),
            cmd(0, [], 2),
            cmd(412, [], 1),
            cmd(0, [], 1),
            cmd(413)
        ]);
        expect(rt.$gameVariables.value(1)).toBe(10);
    });

    it("calls common events (117) and runs scripts (355/655)", () => {
        rt.$dataCommonEvents[1] = { id: 1, name: "CE", trigger: 0, switchId: 1, list: [cmd(122, [5, 5, 0, 0, 42]), cmd(0)] };
        run([cmd(117, [1]), cmd(355, ["$gameVariables.setValue(6,"]), cmd(655, ["  $gameVariables.value(5) + 1);"])]);
        expect(rt.$gameVariables.value(5)).toBe(42);
        expect(rt.$gameVariables.value(6)).toBe(43);
    });

    it("changes gold and items (125, 126)", () => {
        run([cmd(125, [0, 0, 500]), cmd(126, [1, 0, 0, 3])]);
        expect(rt.$gameParty.gold()).toBe(500);
        expect(rt.$gameParty.numItems(rt.$dataItems[1])).toBe(3);
    });

    it("dispatches plugin commands (357)", () => {
        const seen = [];
        rt.PluginManager.registerCommand("Test", "hello", function(args) {
            seen.push([this instanceof rt.Game_Interpreter, args.who]);
        });
        run([cmd(357, ["Test", "hello", "Say hello", { who: "world" }])]);
        expect(seen).toEqual([[true, "world"]]);
    });

    it("waits for Wait (230) before continuing", () => {
        const interpreter = new rt.Game_Interpreter();
        interpreter.setup([cmd(230, [5]), cmd(121, [1, 1, 0]), cmd(0)]);
        interpreter.update();
        expect(rt.$gameSwitches.value(1)).toBe(false);
        for (let i = 0; i < 10; i++) interpreter.update();
        expect(rt.$gameSwitches.value(1)).toBe(true);
    });
});

describe("Game_Action damage", () => {
    beforeEach(newGame);

    const setup = formula => {
        const actor = rt.$gameParty.members()[0];
        const enemy = new rt.Game_Enemy(1, 0, 0);
        const skill = { ...rt.$dataSkills[1], damage: { type: 1, elementId: 0, formula, variance: 0, critical: false } };
        rt.$dataSkills[999] = { ...skill, id: 999 };
        const action = new rt.Game_Action(actor);
        action.setSkill(999);
        return { actor, enemy, action };
    };

    it("evaluates the formula with a, b and v", () => {
        const { actor, enemy, action } = setup("a.atk * 4 - b.def * 2 + v[1]");
        rt.$gameVariables.setValue(1, 10);
        expect(action.evalDamageFormula(enemy)).toBe(actor.atk * 4 - enemy.def * 2 + 10);
    });

    it("never goes below zero and applies critical x3", () => {
        const { enemy, action } = setup("-50");
        expect(action.evalDamageFormula(enemy)).toBe(0);
        const r = setup("100");
        expect(r.action.makeDamageValue(r.enemy, true)).toBe(Math.round(300 * r.enemy.elementRate(0) * r.enemy.pdr));
    });

    it("keeps variance within range", () => {
        const { action } = setup("100");
        for (let i = 0; i < 200; i++) {
            const v = action.applyVariance(100, 20);
            expect(v).toBeGreaterThanOrEqual(80);
            expect(v).toBeLessThanOrEqual(120);
        }
    });

    it("applies element rate traits", () => {
        const { enemy, action } = setup("100");
        rt.$dataSkills[999].damage.elementId = 2;
        rt.$dataEnemies[1].traits.push({ code: 11, dataId: 2, value: 2 }); // element rate 200%
        expect(action.calcElementRate(enemy)).toBe(2);
    });
});

describe("JsonEx", () => {
    beforeEach(newGame);

    it("round-trips game objects with their classes", () => {
        rt.$gameVariables.setValue(3, 99);
        rt.$gameParty.gainGold(123);
        const contents = { variables: rt.$gameVariables, party: rt.$gameParty, actors: rt.$gameActors };
        const copy = rt.JsonEx.parse(rt.JsonEx.stringify(contents));
        expect(copy.variables).toBeInstanceOf(rt.Game_Variables);
        expect(copy.variables.value(3)).toBe(99);
        expect(copy.party.gold()).toBe(rt.$gameParty.gold());
        expect(copy.actors.actor(1)).toBeInstanceOf(rt.Game_Actor);
        expect(copy.actors.actor(1).name()).toBe(rt.$gameActors.actor(1).name());
    });

    it("deep-copies without sharing references", () => {
        const a = { list: [1, 2, { x: 3 }] };
        const b = rt.JsonEx.makeDeepCopy(a);
        b.list[2].x = 4;
        expect(a.list[2].x).toBe(3);
    });
});
