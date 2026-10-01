// Skills and Items tabs (shared damage / invocation / effects sections).
import { h } from "../../ui/dom.js";
import { fieldset, field, selectInput } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindNum, bindSelect, bindCheck, bindIcon, dbOptions, typeOptions, labeled } from "../dbFields.js";
import { EffectsEditor } from "../traits.js";

export const SCOPES = [
    [0, "None"],
    [1, "1 Enemy"],
    [2, "All Enemies"],
    [3, "1 Random Enemy"],
    [4, "2 Random Enemies"],
    [5, "3 Random Enemies"],
    [6, "4 Random Enemies"],
    [7, "1 Ally"],
    [8, "All Allies"],
    [9, "1 Ally (Dead)"],
    [10, "All Allies (Dead)"],
    [11, "The User"],
    [12, "1 Ally (Unconditional)"],
    [13, "All Allies (Unconditional)"],
    [14, "Enemies & Allies"]
];
const OCCASIONS = [[0, "Always"], [1, "Battle Screen"], [2, "Menu Screen"], [3, "Never"]];
const HIT_TYPES = [[0, "Certain Hit"], [1, "Physical Attack"], [2, "Magical Attack"]];
const DAMAGE_TYPES = [[0, "None"], [1, "HP Damage"], [2, "MP Damage"], [3, "HP Recover"], [4, "MP Recover"], [5, "HP Drain"], [6, "MP Drain"]];
const SKILL_MESSAGES = [
    ["", "(custom)"],
    ["%1 casts %2!", "%1 casts %2!"],
    ["%1 does %2!", "%1 does %2!"],
    ["%1 uses %2!", "%1 uses %2!"]
];

function damageSection(db, obj) {
    const sys = db.System;
    const formula = bindText(obj.damage, "formula", { width: 360 });
    const els = [];
    const sync = () => {
        const on = obj.damage.type > 0;
        for (const el of els) el.querySelectorAll("input, select").forEach(x => (x.disabled = !on));
    };
    const typeRow = labeled("Type", bindSelect(obj.damage, "type", DAMAGE_TYPES, { onChange: sync }), 70);
    const elRow = labeled("Element", bindSelect(obj.damage, "elementId", [[-1, "Normal Attack"], ...typeOptions(sys.elements, { none: true })]), 70);
    const fRow = labeled("Formula", formula, 70);
    const vRow = h("div", { class: "row center" }, labeled("Variance", bindNum(obj.damage, "variance", { min: 0, max: 100, width: 60 }), 70), "%", bindCheck(obj.damage, "critical", "Critical Hits"));
    els.push(elRow, fRow, vRow);
    setTimeout(sync, 0);
    return fieldset("Damage", h("div", { class: "col" }, typeRow, elRow, fRow, vRow, h("div", { class: "hint" }, "Formula variables: a (user), b (target), v[n] (variables). e.g. a.atk * 4 - b.def * 2")));
}

function invocationSection(db, obj) {
    return fieldset(
        "Invocation",
        h(
            "div",
            { class: "grid-4" },
            field("Speed", bindNum(obj, "speed", { min: -2000, max: 2000 })),
            field("Success", h("div", { class: "row center" }, bindNum(obj, "successRate", { min: 0, max: 100, width: 60 }), "%")),
            field("Repeat", bindNum(obj, "repeats", { min: 1, max: 9 })),
            field("TP Gain", bindNum(obj, "tpGain", { min: 0, max: 100 })),
            field("Hit Type", bindSelect(obj, "hitType", HIT_TYPES)),
            h("div", { style: { gridColumn: "span 2" } }, field("Animation", bindSelect(obj, "animationId", [[-1, "Normal Attack"], [0, "None"], ...dbOptions(db.Animations)])))
        )
    );
}

export function skillsTab(env) {
    const db = env.db;
    return listTab(env, "Skills", (skill, ui) => {
        const sys = db.System;
        const msg1 = bindText(skill, "message1", { width: 260 });
        return h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, field("Name", bindText(skill, "name", { onChange: ui.updateName, width: 260 })), field("Icon", bindIcon(skill, "iconIndex"))),
                    field("Description", bindArea(skill, "description", { rows: 2 })),
                    h(
                        "div",
                        { class: "grid-4" },
                        field("Skill Type", bindSelect(skill, "stypeId", typeOptions(sys.skillTypes, { none: true }))),
                        field("MP Cost", bindNum(skill, "mpCost", { min: 0, max: 9999 })),
                        field("TP Cost", bindNum(skill, "tpCost", { min: 0, max: 100 })),
                        field("Scope", bindSelect(skill, "scope", SCOPES)),
                        field("Occasion", bindSelect(skill, "occasion", OCCASIONS))
                    )
                )
            ),
            invocationSection(db, skill),
            fieldset(
                "Message",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row center" }, "(User Name)", msg1, selectInput("", SKILL_MESSAGES, v => {
                        if (v) {
                            skill.message1 = v;
                            msg1.value = v;
                        }
                    })),
                    h("div", { class: "row center" }, "(Line 2)", bindText(skill, "message2", { width: 260 }))
                )
            ),
            fieldset(
                "Required Weapon",
                h("div", { class: "row" }, field("Weapon Type 1", bindSelect(skill, "requiredWtypeId1", typeOptions(sys.weaponTypes, { none: true }))), field("Weapon Type 2", bindSelect(skill, "requiredWtypeId2", typeOptions(sys.weaponTypes, { none: true }))))
            ),
            h("div", { class: "row", style: { alignItems: "stretch" } }, h("div", { class: "grow" }, damageSection(db, skill)), h("div", { class: "grow" }, new EffectsEditor(db, skill, { height: 150 }).el)),
            field("Note", bindArea(skill, "note", { rows: 3 }))
        );
    });
}

export function itemsTab(env) {
    const db = env.db;
    return listTab(env, "Items", (item, ui) =>
        h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, field("Name", bindText(item, "name", { onChange: ui.updateName, width: 260 })), field("Icon", bindIcon(item, "iconIndex"))),
                    field("Description", bindArea(item, "description", { rows: 2 })),
                    h(
                        "div",
                        { class: "grid-4" },
                        field("Item Type", bindSelect(item, "itypeId", [[1, "Regular Item"], [2, "Key Item"], [3, "Hidden Item A"], [4, "Hidden Item B"]])),
                        field("Price", bindNum(item, "price", { min: 0, max: 9999999 })),
                        field("Consumable", bindSelect(item, "consumable", [[true, "Yes"], [false, "No"]])),
                        field("Scope", bindSelect(item, "scope", SCOPES)),
                        field("Occasion", bindSelect(item, "occasion", OCCASIONS))
                    )
                )
            ),
            invocationSection(db, item),
            h("div", { class: "row", style: { alignItems: "stretch" } }, h("div", { class: "grow" }, damageSection(db, item)), h("div", { class: "grow" }, new EffectsEditor(db, item, { height: 150 }).el)),
            field("Note", bindArea(item, "note", { rows: 3 }))
        )
    );
}
