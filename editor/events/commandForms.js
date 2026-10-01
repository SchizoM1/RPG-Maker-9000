// commandForms.js — a small form builder bound to a command's parameter
// array, used by the event command dialogs.
import { h, pad, idName } from "../ui/dom.js";
import { numberInput, textInput, textArea, selectInput, checkbox, pickerButton, field, fieldset } from "../ui/widgets.js";
import {
    switchVariablePicker,
    switchVariableLabel,
    databasePicker,
    audioPicker,
    audioLabel,
    imagePicker,
    characterPicker,
    facePicker,
    tonePicker,
    colorPicker,
    mapPositionPicker
} from "../ui/pickers.js";
import { N } from "./format.js";

const DB_KIND = {
    actor: "Actors",
    class: "Classes",
    skill: "Skills",
    item: "Items",
    weapon: "Weapons",
    armor: "Armors",
    enemy: "Enemies",
    troop: "Troops",
    state: "States",
    animation: "Animations",
    tileset: "Tilesets",
    commonEvent: "CommonEvents"
};

export class Form {
    constructor(ctx, params) {
        this.ctx = ctx;
        this.store = ctx.store;
        this.p = params;
        this.onChange = null;
    }

    changed() {
        if (this.onChange) this.onChange(this.p);
    }

    // --- primitives -----------------------------------------------------------

    num(i, opts = {}) {
        return numberInput(this.p[i], v => {
            this.p[i] = v;
            this.changed();
        }, opts);
    }

    text(i, opts = {}) {
        return textInput(this.p[i], v => {
            this.p[i] = v;
            this.changed();
        }, opts);
    }

    textarea(i, opts = {}) {
        return textArea(this.p[i], v => {
            this.p[i] = v;
            this.changed();
        }, opts);
    }

    select(i, options, opts = {}) {
        return selectInput(this.p[i], options, v => {
            this.p[i] = v;
            this.changed();
            if (opts.onChange) opts.onChange(v);
        }, opts);
    }

    check(i, label, opts = {}) {
        const value = opts.invert ? !this.p[i] : !!this.p[i];
        return checkbox(value, label, v => {
            this.p[i] = opts.number ? (v ? 1 : 0) : opts.invert ? !v : v;
            this.changed();
        });
    }

    switchPick(i) {
        return this.svPick(i, "switch");
    }

    variablePick(i) {
        return this.svPick(i, "variable");
    }

    svPick(i, kind) {
        if (!this.p[i]) this.p[i] = 1;
        const btn = pickerButton(switchVariableLabel(this.store, kind, this.p[i]), async () => {
            const r = await switchVariablePicker(this.store, kind, this.p[i]);
            if (r) {
                this.p[i] = r;
                btn.setText(switchVariableLabel(this.store, kind, r));
                this.changed();
            }
        });
        btn.style.minWidth = "180px";
        return btn;
    }

    db(i, kind, opts = {}) {
        const arrName = DB_KIND[kind] || kind;
        const label = id => (id === 0 && opts.allowNone ? opts.noneLabel || "None" : idName(id, (this.store.data[arrName][id] || {}).name));
        if (this.p[i] == null || (!opts.allowNone && !this.p[i])) this.p[i] = opts.allowNone ? 0 : 1;
        const btn = pickerButton(label(this.p[i]), async () => {
            const r = await databasePicker(this.store, arrName, this.p[i], opts);
            if (r !== undefined) {
                this.p[i] = r;
                btn.setText(label(r));
                this.changed();
            }
        });
        btn.style.minWidth = "200px";
        return btn;
    }

    // Plain <select> of database entries (compact, used inside rows).
    dbSelect(i, kind, opts = {}) {
        const arr = this.store.data[DB_KIND[kind] || kind];
        const options = [];
        if (opts.allowNone) options.push([0, opts.noneLabel || "None"]);
        for (let id = 1; id < arr.length; id++) options.push([id, idName(id, arr[id] ? arr[id].name : "")]);
        if (this.p[i] == null) this.p[i] = opts.allowNone ? 0 : 1;
        return this.select(i, options, opts);
    }

    audio(i, folder) {
        if (!this.p[i]) this.p[i] = { name: "", volume: 90, pitch: 100, pan: 0 };
        const btn = pickerButton(audioLabel(this.p[i]), async () => {
            const r = await audioPicker(folder, this.p[i]);
            if (r) {
                this.p[i] = r;
                btn.setText(audioLabel(r));
                this.changed();
            }
        });
        btn.style.minWidth = "260px";
        return btn;
    }

    image(i, folder, opts = {}) {
        const btn = pickerButton(this.p[i] || "(None)", async () => {
            const r = await imagePicker(folder, this.p[i], opts);
            if (r !== undefined) {
                this.p[i] = r;
                btn.setText(r || "(None)");
                this.changed();
            }
        });
        btn.style.minWidth = "200px";
        return btn;
    }

    // character name/index at indices (nameIdx, indexIdx)
    characterImage(nameIdx, indexIdx) {
        const label = () => (this.p[nameIdx] ? this.p[nameIdx] + " (" + this.p[indexIdx] + ")" : "(None)");
        const btn = pickerButton(label(), async () => {
            const r = await characterPicker(this.store, { characterName: this.p[nameIdx], characterIndex: this.p[indexIdx] });
            if (r) {
                this.p[nameIdx] = r.characterName;
                this.p[indexIdx] = r.characterIndex;
                btn.setText(label());
                this.changed();
            }
        });
        return btn;
    }

    face(nameIdx, indexIdx) {
        const label = () => (this.p[nameIdx] ? this.p[nameIdx] + " (" + this.p[indexIdx] + ")" : "(None)");
        const btn = pickerButton(label(), async () => {
            const r = await facePicker(this.p[nameIdx], this.p[indexIdx]);
            if (r) {
                this.p[nameIdx] = r.faceName;
                this.p[indexIdx] = r.faceIndex;
                btn.setText(label());
                this.changed();
            }
        });
        return btn;
    }

    tone(i) {
        if (!this.p[i]) this.p[i] = [0, 0, 0, 0];
        const btn = pickerButton(N.tone(this.p[i]), async () => {
            const r = await tonePicker(this.p[i]);
            if (r) {
                this.p[i] = r;
                btn.setText(N.tone(r));
                this.changed();
            }
        });
        return btn;
    }

    color(i) {
        if (!this.p[i]) this.p[i] = [255, 255, 255, 170];
        const btn = pickerButton("(" + this.p[i].join(",") + ")", async () => {
            const r = await colorPicker(this.p[i]);
            if (r) {
                this.p[i] = r;
                btn.setText("(" + r.join(",") + ")");
                this.changed();
            }
        });
        return btn;
    }

    // Player / This Event / events on the current map
    charSelect(i, opts = {}) {
        const options = [];
        if (opts.player !== false) options.push([-1, "Player"]);
        if (opts.thisEvent !== false) options.push([0, "This Event"]);
        const map = this.ctx.map;
        if (map) {
            for (const ev of map.events) if (ev) options.push([ev.id, pad(ev.id, 3) + ": " + ev.name]);
        }
        if (this.p[i] == null) this.p[i] = options[0][0];
        return this.select(i, options, opts);
    }

    enemySelect(i, allowEntire = true) {
        const options = [];
        if (allowEntire) options.push([-1, "Entire Troop"]);
        for (let k = 0; k < 8; k++) options.push([k, N.enemyIndex(this.ctx, k)]);
        if (this.p[i] == null) this.p[i] = allowEntire ? -1 : 0;
        return this.select(i, options);
    }

    // --- composites -------------------------------------------------------------

    // A radio group where each choice may have its own controls; controls of
    // non-selected choices are disabled. choices: [[value, label, buildFn?]]
    choice(i, choices, opts = {}) {
        const name = "c" + Math.random().toString(36).slice(2);
        const rows = [];
        const container = h("div", { class: "col", style: { gap: "4px" } });
        const update = () => {
            for (const r of rows) {
                const on = r.value === this.p[i];
                r.radio.checked = on;
                if (r.control) for (const el of r.control.querySelectorAll("input, select, button, textarea")) el.disabled = !on;
            }
        };
        for (const [value, label, build] of choices) {
            const radio = h("input", { type: "radio", name, value: String(value) });
            radio.addEventListener("change", () => {
                if (radio.checked) {
                    this.p[i] = value;
                    if (opts.onSelect) opts.onSelect(value);
                    update();
                    this.changed();
                }
            });
            const control = build ? build() : null;
            const row = h("div", { class: "row center", style: { gap: "8px" } }, h("label", { class: "check-label", style: { minWidth: opts.labelWidth || "110px" } }, radio, label), control);
            rows.push({ value, radio, control });
            container.appendChild(row);
        }
        setTimeout(update, 0);
        update();
        return container;
    }

    // Constant / Variable operand pair at (typeIdx, valueIdx).
    operand(typeIdx, valueIdx, opts = {}) {
        if (this.p[typeIdx] == null) this.p[typeIdx] = 0;
        const constant = { ...this.p };
        void constant;
        const self = this;
        // Keep separate storage so switching type doesn't lose either value.
        const store = { 0: this.p[typeIdx] === 0 ? this.p[valueIdx] : opts.min != null ? opts.min : 1, 1: this.p[typeIdx] === 1 ? this.p[valueIdx] : 1 };
        const proxy = [store[0], store[1]];
        const sub = new Form(this.ctx, proxy);
        sub.onChange = () => {
            store[0] = proxy[0];
            store[1] = proxy[1];
            self.p[valueIdx] = store[self.p[typeIdx]];
            self.changed();
        };
        return this.choice(typeIdx, [
            [0, "Constant", () => sub.num(0, { min: opts.min != null ? opts.min : -99999999, max: opts.max != null ? opts.max : 99999999, width: 110 })],
            [1, "Variable", () => sub.variablePick(1)]
        ], {
            onSelect: v => {
                self.p[valueIdx] = store[v] || (v === 1 ? 1 : 0);
            }
        });
    }

    // Fixed actor / Variable target at (typeIdx, idIdx). Fixed allows 0 = Entire Party.
    actorTarget(typeIdx, idIdx, opts = {}) {
        if (this.p[typeIdx] == null) this.p[typeIdx] = 0;
        const store = { 0: this.p[typeIdx] === 0 ? this.p[idIdx] : opts.entireParty === false ? 1 : 0, 1: this.p[typeIdx] === 1 ? this.p[idIdx] || 1 : 1 };
        const proxy = [store[0], store[1]];
        const sub = new Form(this.ctx, proxy);
        sub.onChange = () => {
            store[0] = proxy[0];
            store[1] = proxy[1];
            this.p[idIdx] = store[this.p[typeIdx]];
            this.changed();
        };
        return this.choice(typeIdx, [
            [0, "Fixed", () => sub.dbSelect(0, "actor", { allowNone: opts.entireParty !== false, noneLabel: "Entire Party" })],
            [1, "Variable", () => sub.variablePick(1)]
        ], { onSelect: v => (this.p[idIdx] = store[v]) });
    }

    // Direct position (map + x + y) or variables, at indices.
    position(desIdx, mapIdx, xIdx, yIdx, opts = {}) {
        const direct = { mapId: this.p[desIdx] === 0 ? this.p[mapIdx] : 1, x: this.p[desIdx] === 0 ? this.p[xIdx] : 0, y: this.p[desIdx] === 0 ? this.p[yIdx] : 0 };
        const vars = [this.p[desIdx] === 1 ? this.p[mapIdx] : 1, this.p[desIdx] === 1 ? this.p[xIdx] : 1, this.p[desIdx] === 1 ? this.p[yIdx] : 1];
        const directLabel = () => (opts.noMap ? "(" + direct.x + "," + direct.y + ")" : N.map(this.ctx, direct.mapId) + " (" + direct.x + "," + direct.y + ")");
        const apply = () => {
            if (this.p[desIdx] === 0) {
                this.p[mapIdx] = direct.mapId;
                this.p[xIdx] = direct.x;
                this.p[yIdx] = direct.y;
            } else {
                [this.p[mapIdx], this.p[xIdx], this.p[yIdx]] = vars;
            }
            this.changed();
        };
        const varForm = new Form(this.ctx, vars);
        varForm.onChange = apply;
        return this.choice(desIdx, [
            [0, "Direct", () => {
                const btn = pickerButton(directLabel(), async () => {
                    const r = await mapPositionPicker(this.store, direct);
                    if (r) {
                        Object.assign(direct, r);
                        btn.setText(directLabel());
                        apply();
                    }
                });
                btn.style.minWidth = "240px";
                return btn;
            }],
            [1, "With Variables", () => h("div", { class: "col", style: { gap: "3px" } },
                opts.noMap ? null : h("div", { class: "row center" }, h("span", { style: { width: "36px" } }, "ID"), varForm.variablePick(0)),
                h("div", { class: "row center" }, h("span", { style: { width: "36px" } }, "X"), varForm.variablePick(1)),
                h("div", { class: "row center" }, h("span", { style: { width: "36px" } }, "Y"), varForm.variablePick(2)))]
        ], { onSelect: apply });
    }

    group(label, ...children) {
        return fieldset(label, h("div", { class: "col" }, ...children));
    }

    field(label, control) {
        return field(label, control);
    }

    row(...children) {
        return h("div", { class: "row center", style: { flexWrap: "wrap" } }, ...children);
    }

    labeled(label, control) {
        return h("div", { class: "row center" }, h("span", { style: { minWidth: "90px", color: "var(--text-dim)" } }, label), control);
    }
}

export const DIRECTIONS = [
    [0, "Retain"],
    [2, "Down"],
    [4, "Left"],
    [6, "Right"],
    [8, "Up"]
];
