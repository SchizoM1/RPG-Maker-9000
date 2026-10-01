// defaultData.js — the single source of blank and starter database entries.
// Used by New Project, "Change Maximum" in the database editor, and tests.
// Pure module: no DOM or Node APIs.

export const DATA_FILES = [
    "Actors", "Classes", "Skills", "Items", "Weapons", "Armors", "Enemies", "Troops",
    "States", "Animations", "Tilesets", "CommonEvents", "System", "MapInfos"
];

const se = (name, volume = 90, pitch = 100, pan = 0) => ({ name, pan, pitch, volume });
const audio = se;

// ---------------------------------------------------------------------------
// Blank entries (what "Change Maximum" creates)

export function blankActor(id) {
    return {
        id, battlerName: "", characterIndex: 0, characterName: "", classId: 1,
        equips: [0, 0, 0, 0, 0], faceIndex: 0, faceName: "", traits: [],
        initialLevel: 1, maxLevel: 99, name: "", nickname: "", note: "", profile: ""
    };
}

export function blankClass(id) {
    return {
        id, expParams: [30, 20, 30, 30], traits: [
            { code: 23, dataId: 0, value: 1 },
            { code: 22, dataId: 0, value: 0.95 },
            { code: 22, dataId: 1, value: 0.05 },
            { code: 22, dataId: 2, value: 0.04 },
            { code: 41, dataId: 1, value: 1 },
            { code: 51, dataId: 1, value: 1 },
            { code: 52, dataId: 1, value: 1 }
        ],
        learnings: [], name: "", note: "", params: makeParamCurves(450, 90, 16, 16, 16, 16, 16, 16)
    };
}

export function blankSkill(id) {
    return {
        id, animationId: 0,
        damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
        description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "",
        messageType: 1, mpCost: 0, name: "", note: "", occasion: 0, repeats: 1,
        requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 0, speed: 0, stypeId: 1,
        successRate: 100, tpCost: 0, tpGain: 0
    };
}

export function blankItem(id) {
    return {
        id, animationId: 0, consumable: true,
        damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
        description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
        occasion: 0, price: 0, repeats: 1, scope: 0, speed: 0, successRate: 100, tpGain: 0
    };
}

export function blankWeapon(id) {
    return {
        id, animationId: 0, description: "", etypeId: 1, traits: [
            { code: 31, dataId: 1, value: 0 },
            { code: 22, dataId: 0, value: 0 }
        ],
        iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0
    };
}

export function blankArmor(id) {
    return {
        id, atypeId: 0, description: "", etypeId: 2, traits: [{ code: 22, dataId: 1, value: 0 }],
        iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0
    };
}

export function blankEnemy(id) {
    return {
        id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
        battlerHue: 0, battlerName: "", dropItems: [
            { dataId: 1, denominator: 1, kind: 0 },
            { dataId: 1, denominator: 1, kind: 0 },
            { dataId: 1, denominator: 1, kind: 0 }
        ],
        exp: 0, traits: [
            { code: 22, dataId: 0, value: 0.95 },
            { code: 22, dataId: 1, value: 0.05 },
            { code: 31, dataId: 1, value: 0 }
        ],
        gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10]
    };
}

export function blankTroopPage() {
    return {
        conditions: {
            actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false,
            switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false
        },
        list: [{ code: 0, indent: 0, parameters: [] }],
        span: 0
    };
}

export function blankTroop(id) {
    return { id, members: [], name: "", pages: [blankTroopPage()] };
}

export function blankState(id) {
    return {
        id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1,
        message1: "", message2: "", message3: "", message4: "", messageType: 1, minTurns: 1,
        motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false,
        removeAtBattleEnd: false, removeByDamage: false, removeByRestriction: false,
        removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: []
    };
}

export function blankAnimation(id) {
    return {
        id, displayType: 0, effectName: "", flashTimings: [], name: "", offsetX: 0, offsetY: 0,
        rotation: { x: 0, y: 0, z: 0 }, scale: 100, soundTimings: [], speed: 100, alignBottom: false
    };
}

export function blankTileset(id) {
    const flags = new Array(8192).fill(0);
    flags[0] = 0x10;
    return { id, flags, mode: 1, name: "", note: "", tilesetNames: ["", "", "", "", "", "", "", "", ""] };
}

export function blankCommonEvent(id) {
    return { id, list: [{ code: 0, indent: 0, parameters: [] }], name: "", switchId: 1, trigger: 0 };
}

export function blankEventPage() {
    return {
        conditions: {
            actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: "A",
            selfSwitchValid: false, switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
            variableId: 1, variableValid: false, variableValue: 0
        },
        directionFix: false,
        image: { tileId: 0, characterName: "", direction: 2, pattern: 1, characterIndex: 0 },
        list: [{ code: 0, indent: 0, parameters: [] }],
        moveFrequency: 3,
        moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
        moveSpeed: 3, moveType: 0, priorityType: 0, stepAnime: false, through: false, trigger: 0, walkAnime: true
    };
}

export function blankEvent(id, x, y) {
    return { id, name: "EV" + String(id).padStart(3, "0"), note: "", pages: [blankEventPage()], x, y };
}

export const BLANK_FACTORIES = {
    Actors: blankActor,
    Classes: blankClass,
    Skills: blankSkill,
    Items: blankItem,
    Weapons: blankWeapon,
    Armors: blankArmor,
    Enemies: blankEnemy,
    Troops: blankTroop,
    States: blankState,
    Animations: blankAnimation,
    Tilesets: blankTileset,
    CommonEvents: blankCommonEvent
};

// Resizes a database array (index 0 stays null) to `max` entries, keeping
// existing entries and filling new slots with blanks.
export function changeMaximum(array, max, kind) {
    const factory = BLANK_FACTORIES[kind];
    const result = [null];
    for (let id = 1; id <= max; id++) {
        result.push(array[id] ? array[id] : factory(id));
    }
    return result;
}

// ---------------------------------------------------------------------------
// Class parameter curves: 8 params x 100 levels (index 0 unused, as in MZ).

export function makeParamCurves(mhp, mmp, atk, def, mat, mdf, agi, luk) {
    const bases = [mhp, mmp, atk, def, mat, mdf, agi, luk];
    const growth = [
        [mhp * 0.12, mhp * 7.5],
        [mmp * 0.1, mmp * 6],
        [atk * 0.18, atk * 11],
        [def * 0.18, def * 11],
        [mat * 0.18, mat * 11],
        [mdf * 0.18, mdf * 11],
        [agi * 0.18, agi * 11],
        [luk * 0.18, luk * 11]
    ];
    return bases.map((base, p) => {
        const curve = [0];
        for (let level = 1; level <= 99; level++) {
            const t = (level - 1) / 98;
            const value = base + growth[p][0] * (level - 1) + growth[p][1] * t * t;
            curve.push(Math.round(value));
        }
        return curve;
    });
}

// ---------------------------------------------------------------------------
// Starter database

function actors() {
    const list = [null];
    const add = (name, nickname, classId, characterName, characterIndex, faceName, faceIndex, battlerName, equips, profile) => {
        list.push({
            ...blankActor(list.length), name, nickname, classId, characterName, characterIndex,
            faceName, faceIndex, battlerName, equips, profile
        });
    };
    add("Reid", "Swordsman", 1, "Actor1", 0, "Actor1", 0, "Actor1_1", [1, 1, 2, 3, 0],
        "A young swordsman who wants to see the world.");
    add("Priscilla", "Magician", 2, "Actor1", 1, "Actor1", 1, "Actor1_2", [4, 0, 5, 6, 0],
        "A gifted magician from a quiet village.");
    add("Gale", "Warrior", 3, "Actor1", 2, "Actor1", 2, "Actor1_3", [2, 1, 2, 3, 0],
        "A veteran warrior with a heavy axe.");
    add("Michelle", "Cleric", 4, "Actor1", 3, "Actor1", 3, "Actor1_4", [3, 0, 5, 6, 0],
        "A cleric who heals her friends.");
    return list;
}

function classes() {
    const list = [null];
    const add = (name, params, learnings, extraTraits) => {
        const c = blankClass(list.length);
        c.name = name;
        c.params = params;
        c.learnings = learnings.map(([level, skillId]) => ({ level, note: "", skillId }));
        c.traits = c.traits.concat(extraTraits);
        list.push(c);
    };
    const equip = (wtypes, atypes) => [
        ...wtypes.map(id => ({ code: 51, dataId: id, value: 1 })),
        ...atypes.map(id => ({ code: 52, dataId: id, value: 1 }))
    ];
    add("Swordsman", makeParamCurves(550, 60, 20, 18, 12, 12, 16, 14), [[1, 12], [6, 13]], [
        { code: 41, dataId: 2, value: 1 }, ...equip([2, 1], [1, 3, 4, 5])
    ]);
    add("Magician", makeParamCurves(380, 120, 12, 12, 22, 20, 17, 16), [[1, 9], [1, 11], [4, 10]], [
        ...equip([6], [1, 2])
    ]);
    add("Warrior", makeParamCurves(620, 40, 23, 20, 10, 10, 13, 12), [[1, 12], [5, 13]], [
        { code: 41, dataId: 2, value: 1 }, ...equip([4, 2], [1, 3, 4, 5, 6])
    ]);
    add("Cleric", makeParamCurves(420, 110, 13, 14, 19, 22, 15, 18), [[1, 8], [3, 14]], [
        ...equip([6, 3], [1, 2, 5])
    ]);
    return list;
}

function skills(anim) {
    const list = [null];
    const add = (props) => list.push({ ...blankSkill(list.length), ...props });
    const dmg = (type, formula, elementId = 0, critical = false, variance = 20) => ({ critical, elementId, formula, type, variance });
    const normalAttackState = { code: 21, dataId: 0, value1: 1, value2: 0 };
    add({ name: "Attack", animationId: -1, damage: dmg(1, "a.atk * 4 - b.def * 2", -1, true), hitType: 1, scope: 1, stypeId: 0, message1: "%1 attacks!", occasion: 1, tpGain: 10, effects: [normalAttackState], description: "" });
    add({ name: "Guard", scope: 11, stypeId: 0, message1: "%1 guards.", occasion: 1, speed: 2000, tpGain: 10, effects: [{ code: 21, dataId: 2, value1: 1, value2: 0 }] });
    add({ name: "Dual Attack", animationId: -1, damage: dmg(1, "a.atk * 4 - b.def * 2", -1, true), hitType: 1, repeats: 2, scope: 1, stypeId: 0, message1: "%1 attacks!", occasion: 1, tpGain: 5, effects: [normalAttackState] });
    add({ name: "Double Attack", animationId: -1, damage: dmg(1, "a.atk * 4 - b.def * 2", -1, true), hitType: 1, scope: 4, stypeId: 0, message1: "%1 attacks!", occasion: 1, tpGain: 5, effects: [normalAttackState] });
    add({ name: "Triple Attack", animationId: -1, damage: dmg(1, "a.atk * 4 - b.def * 2", -1, true), hitType: 1, scope: 5, stypeId: 0, message1: "%1 attacks!", occasion: 1, tpGain: 4, effects: [normalAttackState] });
    add({ name: "Escape", scope: 11, stypeId: 0, message1: "%1 fled.", occasion: 1, effects: [{ code: 41, dataId: 0, value1: 1, value2: 0 }] });
    add({ name: "Wait", scope: 0, stypeId: 0, message1: "%1 is waiting.", occasion: 1 });
    add({ name: "Heal", iconIndex: 72, animationId: anim("Heal One 1"), damage: dmg(3, "200 + a.mat"), scope: 7, stypeId: 1, mpCost: 5, message1: "%1 casts %2!", description: "Restores a little HP to one ally.", tpGain: 10 });
    add({ name: "Fire", iconIndex: 64, animationId: anim("Fire One 1"), damage: dmg(1, "100 + a.mat * 2 - b.mdf * 2", 2), hitType: 2, scope: 1, stypeId: 1, mpCost: 5, occasion: 1, message1: "%1 casts %2!", description: "Fire damage to one enemy.", tpGain: 10 });
    add({ name: "Spark", iconIndex: 66, animationId: anim("Thunder One 1"), damage: dmg(1, "100 + a.mat * 2 - b.mdf * 2", 4), hitType: 2, scope: 1, stypeId: 1, mpCost: 5, occasion: 1, message1: "%1 casts %2!", description: "Thunder damage to one enemy.", tpGain: 10 });
    add({ name: "Ice", iconIndex: 65, animationId: anim("Ice One 1"), damage: dmg(1, "100 + a.mat * 2 - b.mdf * 2", 3), hitType: 2, scope: 1, stypeId: 1, mpCost: 5, occasion: 1, message1: "%1 casts %2!", description: "Ice damage to one enemy.", tpGain: 10 });
    add({ name: "Strong Strike", iconIndex: 76, animationId: anim("Slash Special 1"), damage: dmg(1, "a.atk * 6 - b.def * 2", -1, true), hitType: 1, scope: 1, stypeId: 2, tpCost: 20, occasion: 1, message1: "%1 uses %2!", description: "A powerful blow against one enemy." });
    add({ name: "Whirlwind", iconIndex: 77, animationId: anim("Sweep"), damage: dmg(1, "a.atk * 3 - b.def * 2", -1, true), hitType: 1, scope: 2, stypeId: 2, tpCost: 30, occasion: 1, message1: "%1 uses %2!", description: "Strikes all enemies." });
    add({ name: "Cure", iconIndex: 72, animationId: anim("Cure One 1"), scope: 7, stypeId: 1, mpCost: 4, message1: "%1 casts %2!", description: "Removes poison and blindness.", effects: [{ code: 22, dataId: 4, value1: 1, value2: 0 }, { code: 22, dataId: 5, value1: 1, value2: 0 }] });
    return list;
}

function items(anim) {
    const list = [null];
    const add = props => list.push({ ...blankItem(list.length), ...props });
    add({ name: "Potion", iconIndex: 176, animationId: anim("Heal One 1"), description: "Restores 500 HP to one ally.", price: 50, scope: 7, effects: [{ code: 11, dataId: 0, value1: 0, value2: 500 }] });
    add({ name: "Magic Water", iconIndex: 176, animationId: anim("Heal One 2"), description: "Restores 200 MP to one ally.", price: 100, scope: 7, effects: [{ code: 12, dataId: 0, value1: 0, value2: 200 }] });
    add({ name: "Dispel Herb", iconIndex: 177, animationId: anim("Cure One 1"), description: "Cures poison and blindness.", price: 30, scope: 7, effects: [{ code: 22, dataId: 4, value1: 1, value2: 0 }, { code: 22, dataId: 5, value1: 1, value2: 0 }] });
    add({ name: "Stimulant", iconIndex: 178, animationId: anim("Revive 1"), description: "Revives a fallen ally.", price: 200, scope: 9, effects: [{ code: 22, dataId: 1, value1: 1, value2: 0 }, { code: 11, dataId: 0, value1: 0.1, value2: 0 }] });
    add({ name: "Old Key", iconIndex: 195, description: "A rusty key.", price: 0, itypeId: 2, consumable: false, occasion: 3 });
    return list;
}

function weapons() {
    const list = [null];
    const add = props => list.push({ ...blankWeapon(list.length), ...props });
    add({ name: "Sword", iconIndex: 97, wtypeId: 2, price: 500, animationId: 6, params: [0, 0, 10, 0, 0, 0, 0, 0], description: "A standard sword." });
    add({ name: "Axe", iconIndex: 99, wtypeId: 4, price: 500, animationId: 6, params: [0, 0, 12, 0, 0, 0, 0, 0], description: "A heavy axe." });
    add({ name: "Flail", iconIndex: 98, wtypeId: 3, price: 500, animationId: 1, params: [0, 0, 9, 0, 2, 0, 0, 0], description: "A spiked flail." });
    add({ name: "Staff", iconIndex: 101, wtypeId: 6, price: 500, animationId: 1, params: [0, 0, 6, 0, 10, 0, 0, 0], description: "A magician's staff." });
    return list;
}

function armors() {
    const list = [null];
    const add = props => list.push({ ...blankArmor(list.length), ...props });
    add({ name: "Shield", iconIndex: 128, atypeId: 5, etypeId: 2, price: 300, params: [0, 0, 0, 10, 0, 0, 0, 0], description: "A small wooden shield." });
    add({ name: "Hat", iconIndex: 130, atypeId: 1, etypeId: 3, price: 300, params: [0, 0, 0, 5, 0, 5, 0, 0], description: "A simple hat." });
    add({ name: "Clothes", iconIndex: 135, atypeId: 1, etypeId: 4, price: 300, params: [0, 0, 0, 10, 0, 5, 0, 0], description: "Plain clothes." });
    add({ name: "Ring", iconIndex: 145, atypeId: 1, etypeId: 5, price: 500, params: [0, 0, 0, 0, 5, 5, 0, 0], description: "A ring of protection." });
    add({ name: "Circlet", iconIndex: 131, atypeId: 2, etypeId: 3, price: 300, params: [0, 10, 0, 3, 0, 8, 0, 0], description: "A magician's circlet." });
    add({ name: "Robe", iconIndex: 137, atypeId: 2, etypeId: 4, price: 300, params: [0, 20, 0, 6, 0, 10, 0, 0], description: "A light robe." });
    return list;
}

function enemies() {
    const list = [null];
    const add = (name, battlerName, params, exp, gold, actions, drop) => {
        const e = blankEnemy(list.length);
        Object.assign(e, { name, battlerName, params, exp, gold });
        if (actions) e.actions = actions;
        if (drop) e.dropItems[0] = drop;
        list.push(e);
    };
    add("Goblin", "Goblin", [200, 0, 30, 20, 10, 10, 20, 10], 10, 20, null, { dataId: 1, denominator: 3, kind: 1 });
    add("Harpy", "Harpy", [250, 20, 28, 18, 20, 18, 30, 12], 14, 25, [
        { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 },
        { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 3, skillId: 9 }
    ]);
    add("Treant", "Treant", [400, 0, 38, 30, 10, 12, 10, 10], 25, 40);
    add("Dragon", "Dragon", [2500, 200, 70, 50, 60, 50, 40, 30], 500, 800, [
        { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 },
        { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 13 },
        { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 4, skillId: 9 }
    ]);
    return list;
}

function troops() {
    const list = [null];
    const add = (name, members) => {
        const t = blankTroop(list.length);
        t.name = name;
        t.members = members.map(([enemyId, x, y]) => ({ enemyId, x, y, hidden: false }));
        list.push(t);
    };
    add("Goblin*2", [[1, 330, 436], [1, 486, 436]]);
    add("Harpy*2", [[2, 330, 436], [2, 486, 436]]);
    add("Treant", [[3, 408, 436]]);
    add("Dragon", [[4, 408, 436]]);
    return list;
}

function states() {
    const list = [null];
    const add = props => list.push({ ...blankState(list.length), ...props });
    add({ name: "Knockout", iconIndex: 1, restriction: 4, priority: 100, motion: 3, removeAtBattleEnd: false, message1: "%1 has fallen!", message2: "%1 is slain!", message4: "%1 revives!", traits: [{ code: 23, dataId: 9, value: 0 }] });
    add({ name: "Guard", priority: 0, removeAtBattleEnd: true, autoRemovalTiming: 2, traits: [{ code: 62, dataId: 1, value: 0 }] });
    add({ name: "Immortal", priority: 0, removeAtBattleEnd: true, traits: [{ code: 14, dataId: 1, value: 0 }] });
    add({ name: "Poison", iconIndex: 2, overlay: 1, priority: 50, message1: "%1 is poisoned!", message2: "%1 is poisoned!", message4: "%1 is no longer poisoned!", traits: [{ code: 22, dataId: 7, value: -0.1 }] });
    add({ name: "Blind", iconIndex: 3, overlay: 2, priority: 60, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, message1: "%1 is blinded!", message2: "%1 is blinded!", message4: "%1 is no longer blinded!", traits: [{ code: 22, dataId: 0, value: -0.6 }] });
    add({ name: "Silence", iconIndex: 4, overlay: 3, priority: 65, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, message1: "%1 is silenced!", message2: "%1 is silenced!", message4: "%1 is no longer silenced!", traits: [{ code: 42, dataId: 1, value: 1 }] });
    add({ name: "Rage", iconIndex: 5, overlay: 4, priority: 70, restriction: 1, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, message1: "%1 is enraged!", message2: "%1 is enraged!", message4: "%1 calms down!" });
    add({ name: "Confusion", iconIndex: 6, overlay: 5, priority: 75, restriction: 2, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, removeByDamage: true, chanceByDamage: 50, message1: "%1 is confused!", message2: "%1 is confused!", message4: "%1 is no longer confused!" });
    add({ name: "Fascination", iconIndex: 7, overlay: 6, priority: 80, restriction: 3, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, removeByDamage: true, chanceByDamage: 50, message1: "%1 is fascinated!", message2: "%1 is fascinated!", message4: "%1 comes to their senses!" });
    add({ name: "Sleep", iconIndex: 8, overlay: 7, motion: 2, priority: 90, restriction: 4, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, removeByDamage: true, chanceByDamage: 100, message1: "%1 falls asleep!", message2: "%1 falls asleep!", message3: "%1 is sleeping.", message4: "%1 wakes up!", traits: [{ code: 22, dataId: 1, value: -1 }] });
    add({ name: "Paralysis", iconIndex: 9, overlay: 8, motion: 1, priority: 95, restriction: 4, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 3, maxTurns: 5, message1: "%1 is paralyzed!", message2: "%1 is paralyzed!", message3: "%1 cannot move!", message4: "%1 is no longer paralyzed!", traits: [{ code: 22, dataId: 1, value: -1 }] });
    add({ name: "Stun", iconIndex: 10, overlay: 9, motion: 1, priority: 90, restriction: 4, removeAtBattleEnd: true, autoRemovalTiming: 1, minTurns: 1, maxTurns: 1, message1: "%1 is stunned!", message2: "%1 is stunned!", message3: "%1 cannot move!", message4: "%1 is no longer stunned!", traits: [{ code: 22, dataId: 1, value: -1 }] });
    return list;
}

export function defaultTerms() {
    return {
        basic: ["Level", "Lv", "HP", "HP", "MP", "MP", "TP", "TP", "EXP", "EXP"],
        commands: [
            "Fight", "Escape", "Attack", "Guard", "Item", "Skill", "Equip", "Status", "Formation", "Save",
            "Game End", "Options", "Weapon", "Armor", "Key Item", "Equip", "Optimize", "Clear", "New Game",
            "Continue", null, "To Title", "Cancel", null, "Buy", "Sell"
        ],
        params: ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "Hit", "Evasion"],
        messages: {
            alwaysDash: "Always Dash", commandRemember: "Command Remember", touchUI: "Touch UI",
            bgmVolume: "BGM Volume", bgsVolume: "BGS Volume", meVolume: "ME Volume", seVolume: "SE Volume",
            possession: "Possession", expTotal: "Current %1", expNext: "To Next %1",
            saveMessage: "Which file would you like to save to?", loadMessage: "Which file would you like to load?",
            file: "File", autosave: "Autosave", partyName: "%1's Party", emerge: "%1 emerged!",
            preemptive: "%1 got the upper hand!", surprise: "%1 was surprised!",
            escapeStart: "%1 has started to escape!", escapeFailure: "However, it was unable to escape!",
            victory: "%1 was victorious!", defeat: "%1 was defeated.", obtainExp: "%1 %2 received!",
            obtainGold: "%1\\G found!", obtainItem: "%1 found!", levelUp: "%1 is now %2 %3!",
            obtainSkill: "%1 learned!", useItem: "%1 uses %2!", criticalToEnemy: "An excellent hit!!",
            criticalToActor: "A painful blow!!", actorDamage: "%1 took %2 damage!",
            actorRecovery: "%1 recovered %2 %3!", actorGain: "%1 gained %2 %3!", actorLoss: "%1 lost %2 %3!",
            actorDrain: "%1 was drained of %2 %3!", actorNoDamage: "%1 took no damage!",
            actorNoHit: "Miss! %1 took no damage!", enemyDamage: "%1 took %2 damage!",
            enemyRecovery: "%1 recovered %2 %3!", enemyGain: "%1 gained %2 %3!", enemyLoss: "%1 lost %2 %3!",
            enemyDrain: "%1 was drained of %2 %3!", enemyNoDamage: "%1 took no damage!",
            enemyNoHit: "Miss! %1 took no damage!", evasion: "%1 evaded the attack!",
            magicEvasion: "%1 nullified the magic!", magicReflection: "%1 reflected the magic!",
            counterAttack: "%1 made a counterattack!", substitute: "%1 protected %2!",
            buffAdd: "%1's %2 went up!", debuffAdd: "%1's %2 went down!",
            buffRemove: "%1's %2 returned to normal!", actionFailure: "There was no effect on %1!"
        }
    };
}

export function defaultSystem(gameTitle = "New Game") {
    const vehicle = (bgm, characterIndex) => ({
        bgm: audio(bgm), characterIndex, characterName: "Vehicle", startMapId: 0, startX: 0, startY: 0
    });
    const names = n => Array.from({ length: n + 1 }, () => "");
    return {
        advanced: {
            gameId: Math.floor(Math.random() * 1e8),
            screenWidth: 816, screenHeight: 624, uiAreaWidth: 816, uiAreaHeight: 624,
            numberFontFilename: "mplus-2p-bold-sub.ttf", fallbackFonts: "Verdana, sans-serif", fontSize: 26,
            mainFontFilename: "mplus-1m-regular.ttf", windowOpacity: 192, screenScale: 1, picturesUpperLimit: 100
        },
        airship: vehicle("Ship3", 3),
        armorTypes: ["", "General Armor", "Magic Armor", "Light Armor", "Heavy Armor", "Small Shield", "Large Shield"],
        attackMotions: [
            { type: 0, weaponImageId: 0 }, { type: 0, weaponImageId: 1 }, { type: 1, weaponImageId: 2 },
            { type: 1, weaponImageId: 3 }, { type: 1, weaponImageId: 4 }, { type: 1, weaponImageId: 5 },
            { type: 1, weaponImageId: 6 }, { type: 2, weaponImageId: 7 }, { type: 2, weaponImageId: 8 },
            { type: 2, weaponImageId: 9 }, { type: 0, weaponImageId: 10 }, { type: 0, weaponImageId: 11 },
            { type: 0, weaponImageId: 12 }
        ],
        battleBgm: audio("Battle1"),
        battleback1Name: "Grassland",
        battleback2Name: "Grassland",
        battlerHue: 0,
        battlerName: "Dragon",
        battleSystem: 0,
        boat: vehicle("Ship1", 0),
        currencyUnit: "G",
        defeatMe: audio("Defeat1"),
        editMapId: 1,
        elements: ["", "Physical", "Fire", "Ice", "Thunder", "Water", "Earth", "Wind", "Light", "Darkness"],
        equipTypes: ["", "Weapon", "Shield", "Head", "Body", "Accessory"],
        faceSize: 144,
        gameTitle,
        gameoverMe: audio("Gameover1"),
        iconSize: 32,
        itemCategories: [true, true, true, true],
        locale: "en_US",
        magicSkills: [1],
        menuCommands: [true, true, true, true, true, true],
        optAutosave: true,
        optDisplayTp: true,
        optDrawTitle: true,
        optExtraExp: false,
        optFloorDeath: false,
        optFollowers: true,
        optKeyItemsNumber: false,
        optMessageSkip: true,
        optSideView: true,
        optSlipDeath: false,
        optSplashScreen: false,
        optTransparent: false,
        partyMembers: [1, 2, 3, 4],
        ship: vehicle("Ship2", 1),
        skillTypes: ["", "Magic", "Special"],
        sounds: [
            se("Cursor2"), se("Decision1"), se("Cancel2"), se("Buzzer1"), se("Equip1"), se("Save1"),
            se("Load1"), se("Battle1"), se("Run"), se("Attack3"), se("Damage4"), se("Collapse1"),
            se("Collapse2"), se("Collapse3"), se("Damage5"), se("Collapse4"), se("Recovery"), se("Miss"),
            se("Evasion1"), se("Evasion2"), se("Reflection"), se("Shop1"), se("Item3"), se("Skill2")
        ],
        startMapId: 1,
        startX: 8,
        startY: 6,
        switches: names(20),
        terms: defaultTerms(),
        testBattlers: [
            { actorId: 1, level: 1, equips: [1, 1, 2, 3, 0] },
            { actorId: 2, level: 1, equips: [4, 0, 5, 6, 0] },
            { actorId: 3, level: 1, equips: [2, 1, 2, 3, 0] },
            { actorId: 4, level: 1, equips: [3, 0, 5, 6, 0] }
        ],
        testTroopId: 1,
        tileSize: 48,
        title1Name: "Sword",
        title2Name: "",
        titleBgm: audio("Theme6"),
        titleCommandWindow: { background: 0, offsetX: 0, offsetY: 0 },
        variables: names(20),
        versionId: Math.floor(Math.random() * 1e8),
        victoryMe: audio("Victory1"),
        weaponTypes: ["", "Dagger", "Sword", "Flail", "Axe", "Whip", "Staff", "Bow", "Crossbow", "Gun", "Claw", "Glove", "Spear"],
        windowTone: [0, 0, 0, 0],
        editor: { messageWidth1: 60, messageWidth2: 47, jsonFormatLevel: 1 }
    };
}

export function blankMap(width = 17, height = 13, tilesetId = 1, fillTileId = 0) {
    const data = new Array(width * height * 6).fill(0);
    if (fillTileId) for (let i = 0; i < width * height; i++) data[i] = fillTileId;
    return {
        autoplayBgm: false, autoplayBgs: false, battleback1Name: "", battleback2Name: "",
        bgm: audio(""), bgs: audio(""), disableDashing: false, displayName: "", encounterList: [],
        encounterStep: 30, height, note: "", parallaxLoopX: false, parallaxLoopY: false, parallaxName: "",
        parallaxShow: true, parallaxSx: 0, parallaxSy: 0, scrollType: 0, specifyBattleback: false,
        tilesetId, width, data, events: [null]
    };
}

export function mapInfo(id, name, parentId = 0, order = id) {
    return { id, expanded: false, name, order, parentId, scrollX: 0, scrollY: 0 };
}

// Builds a complete starter database. `templates` may provide
// { tilesets, animations } (arrays in MZ format) from the RTP.
export function createDefaultDatabase(gameTitle = "New Game", templates = {}) {
    const animations = templates.animations || [null];
    const anim = name => {
        const a = animations.find(x => x && x.name === name);
        return a ? a.id : 0;
    };
    const tilesets = templates.tilesets || [null, { ...blankTileset(1), name: "Default" }];
    const outsideId = (tilesets.find(t => t && t.name === "Outside") || tilesets[1]).id;

    const map1 = blankMap(17, 13, outsideId, 2816);
    // A small welcome event beside the start position.
    const ev = blankEvent(1, 10, 6);
    ev.name = "Guide";
    ev.pages[0].priorityType = 1;
    ev.pages[0].image = { tileId: 0, characterName: "People1", direction: 2, pattern: 1, characterIndex: 0 };
    ev.pages[0].list = [
        { code: 101, indent: 0, parameters: ["People1", 0, 0, 2, "Guide"] },
        { code: 401, indent: 0, parameters: ["Welcome to RPG Maker 9000!"] },
        { code: 401, indent: 0, parameters: ["Press \\C[2]Esc\\C[0] to open the menu."] },
        { code: 0, indent: 0, parameters: [] }
    ];
    map1.events.push(ev);

    return {
        Actors: actors(),
        Classes: classes(),
        Skills: skills(anim),
        Items: items(anim),
        Weapons: weapons(),
        Armors: armors(),
        Enemies: enemies(),
        Troops: troops(),
        States: states(),
        Animations: animations,
        Tilesets: tilesets,
        CommonEvents: [null, blankCommonEvent(1)],
        System: defaultSystem(gameTitle),
        MapInfos: [null, mapInfo(1, "MAP001")],
        maps: { 1: map1 }
    };
}
