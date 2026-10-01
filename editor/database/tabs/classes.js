// Classes tab — params curves, EXP curve, learnings, traits.
import { h, idName } from "../../ui/dom.js";
import { openDialog } from "../../ui/dialog.js";
import { fieldset, field, ListBox, numberInput, button, selectInput, textInput } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, dbOptions } from "../dbFields.js";
import { TraitsEditor, PARAMS } from "../traits.js";

const COLORS = ["#e05050", "#5070e0", "#e09030", "#40a060", "#a050d0", "#30a0b0", "#c0c040", "#d06090"];
const MAXES = [9999, 9999, 999, 999, 999, 999, 999, 999];

export function expForLevel(expParams, level) {
    const [basis, extra, accA, accB] = expParams;
    return Math.round((basis * Math.pow(level - 1, 0.9 + accA / 250) * level * (level + 1)) / (6 + Math.pow(level, 2) / 50 / accB) + (level - 1) * extra);
}

function drawCurve(canvas, values, color, max) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, hh = canvas.height;
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = "#1a1b1d";
    ctx.fillRect(0, 0, w, hh);
    const top = Math.max(max, ...values.slice(1));
    ctx.fillStyle = color;
    for (let lv = 1; lv <= 99; lv++) {
        const x = ((lv - 1) / 99) * w;
        const y = hh - (values[lv] / top) * hh;
        ctx.fillRect(x, y, Math.ceil(w / 99), hh - y);
    }
}

async function editCurve(cls, p) {
    const values = cls.params[p].slice();
    const canvas = h("canvas", { width: 600, height: 220, style: { cursor: "crosshair", border: "1px solid var(--field-border)" } });
    const redraw = () => drawCurve(canvas, values, COLORS[p], MAXES[p] / 4);
    let dragging = false;
    const set = e => {
        const r = canvas.getBoundingClientRect();
        const lv = Math.max(1, Math.min(99, Math.round(((e.clientX - r.left) / r.width) * 99) + 1));
        const top = Math.max(MAXES[p] / 4, ...values.slice(1));
        values[lv] = Math.max(0, Math.round((1 - (e.clientY - r.top) / r.height) * top));
        lvInput.value = lv;
        valInput.value = values[lv];
        redraw();
    };
    canvas.addEventListener("mousedown", e => {
        dragging = true;
        set(e);
    });
    canvas.addEventListener("mousemove", e => dragging && set(e));
    window.addEventListener("mouseup", () => (dragging = false));
    let lv = 1;
    const lvInput = numberInput(1, v => {
        lv = v;
        valInput.value = values[lv];
    }, { min: 1, max: 99 });
    const valInput = numberInput(values[1], v => {
        values[lv] = v;
        redraw();
    }, { min: 0, max: MAXES[p] * 10 });
    const gen = { l1: values[1], l99: values[99], growth: 0 };
    const generate = () => {
        for (let level = 1; level <= 99; level++) {
            const t = (level - 1) / 98;
            const curve = gen.growth === 0 ? t : gen.growth > 0 ? Math.pow(t, 1 + gen.growth / 10) : 1 - Math.pow(1 - t, 1 - gen.growth / 10);
            values[level] = Math.round(gen.l1 + (gen.l99 - gen.l1) * curve);
        }
        redraw();
    };
    redraw();
    const ok = await openDialog({
        title: PARAMS[p] + " Curve",
        body: h(
            "div",
            { class: "col" },
            canvas,
            h("div", { class: "row center" }, "Level", lvInput, "Value", valInput),
            fieldset("Generate Curve", h("div", { class: "row center" }, "Level 1", numberInput(gen.l1, v => (gen.l1 = v), { min: 0, max: 99999 }), "Level 99", numberInput(gen.l99, v => (gen.l99 = v), { min: 0, max: 99999 }), "Growth", numberInput(0, v => (gen.growth = v), { min: -10, max: 10, width: 60 }), button("Generate", generate)))
        )
    });
    if (ok) cls.params[p] = values;
    return ok;
}

async function editExpCurve(cls) {
    const e = cls.expParams.slice();
    const table = h("div", { class: "help-text", style: { height: "300px", width: "420px" } });
    const render = () => {
        const lines = [];
        for (let lv = 1; lv < 99; lv++) lines.push(("L" + String(lv).padStart(2) + ": ").padEnd(6) + String(expForLevel(e, lv + 1) - expForLevel(e, lv)).padStart(8) + "   (total " + expForLevel(e, lv + 1) + ")");
        table.textContent = lines.join("\n");
    };
    const num = (i, label, min, max) => field(label, numberInput(e[i], v => {
        e[i] = v;
        render();
    }, { min, max }));
    render();
    const ok = await openDialog({ title: "EXP Curve", body: h("div", { class: "row", style: { alignItems: "flex-start" } }, table, h("div", { class: "col" }, num(0, "Base Value", 10, 50), num(1, "Extra Value", 0, 40), num(2, "Acceleration A", 10, 50), num(3, "Acceleration B", 10, 50))) });
    if (ok) cls.expParams = e;
}

export function classesTab(env) {
    const db = env.db;
    return listTab(env, "Classes", (cls, ui) => {
        const graphs = PARAMS.map((name, p) => {
            const canvas = h("canvas", { width: 140, height: 70 });
            drawCurve(canvas, cls.params[p], COLORS[p], MAXES[p] / 4);
            const box = h("div", { class: "col", style: { gap: "2px", cursor: "pointer" }, title: "Double-click to edit" }, h("div", { class: "hint" }, name + "  (L1 " + cls.params[p][1] + ")"), canvas);
            box.addEventListener("dblclick", async () => {
                if (await editCurve(cls, p)) {
                    drawCurve(canvas, cls.params[p], COLORS[p], MAXES[p] / 4);
                    box.firstChild.textContent = name + "  (L1 " + cls.params[p][1] + ")";
                }
            });
            return box;
        });
        const learnList = new ListBox({ columns: [60], onActivate: i => editLearning(i), trailingRow: " ", onKey: e => e.key === "Delete" && removeLearning() });
        learnList.el.style.height = "150px";
        const renderLearnings = () => learnList.setItems(cls.learnings.map(l => ({ cells: ["Lv " + l.level, idName(l.skillId, (db.Skills[l.skillId] || {}).name) + (l.note ? "   " + l.note : "")] })));
        const editLearning = async i => {
            const isNew = i >= cls.learnings.length;
            const l = isNew ? { level: 1, skillId: 1, note: "" } : { ...cls.learnings[i] };
            const ok = await openDialog({
                title: "Skill to Learn",
                body: h("div", { class: "col", style: { width: "320px" } }, field("Level", numberInput(l.level, v => (l.level = v), { min: 1, max: 99 })), field("Skill", selectInput(l.skillId, dbOptions(db.Skills), v => (l.skillId = v))), field("Note", textInput(l.note, v => (l.note = v))))
            });
            if (!ok) return;
            if (isNew) cls.learnings.push(l);
            else cls.learnings[i] = l;
            cls.learnings.sort((a, b) => a.level - b.level);
            renderLearnings();
        };
        const removeLearning = () => {
            if (learnList.index >= 0 && learnList.index < cls.learnings.length) {
                cls.learnings.splice(learnList.index, 1);
                renderLearnings();
            }
        };
        renderLearnings();
        const expLabel = () => "Base " + cls.expParams.join(", ");
        const expBtn = button(expLabel(), async () => {
            await editExpCurve(cls);
            expBtn.textContent = expLabel();
        });
        return h(
            "div",
            { class: "col" },
            fieldset("General Settings", h("div", { class: "row" }, field("Name", bindText(cls, "name", { onChange: ui.updateName, width: 240 })), field("EXP Curve", expBtn))),
            fieldset("Parameter Curves", h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" } }, ...graphs)),
            h("div", { class: "row", style: { alignItems: "stretch" } }, h("div", { class: "grow" }, fieldset("Skills to Learn", learnList.el)), h("div", { class: "grow" }, new TraitsEditor(db, cls).el)),
            field("Note", bindArea(cls, "note", { rows: 3 }))
        );
    });
}
