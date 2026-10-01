// paramEditors.js — value editors for plugin parameters and command args.
// Values are stored the MZ way: strings, with arrays/structs as JSON strings.
import { h, idName, pad } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { ListBox, numberInput, textInput, textArea, selectInput, radioGroup, button } from "../ui/widgets.js";
import { databasePicker, switchVariablePicker, iconPicker, imagePicker, audioPicker, mapPositionPicker, listAssetNames } from "../ui/pickers.js";
import { parseType, displayValue, defaultParameters } from "./headerParser.js";

const DB_TYPES = {
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
    common_event: "CommonEvents"
};

export function makeLookup(store) {
    return (base, id) => {
        if (base === "switch") return pad(id) + " " + (store.system.switches[id] || "");
        if (base === "variable") return pad(id) + " " + (store.system.variables[id] || "");
        const arr = store.data[DB_TYPES[base]];
        if (!arr) return null;
        if (!id) return "None";
        return idName(id, arr[id] ? arr[id].name : "");
    };
}

// Edits one value. Returns the new string, or undefined when cancelled.
export async function editParamValue(ctx, entry, value, structs) {
    const { base, struct, array } = parseType(entry.type);
    const store = ctx.store;
    if (array) return editArray(ctx, entry, value, structs);
    if (base === "struct") return editStruct(ctx, structs[struct] || [], value, structs, entry.text || entry.name);
    if (DB_TYPES[base]) {
        const r = await databasePicker(store, DB_TYPES[base], Number(value) || 0, { allowNone: true });
        return r === undefined ? undefined : String(r);
    }
    if (base === "switch" || base === "variable") {
        const r = await switchVariablePicker(store, base, Number(value) || 1);
        return r === undefined ? undefined : String(r);
    }
    if (base === "icon") {
        const r = await iconPicker(Number(value) || 0);
        return r === undefined ? undefined : String(r);
    }
    if (base === "file") return editFile(entry, value);
    if (base === "location") {
        let loc = { mapId: 1, x: 0, y: 0 };
        try {
            loc = { ...loc, ...JSON.parse(value) };
        } catch (e) {
            // keep default
        }
        const r = await mapPositionPicker(store, { mapId: Number(loc.mapId), x: Number(loc.x), y: Number(loc.y) });
        return r ? JSON.stringify({ mapId: String(r.mapId), x: String(r.x), y: String(r.y) }) : undefined;
    }
    return editScalar(entry, base, value);
}

async function editFile(entry, value) {
    const dir = (entry.dir || "img/pictures/").replace(/\/$/, "");
    if (dir.startsWith("img/")) {
        const r = await imagePicker(dir.slice(4), value, { title: entry.text || entry.name });
        return r === undefined ? undefined : r;
    }
    if (dir.startsWith("audio/")) {
        const r = await audioPicker(dir.slice(6), { name: value, volume: 90, pitch: 100, pan: 0 });
        return r ? r.name : undefined;
    }
    const names = await listAssetNames(dir);
    let chosen = value;
    const ok = await openDialog({
        title: entry.text || entry.name,
        body: selectInput(value, ["", ...names], v => (chosen = v), { width: 300 })
    });
    return ok ? chosen : undefined;
}

async function editScalar(entry, base, value) {
    let v = value == null ? "" : String(value);
    let control;
    if (base === "number") {
        const n = Number(v) || 0;
        control = numberInput(n, x => (v = String(x)), {
            min: entry.min != null ? entry.min : -999999999,
            max: entry.max != null ? entry.max : 999999999,
            step: entry.decimals ? Math.pow(10, -entry.decimals) : 1,
            float: !!entry.decimals,
            width: 160
        });
    } else if (base === "boolean") {
        control = radioGroup(v === "true" ? "true" : "false", [["true", entry.on || "ON"], ["false", entry.off || "OFF"]], x => (v = x));
    } else if (base === "select") {
        control = selectInput(v, entry.options.map(o => [o.value, o.label]), x => (v = x), { width: 280 });
    } else if (base === "combo") {
        const listId = "combo" + Math.random().toString(36).slice(2);
        control = h("div", {}, textInput(v, x => (v = x), { width: 280 }), h("datalist", { id: listId }, entry.options.map(o => h("option", { value: o.value }))));
        control.querySelector("input").setAttribute("list", listId);
    } else if (base === "note") {
        let text = "";
        try {
            text = JSON.parse(v || '""');
        } catch (e) {
            text = v;
        }
        control = textArea(text, x => (v = JSON.stringify(x)), { rows: 8, width: 460 });
    } else if (base === "multiline_string") {
        control = textArea(v, x => (v = x), { rows: 8, width: 460 });
    } else if (base === "color") {
        control = numberInput(Number(v) || 0, x => (v = String(x)), { min: 0, max: 31 });
    } else {
        control = textInput(v, x => (v = x), { width: 360 });
    }
    const ok = await openDialog({
        title: entry.text || entry.name,
        body: h("div", { class: "col", style: { minWidth: "320px" } }, entry.desc ? h("div", { class: "hint", style: { whiteSpace: "pre-wrap" } }, entry.desc) : null, control),
        noEnterOk: base === "note" || base === "multiline_string"
    });
    return ok ? v : undefined;
}

async function editArray(ctx, entry, value, structs) {
    const elementType = entry.type.slice(0, -2);
    const element = { ...entry, type: elementType, text: (entry.text || entry.name) + " item" };
    let items = [];
    try {
        items = JSON.parse(value || "[]");
    } catch (e) {
        items = [];
    }
    const list = new ListBox({ onActivate: i => editItem(i), trailingRow: "(add)", onKey: e => e.key === "Delete" && del() });
    list.el.style.width = "420px";
    list.el.style.height = "300px";
    const lookup = makeLookup(ctx.store);
    const render = () => list.setItems(items.map((v, i) => ({ label: String(i + 1).padStart(3) + ": " + displayValue(element, v, lookup) })));
    const editItem = async i => {
        const isNew = i >= items.length;
        const current = isNew ? defaultFor(element, structs) : items[i];
        const r = await editParamValue(ctx, element, current, structs);
        if (r === undefined) return;
        if (isNew) items.push(r);
        else items[i] = r;
        render();
        list.select(i);
    };
    const del = () => {
        if (list.index >= 0 && list.index < items.length) {
            items.splice(list.index, 1);
            render();
        }
    };
    const move = d => {
        const i = list.index;
        const j = i + d;
        if (i < 0 || j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j], items[i]];
        render();
        list.select(j);
    };
    render();
    const ok = await openDialog({
        title: entry.text || entry.name,
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, list.el, h("div", { class: "col" }, button("Edit…", () => editItem(list.index)), button("Delete", del), button("Up", () => move(-1)), button("Down", () => move(1))))
    });
    return ok ? JSON.stringify(items) : undefined;
}

function defaultFor(entry, structs) {
    const { base, struct, array } = parseType(entry.type);
    if (array) return "[]";
    if (base === "struct") return JSON.stringify(defaultParameters(structs[struct] || []));
    return entry.default || "";
}

async function editStruct(ctx, fields, value, structs, title) {
    let obj = {};
    try {
        obj = JSON.parse(value || "{}");
    } catch (e) {
        obj = {};
    }
    obj = { ...defaultParameters(fields), ...obj };
    const table = new ParamTable(ctx, fields, obj, structs);
    const ok = await openDialog({ title, body: table.el });
    return ok ? JSON.stringify(obj) : undefined;
}

// Two-column Name | Value table that edits an object of string values.
export class ParamTable {
    constructor(ctx, entries, values, structs, options = {}) {
        this.ctx = ctx;
        this.entries = entries;
        this.values = values;
        this.structs = structs || {};
        this.lookup = makeLookup(ctx.store);
        this.desc = h("div", { class: "hint", style: { minHeight: "34px", whiteSpace: "pre-wrap" } });
        this.list = new ListBox({
            columns: [220],
            header: ["Name", "Value"],
            onActivate: i => this.edit(i),
            onChange: i => {
                const e = this.order[i];
                this.desc.textContent = e ? e.desc || "" : "";
            }
        });
        this.list.el.style.height = (options.height || 300) + "px";
        this.list.el.style.width = (options.width || 560) + "px";
        this.el = h("div", { class: "col" }, this.list.el, this.desc);
        this.render();
    }

    render() {
        // Flatten with @parent indentation.
        const byParent = new Map();
        for (const e of this.entries) {
            const key = e.parent && this.entries.some(x => x.name === e.parent) ? e.parent : "";
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key).push(e);
        }
        this.order = [];
        const rows = [];
        const walk = (key, depth) => {
            for (const e of byParent.get(key) || []) {
                this.order.push(e);
                const name = "  ".repeat(depth) + (e.text || e.name);
                rows.push({ cells: [name, displayValue(e, this.values[e.name] == null ? "" : this.values[e.name], this.lookup)] });
                walk(e.name, depth + 1);
            }
        };
        walk("", 0);
        this.list.setItems(rows);
    }

    async edit(i) {
        const e = this.order[i];
        if (!e) return;
        const r = await editParamValue(this.ctx, e, this.values[e.name] == null ? "" : this.values[e.name], this.structs);
        if (r !== undefined) {
            this.values[e.name] = r;
            this.render();
            this.list.select(i);
            if (this.onChange) this.onChange();
        }
    }
}
