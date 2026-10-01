// format.js — names and MZ-style display text for event commands.
import { pad } from "../ui/dom.js";

export const CONTINUATION_CODES = new Set([401, 402, 403, 404, 405, 408, 411, 412, 413, 505, 601, 602, 603, 604, 605, 655, 657]);

export function makeContext(store, extra = {}) {
    return { store, ...extra };
}

const nameOf = (array, id) => (array && array[id] ? array[id].name : "");

export const N = {
    switch: (ctx, id) => "#" + pad(id) + " " + (ctx.store.system.switches[id] || ""),
    variable: (ctx, id) => "#" + pad(id) + " " + (ctx.store.system.variables[id] || ""),
    actor: (ctx, id) => nameOf(ctx.store.data.Actors, id),
    class: (ctx, id) => nameOf(ctx.store.data.Classes, id),
    skill: (ctx, id) => nameOf(ctx.store.data.Skills, id),
    item: (ctx, id) => nameOf(ctx.store.data.Items, id),
    weapon: (ctx, id) => nameOf(ctx.store.data.Weapons, id),
    armor: (ctx, id) => nameOf(ctx.store.data.Armors, id),
    enemy: (ctx, id) => nameOf(ctx.store.data.Enemies, id),
    troop: (ctx, id) => nameOf(ctx.store.data.Troops, id),
    state: (ctx, id) => nameOf(ctx.store.data.States, id),
    animation: (ctx, id) => nameOf(ctx.store.data.Animations, id),
    tileset: (ctx, id) => nameOf(ctx.store.data.Tilesets, id),
    commonEvent: (ctx, id) => nameOf(ctx.store.data.CommonEvents, id),
    map: (ctx, id) => {
        const info = ctx.store.mapInfos()[id];
        return info ? info.name : "MAP" + pad(id, 3);
    },
    character: (ctx, id) => {
        if (id < 0) return "Player";
        if (id === 0) return "This Event";
        const map = ctx.map;
        const ev = map && map.events[id];
        return ev ? ev.name : "EV" + pad(id, 3);
    },
    enemyIndex: (ctx, index) => {
        if (index < 0) return "Entire Troop";
        const troop = ctx.troop;
        if (troop && troop.members[index]) return "#" + (index + 1) + " " + nameOf(ctx.store.data.Enemies, troop.members[index].enemyId);
        return "#" + (index + 1);
    },
    actorTarget: (ctx, type, id) => {
        if (type === 0) return id === 0 ? "Entire Party" : N.actor(ctx, id);
        return "{" + N.variable(ctx, id) + "}";
    },
    vehicle: (ctx, id) => ["Boat", "Ship", "Airship"][id] || "?",
    direction: d => ({ 0: "Retain", 2: "Down", 4: "Left", 6: "Right", 8: "Up" })[d] || "?",
    audio: a => (a && a.name ? a.name + " (" + a.volume + ", " + a.pitch + ", " + a.pan + ")" : "None"),
    tone: t => "(" + t.join(",") + ")",
    operand: (ctx, type, value) => (type === 0 ? String(value) : "{" + N.variable(ctx, value) + "}"),
    param: id => ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck"][id] || "?"
};

const sign = op => (op === 0 ? "+ " : "- ");
const wait = w => (w ? " (Wait)" : "");
const onOff = v => (v === 0 ? "ON" : "OFF");
const enableDisable = v => (v === 0 ? "Disable" : "Enable");

function conditionText(ctx, p) {
    switch (p[0]) {
        case 0:
            return "Switch " + N.switch(ctx, p[1]) + " is " + onOff(p[2]);
        case 1: {
            const op = ["=", "≥", "≤", ">", "<", "≠"][p[4]];
            const rhs = p[2] === 0 ? String(p[3]) : N.variable(ctx, p[3]);
            return "Variable " + N.variable(ctx, p[1]) + " " + op + " " + rhs;
        }
        case 2:
            return "Self Switch " + p[1] + " is " + onOff(p[2]);
        case 3:
            return "Timer " + (p[2] === 0 ? "≥ " : "≤ ") + Math.floor(p[1] / 60) + " min " + (p[1] % 60) + " sec";
        case 4: {
            const a = N.actor(ctx, p[1]);
            switch (p[2]) {
                case 0:
                    return a + " is in the Party";
                case 1:
                    return a + " is Name '" + p[3] + "'";
                case 2:
                    return a + " is Class " + N.class(ctx, p[3]);
                case 3:
                    return a + " has learned " + N.skill(ctx, p[3]);
                case 4:
                    return a + " has equipped " + N.weapon(ctx, p[3]);
                case 5:
                    return a + " has equipped " + N.armor(ctx, p[3]);
                case 6:
                    return a + " is affected by " + N.state(ctx, p[3]);
            }
            return a;
        }
        case 5:
            return N.enemyIndex(ctx, p[1]) + (p[2] === 0 ? " is Appeared" : " is affected by " + N.state(ctx, p[3]));
        case 6:
            return N.character(ctx, p[1]) + " is Facing " + N.direction(p[2]);
        case 7:
            return "Gold " + ["≥", "≤", "<"][p[2]] + " " + p[1];
        case 8:
            return "Party has " + N.item(ctx, p[1]);
        case 9:
            return "Party has " + N.weapon(ctx, p[1]) + (p[2] ? " (Include Equipment)" : "");
        case 10:
            return "Party has " + N.armor(ctx, p[1]) + (p[2] ? " (Include Equipment)" : "");
        case 11:
            return "Button [" + buttonLabel(p[1]) + "] is " + ["Pressed Down", "Triggered", "Repeated"][p[2] || 0];
        case 12:
            return "Script: " + p[1];
        case 13:
            return N.vehicle(ctx, p[1]) + " is Driven";
    }
    return "?";
}

export function buttonLabel(name) {
    return { ok: "OK", cancel: "Cancel", shift: "Shift", down: "Down", left: "Left", right: "Right", up: "Up", pageup: "Pageup", pagedown: "Pagedown" }[name] || name;
}

function variableOperand(ctx, p) {
    switch (p[3]) {
        case 0:
            return String(p[4]);
        case 1:
            return N.variable(ctx, p[4]);
        case 2:
            return "Random " + p[4] + ".." + p[5];
        case 3:
            return gameDataText(ctx, p[4], p[5], p[6]);
        case 4:
            return p[4];
    }
    return "?";
}

export function gameDataText(ctx, type, a, b) {
    switch (type) {
        case 0:
            return "The number of " + N.item(ctx, a);
        case 1:
            return "The number of " + N.weapon(ctx, a);
        case 2:
            return "The number of " + N.armor(ctx, a);
        case 3:
            return ["Level", "EXP", "HP", "MP", "Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "TP"][b] + " of " + N.actor(ctx, a);
        case 4:
            return ["HP", "MP", "Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "TP"][b] + " of " + N.enemyIndex(ctx, a);
        case 5:
            return ["Map X", "Map Y", "Direction", "Screen X", "Screen Y"][b] + " of " + N.character(ctx, a);
        case 6:
            return "Actor ID of the party member #" + (a + 1);
        case 7:
            return ["Map ID", "Party Members", "Gold", "Steps", "Play Time", "Timer", "Save Count", "Battle Count", "Win Count", "Escape Count"][a];
        case 8:
            return "Last " + ["Used Skill ID", "Used Item ID", "Actor ID to Act", "Enemy Index to Act", "Target Actor ID", "Target Enemy Index"][a];
    }
    return "?";
}

function positionText(ctx, designation, a, b, c) {
    if (designation === 0) return N.map(ctx, a) + " (" + b + "," + c + ")";
    return "{" + N.variable(ctx, a) + "} ({" + N.variable(ctx, b) + "},{" + N.variable(ctx, c) + "})";
}

export const MOVE_COMMAND_NAMES = {
    0: "",
    1: "Move Down",
    2: "Move Left",
    3: "Move Right",
    4: "Move Up",
    5: "Move Lower Left",
    6: "Move Lower Right",
    7: "Move Upper Left",
    8: "Move Upper Right",
    9: "Move at Random",
    10: "Move toward Player",
    11: "Move away from Player",
    12: "1 Step Forward",
    13: "1 Step Backward",
    14: "Jump",
    15: "Wait",
    16: "Turn Down",
    17: "Turn Left",
    18: "Turn Right",
    19: "Turn Up",
    20: "Turn 90° Right",
    21: "Turn 90° Left",
    22: "Turn 180°",
    23: "Turn 90° Right or Left",
    24: "Turn at Random",
    25: "Turn toward Player",
    26: "Turn away from Player",
    27: "Switch ON",
    28: "Switch OFF",
    29: "Speed",
    30: "Frequency",
    31: "Walking Animation ON",
    32: "Walking Animation OFF",
    33: "Stepping Animation ON",
    34: "Stepping Animation OFF",
    35: "Direction Fix ON",
    36: "Direction Fix OFF",
    37: "Through ON",
    38: "Through OFF",
    39: "Transparent ON",
    40: "Transparent OFF",
    41: "Image",
    42: "Opacity",
    43: "Blend Mode",
    44: "SE",
    45: "Script"
};

export function moveCommandText(ctx, cmd) {
    const p = cmd.parameters || [];
    const name = MOVE_COMMAND_NAMES[cmd.code] || "?";
    switch (cmd.code) {
        case 14:
            return name + ": " + p[0] + ", " + p[1];
        case 15:
            return name + ": " + p[0] + " frames";
        case 27:
        case 28:
            return name + ": " + N.switch(ctx, p[0]);
        case 29:
            return name + ": " + p[0];
        case 30:
            return name + ": " + p[0];
        case 41:
            return name + ": " + (p[0] ? p[0] + "(" + p[1] + ")" : "None");
        case 42:
            return name + ": " + p[0];
        case 43:
            return name + ": " + ["Normal", "Additive", "Multiply", "Screen"][p[0]];
        case 44:
            return name + ": " + N.audio(p[0]);
        case 45:
            return name + ": " + p[0];
    }
    return name;
}

// Returns the text after "◆" (or the continuation text) for a command line.
export function commandText(ctx, cmd) {
    const p = cmd.parameters || [];
    switch (cmd.code) {
        case 0:
            return "";
        case 101: {
            const face = p[0] ? p[0] + "(" + p[1] + ")" : "None";
            const bg = ["Window", "Dim", "Transparent"][p[2]];
            const pos = ["Top", "Middle", "Bottom"][p[3]];
            return "Text : " + face + ", " + bg + ", " + pos + (p[4] ? ", " + p[4] : "");
        }
        case 401:
            return ":     : " + p[0];
        case 102:
            return "Show Choices : " + p[0].join(", ") + " (" + ["Window", "Dim", "Transparent"][p[4] || 0] + ", " + ["Left", "Middle", "Right"][p[3] == null ? 2 : p[3]] + ", #" + ((p[2] == null ? 0 : p[2]) + 1) + ", #" + (p[1] + 1) + ")";
        case 402:
            return ": When " + p[1];
        case 403:
            return ": When Cancel";
        case 404:
            return ": End";
        case 103:
            return "Input Number : " + N.variable(ctx, p[0]) + ", " + p[1] + " digits";
        case 104:
            return "Select Item : " + N.variable(ctx, p[0]) + ", " + ["", "Regular Item", "Key Item", "Hidden Item A", "Hidden Item B"][p[1] || 2];
        case 105:
            return "Text (S) : Speed " + p[0] + (p[1] ? ", No Fast Forward" : "");
        case 405:
            return ":         : " + p[0];
        case 108:
            return "Comment : " + p[0];
        case 408:
            return ":       : " + p[0];
        case 109:
            return "Skip";
        case 111:
            return "If : " + conditionText(ctx, p);
        case 411:
            return "Else";
        case 412:
            return "End";
        case 112:
            return "Loop";
        case 413:
            return "Repeat Above";
        case 113:
            return "Break Loop";
        case 115:
            return "Exit Event Processing";
        case 117:
            return "Common Event : " + N.commonEvent(ctx, p[0]);
        case 118:
            return "Label : " + p[0];
        case 119:
            return "Jump to Label : " + p[0];
        case 121:
            return "Control Switches : " + (p[0] === p[1] ? N.switch(ctx, p[0]) : "#" + pad(p[0]) + "..#" + pad(p[1])) + " = " + onOff(p[2]);
        case 122: {
            const target = p[0] === p[1] ? N.variable(ctx, p[0]) : "#" + pad(p[0]) + "..#" + pad(p[1]);
            const op = ["=", "+=", "-=", "*=", "/=", "%="][p[2]];
            return "Control Variables : " + target + " " + op + " " + variableOperand(ctx, p);
        }
        case 123:
            return "Control Self Switch : " + p[0] + " = " + onOff(p[1]);
        case 124:
            return "Control Timer : " + (p[0] === 0 ? "Start, " + Math.floor(p[1] / 60) + " min " + (p[1] % 60) + " sec" : "Stop");
        case 125:
            return "Change Gold : " + sign(p[0]) + N.operand(ctx, p[1], p[2]);
        case 126:
            return "Change Items : " + N.item(ctx, p[0]) + " " + sign(p[1]) + N.operand(ctx, p[2], p[3]);
        case 127:
            return "Change Weapons : " + N.weapon(ctx, p[0]) + " " + sign(p[1]) + N.operand(ctx, p[2], p[3]) + (p[4] ? " (Include Equipment)" : "");
        case 128:
            return "Change Armors : " + N.armor(ctx, p[0]) + " " + sign(p[1]) + N.operand(ctx, p[2], p[3]) + (p[4] ? " (Include Equipment)" : "");
        case 129:
            return "Change Party Member : " + (p[1] === 0 ? "Add " : "Remove ") + N.actor(ctx, p[0]) + (p[1] === 0 && p[2] ? " (Initialize)" : "");
        case 132:
            return "Change Battle BGM : " + N.audio(p[0]);
        case 133:
            return "Change Victory ME : " + N.audio(p[0]);
        case 139:
            return "Change Defeat ME : " + N.audio(p[0]);
        case 140:
            return "Change Vehicle BGM : " + N.vehicle(ctx, p[0]) + ", " + N.audio(p[1]);
        case 134:
            return "Change Save Access : " + enableDisable(p[0]);
        case 135:
            return "Change Menu Access : " + enableDisable(p[0]);
        case 136:
            return "Change Encounter : " + enableDisable(p[0]);
        case 137:
            return "Change Formation Access : " + enableDisable(p[0]);
        case 138:
            return "Change Window Color : " + N.tone(p[0]);
        case 201:
            return "Transfer Player : " + positionText(ctx, p[0], p[1], p[2], p[3]) + (p[4] ? " (Direction: " + N.direction(p[4]) + ")" : "") + (p[5] !== 0 ? " (Fade: " + ["Black", "White", "None"][p[5]] + ")" : "");
        case 202:
            return "Set Vehicle Location : " + N.vehicle(ctx, p[0]) + ", " + positionText(ctx, p[1], p[2], p[3], p[4]);
        case 203: {
            let where;
            if (p[1] === 0) where = "(" + p[2] + "," + p[3] + ")";
            else if (p[1] === 1) where = "({" + N.variable(ctx, p[2]) + "},{" + N.variable(ctx, p[3]) + "})";
            else where = "Exchange with " + N.character(ctx, p[2]);
            return "Set Event Location : " + N.character(ctx, p[0]) + ", " + where + (p[4] ? " (Direction: " + N.direction(p[4]) + ")" : "");
        }
        case 204:
            return "Scroll Map : " + N.direction(p[0]) + ", " + p[1] + ", " + p[2] + wait(p[3]);
        case 205: {
            const r = p[1] || {};
            const opts = [r.repeat && "Repeat", r.skippable && "Skip", r.wait && "Wait"].filter(Boolean);
            return "Set Movement Route : " + N.character(ctx, p[0]) + (opts.length ? " (" + opts.join(", ") + ")" : "");
        }
        case 505:
            return ":                    : ◇" + moveCommandText(ctx, p[0]);
        case 206:
            return "Get on/off Vehicle";
        case 211:
            return "Change Transparency : " + onOff(p[0]);
        case 216:
            return "Change Player Followers : " + onOff(p[0]);
        case 217:
            return "Gather Followers";
        case 212:
            return "Show Animation : " + N.character(ctx, p[0]) + ", " + N.animation(ctx, p[1]) + wait(p[2]);
        case 213:
            return "Show Balloon Icon : " + N.character(ctx, p[0]) + ", " + BALLOONS[p[1] - 1] + wait(p[2]);
        case 214:
            return "Erase Event";
        case 231:
            return "Show Picture : #" + p[0] + ", " + (p[1] || "None") + ", " + (p[2] === 0 ? "Upper Left" : "Center") + " (" + (p[3] === 0 ? p[4] + "," + p[5] : "{" + N.variable(ctx, p[4]) + "},{" + N.variable(ctx, p[5]) + "}") + "), (" + p[6] + "%," + p[7] + "%), " + p[8] + ", " + BLEND[p[9]];
        case 232:
            return "Move Picture : #" + p[0] + ", " + (p[2] === 0 ? "Upper Left" : "Center") + " (" + (p[3] === 0 ? p[4] + "," + p[5] : "{" + N.variable(ctx, p[4]) + "},{" + N.variable(ctx, p[5]) + "}") + "), (" + p[6] + "%," + p[7] + "%), " + p[8] + ", " + BLEND[p[9]] + ", " + p[10] + " frames" + wait(p[11]) + (p[12] ? ", " + EASING[p[12]] : "");
        case 233:
            return "Rotate Picture : #" + p[0] + ", " + p[1];
        case 234:
            return "Tint Picture : #" + p[0] + ", " + N.tone(p[1]) + ", " + p[2] + " frames" + wait(p[3]);
        case 235:
            return "Erase Picture : #" + p[0];
        case 230:
            return "Wait : " + p[0] + " frames";
        case 221:
            return "Fadeout Screen";
        case 222:
            return "Fadein Screen";
        case 223:
            return "Tint Screen : " + N.tone(p[0]) + ", " + p[1] + " frames" + wait(p[2]);
        case 224:
            return "Flash Screen : (" + p[0].join(",") + "), " + p[1] + " frames" + wait(p[2]);
        case 225:
            return "Shake Screen : " + p[0] + ", " + p[1] + ", " + p[2] + " frames" + wait(p[3]);
        case 236:
            return "Set Weather Effect : " + ({ none: "None", rain: "Rain", storm: "Storm", snow: "Snow" })[p[0]] + ", " + p[1] + ", " + p[2] + " frames" + wait(p[3]);
        case 241:
            return "Play BGM : " + N.audio(p[0]);
        case 242:
            return "Fadeout BGM : " + p[0] + " sec.";
        case 243:
            return "Save BGM";
        case 244:
            return "Replay BGM";
        case 245:
            return "Play BGS : " + N.audio(p[0]);
        case 246:
            return "Fadeout BGS : " + p[0] + " sec.";
        case 249:
            return "Play ME : " + N.audio(p[0]);
        case 250:
            return "Play SE : " + N.audio(p[0]);
        case 251:
            return "Stop SE";
        case 261:
            return "Play Movie : " + (p[0] || "None");
        case 281:
            return "Change Map Name Display : " + onOff(p[0]);
        case 282:
            return "Change Tileset : " + N.tileset(ctx, p[0]);
        case 283:
            return "Change Battle Background : " + (p[0] || "None") + " & " + (p[1] || "None");
        case 284:
            return "Change Parallax : " + (p[0] || "None") + (p[1] ? " (Loop Horizontally " + p[3] + ")" : "") + (p[2] ? " (Loop Vertically " + p[4] + ")" : "");
        case 285: {
            const info = ["Terrain Tag", "Event ID", "Tile ID (Layer 1)", "Tile ID (Layer 2)", "Tile ID (Layer 3)", "Tile ID (Layer 4)", "Region ID"][p[1]];
            const where = p[2] === 0 ? "(" + p[3] + "," + p[4] + ")" : p[2] === 1 ? "({" + N.variable(ctx, p[3]) + "},{" + N.variable(ctx, p[4]) + "})" : N.character(ctx, p[3]);
            return "Get Location Info : " + N.variable(ctx, p[0]) + ", " + info + ", " + where;
        }
        case 301: {
            const troop = p[0] === 0 ? N.troop(ctx, p[1]) : p[0] === 1 ? "{" + N.variable(ctx, p[1]) + "}" : "Same as Random Encounters";
            return "Battle Processing : " + troop;
        }
        case 601:
            return ": If Win";
        case 602:
            return ": If Escape";
        case 603:
            return ": If Lose";
        case 604:
            return ": End";
        case 302:
            return "Shop Processing : " + goodsText(ctx, p) + (p[4] ? " (Purchase Only)" : "");
        case 605:
            return ":                : " + goodsText(ctx, p);
        case 303:
            return "Name Input Processing : " + N.actor(ctx, p[0]) + ", " + p[1] + " characters";
        case 311:
            return "Change HP : " + N.actorTarget(ctx, p[0], p[1]) + ", " + sign(p[2]) + N.operand(ctx, p[3], p[4]) + (p[5] ? " (Allow Knockout)" : "");
        case 312:
            return "Change MP : " + N.actorTarget(ctx, p[0], p[1]) + ", " + sign(p[2]) + N.operand(ctx, p[3], p[4]);
        case 326:
            return "Change TP : " + N.actorTarget(ctx, p[0], p[1]) + ", " + sign(p[2]) + N.operand(ctx, p[3], p[4]);
        case 313:
            return "Change State : " + N.actorTarget(ctx, p[0], p[1]) + ", " + (p[2] === 0 ? "+ " : "- ") + N.state(ctx, p[3]);
        case 314:
            return "Recover All : " + N.actorTarget(ctx, p[0], p[1]);
        case 315:
            return "Change EXP : " + N.actorTarget(ctx, p[0], p[1]) + ", " + sign(p[2]) + N.operand(ctx, p[3], p[4]) + (p[5] ? " (Show Level Up)" : "");
        case 316:
            return "Change Level : " + N.actorTarget(ctx, p[0], p[1]) + ", " + sign(p[2]) + N.operand(ctx, p[3], p[4]) + (p[5] ? " (Show Level Up)" : "");
        case 317:
            return "Change Parameter : " + N.actorTarget(ctx, p[0], p[1]) + ", " + N.param(p[2]) + " " + sign(p[3]) + N.operand(ctx, p[4], p[5]);
        case 318:
            return "Change Skill : " + N.actorTarget(ctx, p[0], p[1]) + ", " + (p[2] === 0 ? "+ " : "- ") + N.skill(ctx, p[3]);
        case 319: {
            const etype = ctx.store.system.equipTypes[p[1]] || "?";
            const item = p[1] === 1 ? N.weapon(ctx, p[2]) : N.armor(ctx, p[2]);
            return "Change Equipment : " + N.actor(ctx, p[0]) + ", " + etype + " = " + (p[2] ? item : "None");
        }
        case 320:
            return "Change Name : " + N.actor(ctx, p[0]) + ", " + p[1];
        case 324:
            return "Change Nickname : " + N.actor(ctx, p[0]) + ", " + p[1];
        case 325:
            return "Change Profile : " + N.actor(ctx, p[0]) + ", " + String(p[1]).replace(/\n/g, " ");
        case 321:
            return "Change Class : " + N.actor(ctx, p[0]) + ", " + N.class(ctx, p[1]) + (p[2] ? " (Save Level)" : "");
        case 322:
            return "Change Actor Images : " + N.actor(ctx, p[0]) + ", " + (p[1] || "None") + "(" + p[2] + "), " + (p[3] || "None") + "(" + p[4] + "), " + (p[5] || "None");
        case 323:
            return "Change Vehicle Image : " + N.vehicle(ctx, p[0]) + ", " + (p[1] || "None") + "(" + p[2] + ")";
        case 331:
            return "Change Enemy HP : " + N.enemyIndex(ctx, p[0]) + ", " + sign(p[1]) + N.operand(ctx, p[2], p[3]) + (p[4] ? " (Allow Knockout)" : "");
        case 332:
            return "Change Enemy MP : " + N.enemyIndex(ctx, p[0]) + ", " + sign(p[1]) + N.operand(ctx, p[2], p[3]);
        case 342:
            return "Change Enemy TP : " + N.enemyIndex(ctx, p[0]) + ", " + sign(p[1]) + N.operand(ctx, p[2], p[3]);
        case 333:
            return "Change Enemy State : " + N.enemyIndex(ctx, p[0]) + ", " + (p[1] === 0 ? "+ " : "- ") + N.state(ctx, p[2]);
        case 334:
            return "Enemy Recover All : " + N.enemyIndex(ctx, p[0]);
        case 335:
            return "Enemy Appear : " + N.enemyIndex(ctx, p[0]);
        case 336:
            return "Enemy Transform : " + N.enemyIndex(ctx, p[0]) + ", " + N.enemy(ctx, p[1]);
        case 337:
            return "Show Battle Animation : " + (p[2] ? "Entire Troop" : N.enemyIndex(ctx, p[0])) + ", " + N.animation(ctx, p[1]);
        case 339: {
            const subject = p[0] === 0 ? N.enemyIndex(ctx, p[1]) : N.actor(ctx, p[1]);
            const target = p[3] === -2 ? "Last Target" : p[3] === -1 ? "Random" : "Index " + (p[3] + 1);
            return "Force Action : " + subject + ", " + N.skill(ctx, p[2]) + ", " + target;
        }
        case 340:
            return "Abort Battle";
        case 351:
            return "Open Menu Screen";
        case 352:
            return "Open Save Screen";
        case 353:
            return "Game Over";
        case 354:
            return "Return to Title Screen";
        case 355:
            return "Script : " + p[0];
        case 655:
            return ":        : " + p[0];
        case 356:
            return "Plugin Command : " + p[0];
        case 357:
            return "Plugin Command : " + p[0] + ", " + (p[2] || p[1]);
        case 657:
            return ":                : " + p[0];
    }
    return "Unknown command (" + cmd.code + ")";
}

function goodsText(ctx, p) {
    const name = p[0] === 0 ? N.item(ctx, p[1]) : p[0] === 1 ? N.weapon(ctx, p[1]) : N.armor(ctx, p[1]);
    return name + (p[2] === 1 ? " (" + p[3] + ")" : "");
}

export const BALLOONS = ["Exclamation", "Question", "Music Note", "Heart", "Anger", "Sweat", "Frustration", "Silence", "Light Bulb", "Zzz", "User-defined 1", "User-defined 2", "User-defined 3", "User-defined 4", "User-defined 5"];
export const BLEND = ["Normal", "Additive", "Multiply", "Screen"];
export const EASING = ["Constant Speed", "Slow Start", "Slow End", "Slow Start and End"];

// Display line for a list entry, with MZ indentation and markers.
export function commandLine(ctx, cmd) {
    const indent = "  ".repeat(cmd.indent || 0);
    if (cmd.code === 0) return indent + "◆";
    const text = commandText(ctx, cmd);
    if (CONTINUATION_CODES.has(cmd.code)) return indent + text;
    return indent + "◆" + text;
}

// Text color class for a command (comments green, scripts etc.)
export function commandClass(cmd) {
    if (cmd.code === 108 || cmd.code === 408) return "cmd-comment";
    if (cmd.code === 355 || cmd.code === 655 || cmd.code === 356 || cmd.code === 357 || cmd.code === 657) return "cmd-script";
    if (cmd.code === 111 || cmd.code === 411 || cmd.code === 412 || cmd.code === 112 || cmd.code === 413 || cmd.code === 113 || cmd.code === 115) return "cmd-flow";
    if (cmd.code === 101 || cmd.code === 401 || cmd.code === 102 || cmd.code === 402 || cmd.code === 403 || cmd.code === 404) return "cmd-message";
    return "";
}
