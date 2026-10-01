// Enemies tab
import { h, idName } from "../../ui/dom.js";
import { openDialog } from "../../ui/dialog.js";
import { fieldset, field, ListBox, numberInput, selectInput, button } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindNum, bindSelect, bindImage, dbOptions } from "../dbFields.js";
import { TraitsEditor, PARAMS } from "../traits.js";
import { loadImage, whenReady } from "../../core/images.js";
import { switchVariablePicker, switchVariableLabel } from "../../ui/pickers.js";

const CONDITIONS = ["Always", "Turn", "HP", "MP", "State", "Party Level", "Switch"];

export function conditionText(db, a, store) {
    switch (a.conditionType) {
        case 0:
            return "Always";
        case 1:
            return "Turn " + a.conditionParam1 + "+" + a.conditionParam2 + "*X";
        case 2:
            return "HP " + Math.round(a.conditionParam1 * 100) + "%~" + Math.round(a.conditionParam2 * 100) + "%";
        case 3:
            return "MP " + Math.round(a.conditionParam1 * 100) + "%~" + Math.round(a.conditionParam2 * 100) + "%";
        case 4:
            return "State " + ((db.States[a.conditionParam1] || {}).name || "?");
        case 5:
            return "Party Level ≥ " + a.conditionParam1;
        case 6:
            return "Switch " + switchVariableLabel(store, "switch", a.conditionParam1);
    }
    return "?";
}

async function editAction(env, action) {
    const db = env.db;
    const a = { ...action };
    const type = a.conditionType;
    // per-condition param storage
    const P = {
        1: [type === 1 ? a.conditionParam1 : 0, type === 1 ? a.conditionParam2 : 0],
        2: [type === 2 ? Math.round(a.conditionParam1 * 100) : 0, type === 2 ? Math.round(a.conditionParam2 * 100) : 100],
        3: [type === 3 ? Math.round(a.conditionParam1 * 100) : 0, type === 3 ? Math.round(a.conditionParam2 * 100) : 100],
        4: [type === 4 ? a.conditionParam1 : 1],
        5: [type === 5 ? a.conditionParam1 : 1],
        6: [type === 6 ? a.conditionParam1 : 1]
    };
    const name = "c" + Math.random().toString(36).slice(2);
    const swBtn = button(switchVariableLabel(env.store, "switch", P[6][0]), async () => {
        const r = await switchVariablePicker(env.store, "switch", P[6][0]);
        if (r) {
            P[6][0] = r;
            swBtn.textContent = switchVariableLabel(env.store, "switch", r);
        }
    });
    const controls = {
        0: [],
        1: [numberInput(P[1][0], v => (P[1][0] = v), { min: 0, max: 999, width: 60 }), "+", numberInput(P[1][1], v => (P[1][1] = v), { min: 0, max: 999, width: 60 }), "* X"],
        2: [numberInput(P[2][0], v => (P[2][0] = v), { min: 0, max: 100, width: 60 }), "% ~", numberInput(P[2][1], v => (P[2][1] = v), { min: 0, max: 100, width: 60 }), "%"],
        3: [numberInput(P[3][0], v => (P[3][0] = v), { min: 0, max: 100, width: 60 }), "% ~", numberInput(P[3][1], v => (P[3][1] = v), { min: 0, max: 100, width: 60 }), "%"],
        4: [selectInput(P[4][0], dbOptions(db.States), v => (P[4][0] = v))],
        5: [numberInput(P[5][0], v => (P[5][0] = v), { min: 1, max: 99, width: 60 })],
        6: [swBtn]
    };
    const rows = CONDITIONS.map((label, t) => {
        const radio = h("input", { type: "radio", name, checked: t === type });
        radio.addEventListener("change", () => radio.checked && (a.conditionType = t));
        return h("div", { class: "row center" }, h("label", { class: "check-label", style: { width: "110px" } }, radio, label), ...controls[t]);
    });
    const ok = await openDialog({
        title: "Action Pattern",
        body: h(
            "div",
            { class: "col", style: { width: "420px" } },
            field("Skill", selectInput(a.skillId, dbOptions(db.Skills), v => (a.skillId = v))),
            fieldset("Condition", h("div", { class: "col", style: { gap: "3px" } }, ...rows)),
            field("Rating", numberInput(a.rating, v => (a.rating = v), { min: 1, max: 9 }))
        )
    });
    if (!ok) return null;
    const t = a.conditionType;
    if (t === 0) [a.conditionParam1, a.conditionParam2] = [0, 0];
    else if (t === 1) [a.conditionParam1, a.conditionParam2] = P[1];
    else if (t === 2 || t === 3) [a.conditionParam1, a.conditionParam2] = [P[t][0] / 100, P[t][1] / 100];
    else [a.conditionParam1, a.conditionParam2] = [P[t][0], 0];
    return a;
}

export function enemiesTab(env) {
    const db = env.db;
    return listTab(env, "Enemies", (enemy, ui) => {
        const sideView = db.System.optSideView;
        const folder = sideView ? "sv_enemies" : "enemies";
        const canvas = h("canvas", { width: 240, height: 200 });
        const drawPreview = async () => {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!enemy.battlerName) return;
            const b = await whenReady(loadImage(folder, enemy.battlerName));
            if (!b || !b.source) return;
            const s = Math.min(1, canvas.width / b.width, canvas.height / b.height);
            ctx.filter = enemy.battlerHue ? "hue-rotate(" + enemy.battlerHue + "deg)" : "none";
            ctx.drawImage(b.source, (canvas.width - b.width * s) / 2, (canvas.height - b.height * s) / 2, b.width * s, b.height * s);
            ctx.filter = "none";
        };
        drawPreview();
        const drops = enemy.dropItems.map(d => {
            const holder = h("span");
            const kinds = [null, "Items", "Weapons", "Armors"];
            const render = () => {
                holder.innerHTML = "";
                if (d.kind > 0) holder.appendChild(selectInput(d.dataId, dbOptions(db[kinds[d.kind]]), v => (d.dataId = v), { width: 180 }));
            };
            render();
            return h(
                "div",
                { class: "row center" },
                selectInput(d.kind, [[0, "None"], [1, "Item"], [2, "Weapon"], [3, "Armor"]], v => {
                    d.kind = v;
                    d.dataId = 1;
                    render();
                }),
                holder,
                "1 /",
                numberInput(d.denominator, v => (d.denominator = v), { min: 1, max: 1000, width: 60 })
            );
        });
        const actions = new ListBox({ columns: [200, 180], header: ["Skill", "Condition", "R"], onActivate: i => editAt(i), trailingRow: " ", onKey: e => e.key === "Delete" && remove() });
        actions.el.style.height = "140px";
        const renderActions = () => actions.setItems(enemy.actions.map(a => ({ cells: [idName(a.skillId, (db.Skills[a.skillId] || {}).name), conditionText(db, a, env.store), String(a.rating)] })));
        const editAt = async i => {
            const isNew = i >= enemy.actions.length;
            const r = await editAction(env, isNew ? { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 } : enemy.actions[i]);
            if (!r) return;
            if (isNew) enemy.actions.push(r);
            else enemy.actions[i] = r;
            renderActions();
        };
        const remove = () => {
            if (actions.index >= 0 && actions.index < enemy.actions.length) {
                enemy.actions.splice(actions.index, 1);
                renderActions();
            }
        };
        renderActions();
        return h(
            "div",
            { class: "col" },
            h(
                "div",
                { class: "row", style: { alignItems: "stretch" } },
                fieldset(
                    "General Settings",
                    h(
                        "div",
                        { class: "col" },
                        field("Name", bindText(enemy, "name", { onChange: ui.updateName, width: 220 })),
                        field("Image", bindImage(enemy, "battlerName", folder, { width: 220, onChange: drawPreview })),
                        field("Hue", bindNum(enemy, "battlerHue", { min: 0, max: 360, onChange: drawPreview })),
                        h("div", { class: "image-thumb", style: { width: "244px", height: "204px", cursor: "default" } }, canvas)
                    )
                ),
                h(
                    "div",
                    { class: "col grow" },
                    fieldset("Parameters", h("div", { class: "grid-4" }, ...PARAMS.map((n, i) => field(n, bindNum(enemy.params, i, { min: i === 0 ? 1 : 0, max: 999999 }))))),
                    fieldset("Rewards", h("div", { class: "row" }, field("EXP", bindNum(enemy, "exp", { min: 0, max: 9999999 })), field("Gold", bindNum(enemy, "gold", { min: 0, max: 9999999 })))),
                    fieldset("Drop Items", h("div", { class: "col", style: { gap: "3px" } }, ...drops))
                )
            ),
            fieldset("Action Patterns (Skill, Condition, Rating)", actions.el),
            new TraitsEditor(db, enemy, "traits", { height: 120 }).el,
            field("Note", bindArea(enemy, "note", { rows: 2 }))
        );
    });
}
