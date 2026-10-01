// traits.js — Traits and Effects list editors with their dialogs.
import { h, deepClone, idName } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { ListBox, numberInput, selectInput, button } from "../ui/widgets.js";
import { dbOptions, typeOptions } from "./dbFields.js";

const PARAMS = ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck"];
const XPARAMS = ["Hit Rate", "Evasion Rate", "Critical Rate", "Critical Evasion", "Magic Evasion", "Magic Reflection", "Counter Attack", "HP Regeneration", "MP Regeneration", "TP Regeneration"];
const SPARAMS = ["Target Rate", "Guard Effect", "Recovery Effect", "Pharmacology", "MP Cost Rate", "TP Charge Rate", "Physical Damage", "Magic Damage", "Floor Damage", "Experience"];
const SPECIAL_FLAGS = ["Auto Battle", "Guard", "Substitute", "Preserve TP"];
const COLLAPSE = ["Normal", "Boss", "Instant", "No Disappear"];
const PARTY_ABILITIES = ["Encounter Half", "Encounter None", "Cancel Surprise", "Raise Preemptive", "Gold Double", "Drop Item Double"];

const pct = v => Math.round(v * 100) + "%";
const signedPct = v => (v >= 0 ? "+ " : "- ") + Math.round(Math.abs(v) * 100) + "%";

export function traitText(db, t) {
    const sys = db.System;
    const name = (arr, id) => (arr[id] ? arr[id].name : "?");
    switch (t.code) {
        case 11:
            return ["Element Rate", (sys.elements[t.dataId] || "?") + " * " + pct(t.value)];
        case 12:
            return ["Debuff Rate", PARAMS[t.dataId] + " * " + pct(t.value)];
        case 13:
            return ["State Rate", name(db.States, t.dataId) + " * " + pct(t.value)];
        case 14:
            return ["State Resist", name(db.States, t.dataId)];
        case 21:
            return ["Parameter", PARAMS[t.dataId] + " * " + pct(t.value)];
        case 22:
            return ["Ex-Parameter", XPARAMS[t.dataId] + " " + signedPct(t.value)];
        case 23:
            return ["Sp-Parameter", SPARAMS[t.dataId] + " * " + pct(t.value)];
        case 31:
            return ["Attack Element", sys.elements[t.dataId] || "?"];
        case 32:
            return ["Attack State", name(db.States, t.dataId) + " + " + pct(t.value)];
        case 33:
            return ["Attack Speed", String(t.value)];
        case 34:
            return ["Attack Times +", String(t.value)];
        case 35:
            return ["Attack Skill", name(db.Skills, t.dataId)];
        case 41:
            return ["Add Skill Type", sys.skillTypes[t.dataId] || "?"];
        case 42:
            return ["Seal Skill Type", sys.skillTypes[t.dataId] || "?"];
        case 43:
            return ["Add Skill", name(db.Skills, t.dataId)];
        case 44:
            return ["Seal Skill", name(db.Skills, t.dataId)];
        case 51:
            return ["Equip Weapon", sys.weaponTypes[t.dataId] || "?"];
        case 52:
            return ["Equip Armor", sys.armorTypes[t.dataId] || "?"];
        case 53:
            return ["Lock Equip", sys.equipTypes[t.dataId] || "?"];
        case 54:
            return ["Seal Equip", sys.equipTypes[t.dataId] || "?"];
        case 55:
            return ["Slot Type", t.dataId === 1 ? "Dual Wield" : "Normal"];
        case 61:
            return ["Action Times +", pct(t.value)];
        case 62:
            return ["Special Flag", SPECIAL_FLAGS[t.dataId]];
        case 63:
            return ["Collapse Effect", COLLAPSE[t.dataId]];
        case 64:
            return ["Party Ability", PARTY_ABILITIES[t.dataId]];
    }
    return ["?", ""];
}

// Trait kinds: [code, label, dataOptions(db) | null, valueKind]
// valueKind: "rate" (x%), "add" (±%), "number", "none", "chance"
const TRAIT_KINDS = [
    ["Rate", [
        [11, "Element Rate", db => typeOptions(db.System.elements), "rate"],
        [12, "Debuff Rate", () => PARAMS.map((p, i) => [i, p]), "rate"],
        [13, "State Rate", db => dbOptions(db.States), "rate"],
        [14, "State Resist", db => dbOptions(db.States), "none"]
    ]],
    ["Param", [
        [21, "Parameter", () => PARAMS.map((p, i) => [i, p]), "rate"],
        [22, "Ex-Parameter", () => XPARAMS.map((p, i) => [i, p]), "add"],
        [23, "Sp-Parameter", () => SPARAMS.map((p, i) => [i, p]), "rate"]
    ]],
    ["Attack", [
        [31, "Attack Element", db => typeOptions(db.System.elements), "none"],
        [32, "Attack State", db => dbOptions(db.States), "chance"],
        [33, "Attack Speed", null, "number"],
        [34, "Attack Times +", null, "number"],
        [35, "Attack Skill", db => dbOptions(db.Skills), "none"]
    ]],
    ["Skill", [
        [41, "Add Skill Type", db => typeOptions(db.System.skillTypes), "none"],
        [42, "Seal Skill Type", db => typeOptions(db.System.skillTypes), "none"],
        [43, "Add Skill", db => dbOptions(db.Skills), "none"],
        [44, "Seal Skill", db => dbOptions(db.Skills), "none"]
    ]],
    ["Equip", [
        [51, "Equip Weapon", db => typeOptions(db.System.weaponTypes), "none"],
        [52, "Equip Armor", db => typeOptions(db.System.armorTypes), "none"],
        [53, "Lock Equip", db => typeOptions(db.System.equipTypes), "none"],
        [54, "Seal Equip", db => typeOptions(db.System.equipTypes), "none"],
        [55, "Slot Type", () => [[0, "Normal"], [1, "Dual Wield"]], "none"]
    ]],
    ["Other", [
        [61, "Action Times +", null, "chance"],
        [62, "Special Flag", () => SPECIAL_FLAGS.map((p, i) => [i, p]), "none"],
        [63, "Collapse Effect", () => COLLAPSE.map((p, i) => [i, p]), "none"],
        [64, "Party Ability", () => PARTY_ABILITIES.map((p, i) => [i, p]), "none"]
    ]]
];

function kindFor(code, table) {
    for (const [, kinds] of table) for (const k of kinds) if (k[0] === code) return k;
    return null;
}

// Generic dialog used by both traits and effects.
async function editCoded(db, title, table, entry, valueFields) {
    const e = deepClone(entry);
    let tabIndex = table.findIndex(([, kinds]) => kinds.some(k => k[0] === e.code));
    if (tabIndex < 0) tabIndex = 0;
    const bar = h("div", { class: "tabbar" });
    const content = h("div", { class: "col", style: { minWidth: "460px", minHeight: "220px", padding: "6px 0" } });
    const name = "k" + Math.random().toString(36).slice(2);
    const render = () => {
        content.innerHTML = "";
        [...bar.children].forEach((t, i) => t.classList.toggle("active", i === tabIndex));
        for (const kind of table[tabIndex][1]) {
            const [code, label, options] = kind;
            const selected = e.code === code;
            const radio = h("input", { type: "radio", name, checked: selected });
            radio.addEventListener("change", () => {
                if (!radio.checked) return;
                e.code = code;
                const opts = options ? options(db) : null;
                e.dataId = opts && opts.length ? opts[0][0] : 0;
                valueFields.reset(e, kind);
                render();
            });
            const controls = h("div", { class: "row center" });
            if (selected) {
                if (options) controls.appendChild(selectInput(e.dataId, options(db), v => (e.dataId = v), { width: 200 }));
                controls.append(...valueFields.build(e, kind));
            }
            content.appendChild(h("div", { class: "row center", style: { minHeight: "28px" } }, h("label", { class: "check-label", style: { width: "150px" } }, radio, label), controls));
        }
    };
    table.forEach(([label], i) => {
        const t = h("div", { class: "tab" }, label);
        t.addEventListener("mousedown", () => {
            tabIndex = i;
            render();
        });
        bar.appendChild(t);
    });
    render();
    const ok = await openDialog({ title, body: h("div", { class: "col" }, bar, content) });
    return ok ? e : null;
}

const traitValues = {
    reset(t, kind) {
        t.value = { rate: 1, add: 0, number: 0, none: 1, chance: 1 }[kind[3]];
        if (kind[0] === 14 || kind[0] === 31 || kind[0] >= 41) t.value = kind[3] === "chance" ? 1 : 1;
        if (kind[0] === 61) t.value = 1;
        if (kind[0] === 33 || kind[0] === 34) t.value = 0;
    },
    build(t, kind) {
        const vk = kind[3];
        if (vk === "rate" || vk === "chance") {
            return ["*", numberInput(Math.round(t.value * 100), v => (t.value = v / 100), { min: 0, max: 1000, width: 80 }), "%"];
        }
        if (vk === "add") return ["+", numberInput(Math.round(t.value * 100), v => (t.value = v / 100), { min: -1000, max: 1000, width: 80 }), "%"];
        if (vk === "number") return [numberInput(t.value, v => (t.value = v), { min: -999, max: 999, width: 80 })];
        return [];
    }
};

export class TraitsEditor {
    constructor(db, obj, key = "traits", options = {}) {
        this.db = db;
        this.obj = obj;
        this.key = key;
        this.list = new ListBox({
            columns: [130],
            header: ["Type", "Content"],
            onActivate: i => this.edit(i),
            trailingRow: " ",
            onKey: e => {
                if (e.key === "Delete") this.remove();
            }
        });
        this.list.el.style.height = (options.height || 160) + "px";
        this.el = h("fieldset", {}, h("legend", {}, options.title || "Traits"), this.list.el);
        this.render();
    }

    render() {
        this.list.setItems(this.obj[this.key].map(t => {
            const [type, content] = traitText(this.db, t);
            return { cells: [type, content] };
        }));
    }

    async edit(i) {
        const isNew = i >= this.obj[this.key].length;
        const entry = isNew ? { code: 11, dataId: 1, value: 1 } : this.obj[this.key][i];
        const r = await editCoded(this.db, "Traits", TRAIT_KINDS, entry, traitValues);
        if (!r) return;
        if (isNew) this.obj[this.key].push(r);
        else this.obj[this.key][i] = r;
        this.render();
        this.list.select(i);
    }

    remove() {
        const i = this.list.index;
        if (i >= 0 && i < this.obj[this.key].length) {
            this.obj[this.key].splice(i, 1);
            this.render();
        }
    }
}

//-----------------------------------------------------------------------------
// Effects

export function effectText(db, e) {
    const name = (arr, id) => (arr[id] ? arr[id].name : "?");
    switch (e.code) {
        case 11:
            return ["Recover HP", Math.round(e.value1 * 100) + "% + " + e.value2];
        case 12:
            return ["Recover MP", Math.round(e.value1 * 100) + "% + " + e.value2];
        case 13:
            return ["Gain TP", String(e.value1)];
        case 21:
            return ["Add State", (e.dataId === 0 ? "Normal Attack" : name(db.States, e.dataId)) + " " + Math.round(e.value1 * 100) + "%"];
        case 22:
            return ["Remove State", name(db.States, e.dataId) + " " + Math.round(e.value1 * 100) + "%"];
        case 31:
            return ["Add Buff", PARAMS[e.dataId] + " " + e.value1 + " turns"];
        case 32:
            return ["Add Debuff", PARAMS[e.dataId] + " " + e.value1 + " turns"];
        case 33:
            return ["Remove Buff", PARAMS[e.dataId]];
        case 34:
            return ["Remove Debuff", PARAMS[e.dataId]];
        case 41:
            return ["Special Effect", "Escape"];
        case 42:
            return ["Grow", PARAMS[e.dataId] + " + " + e.value1];
        case 43:
            return ["Learn Skill", name(db.Skills, e.dataId)];
        case 44:
            return ["Common Event", name(db.CommonEvents, e.dataId)];
    }
    return ["?", ""];
}

const EFFECT_KINDS = [
    ["Recover", [
        [11, "Recover HP", null, "recover"],
        [12, "Recover MP", null, "recover"],
        [13, "Gain TP", null, "tp"]
    ]],
    ["State", [
        [21, "Add State", db => [[0, "Normal Attack"], ...dbOptions(db.States)], "chance"],
        [22, "Remove State", db => dbOptions(db.States), "chance"]
    ]],
    ["Param", [
        [31, "Add Buff", () => PARAMS.map((p, i) => [i, p]), "turns"],
        [32, "Add Debuff", () => PARAMS.map((p, i) => [i, p]), "turns"],
        [33, "Remove Buff", () => PARAMS.map((p, i) => [i, p]), "none"],
        [34, "Remove Debuff", () => PARAMS.map((p, i) => [i, p]), "none"]
    ]],
    ["Other", [
        [41, "Special Effect", () => [[0, "Escape"]], "none"],
        [42, "Grow", () => PARAMS.map((p, i) => [i, p]), "grow"],
        [43, "Learn Skill", db => dbOptions(db.Skills), "none"],
        [44, "Common Event", db => dbOptions(db.CommonEvents), "none"]
    ]]
];

const effectValues = {
    reset(e, kind) {
        e.value1 = { recover: 0, tp: 0, chance: 1, turns: 5, none: 1, grow: 1 }[kind[3]];
        e.value2 = 0;
    },
    build(e, kind) {
        const vk = kind[3];
        if (vk === "recover") {
            return [numberInput(Math.round(e.value1 * 100), v => (e.value1 = v / 100), { min: -100, max: 100, width: 70 }), "% +", numberInput(e.value2, v => (e.value2 = v), { min: -9999, max: 9999, width: 80 })];
        }
        if (vk === "tp") return [numberInput(e.value1, v => (e.value1 = v), { min: -100, max: 100, width: 80 })];
        if (vk === "chance") return [numberInput(Math.round(e.value1 * 100), v => (e.value1 = v / 100), { min: 0, max: 1000, width: 80 }), "%"];
        if (vk === "turns") return [numberInput(e.value1, v => (e.value1 = v), { min: 1, max: 1000, width: 70 }), "turns"];
        if (vk === "grow") return ["+", numberInput(e.value1, v => (e.value1 = v), { min: 1, max: 1000, width: 70 })];
        return [];
    }
};

export class EffectsEditor {
    constructor(db, obj, options = {}) {
        this.db = db;
        this.obj = obj;
        this.list = new ListBox({
            columns: [130],
            header: ["Type", "Content"],
            onActivate: i => this.edit(i),
            trailingRow: " ",
            onKey: e => {
                if (e.key === "Delete") this.remove();
            }
        });
        this.list.el.style.height = (options.height || 160) + "px";
        this.el = h("fieldset", {}, h("legend", {}, "Effects"), this.list.el);
        this.render();
    }

    render() {
        this.list.setItems(this.obj.effects.map(e => {
            const [type, content] = effectText(this.db, e);
            return { cells: [type, content] };
        }));
    }

    async edit(i) {
        const isNew = i >= this.obj.effects.length;
        const entry = isNew ? { code: 11, dataId: 0, value1: 0, value2: 0 } : this.obj.effects[i];
        const r = await editCoded(this.db, "Effects", EFFECT_KINDS, entry, effectValues);
        if (!r) return;
        if (isNew) this.obj.effects.push(r);
        else this.obj.effects[i] = r;
        this.render();
        this.list.select(i);
    }

    remove() {
        const i = this.list.index;
        if (i >= 0 && i < this.obj.effects.length) {
            this.obj.effects.splice(i, 1);
            this.render();
        }
    }
}

export { PARAMS, XPARAMS, SPARAMS, idName, button, kindFor };
