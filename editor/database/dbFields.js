// dbFields.js — form controls bound to object properties (database editor).
import { h, idName } from "../ui/dom.js";
import { numberInput, textInput, textArea, selectInput, checkbox, pickerButton, field } from "../ui/widgets.js";
import { iconPicker, drawIcon, facePicker, drawFaceThumb, characterPicker, drawCharacterThumb, imagePicker, audioPicker, audioLabel } from "../ui/pickers.js";

export function bindText(obj, key, opts = {}) {
    const el = textInput(obj[key], v => {
        obj[key] = v;
        if (opts.onChange) opts.onChange(v);
    }, opts);
    if (opts.width) el.style.width = opts.width + "px";
    return el;
}

export function bindArea(obj, key, opts = {}) {
    return textArea(obj[key], v => {
        obj[key] = v;
        if (opts.onChange) opts.onChange(v);
    }, opts);
}

export function bindNum(obj, key, opts = {}) {
    return numberInput(obj[key], v => {
        obj[key] = v;
        if (opts.onChange) opts.onChange(v);
    }, opts);
}

// Percent fields stored as decimals (0.5 <-> 50).
export function bindPercent(obj, key, opts = {}) {
    return numberInput(Math.round((obj[key] || 0) * 100), v => {
        obj[key] = v / 100;
        if (opts.onChange) opts.onChange(v);
    }, opts);
}

export function bindSelect(obj, key, options, opts = {}) {
    return selectInput(obj[key], options, v => {
        obj[key] = v;
        if (opts.onChange) opts.onChange(v);
    }, opts);
}

export function bindCheck(obj, key, label, opts = {}) {
    return checkbox(obj[key], label, v => {
        obj[key] = v;
        if (opts.onChange) opts.onChange(v);
    });
}

export function dbOptions(array, opts = {}) {
    const out = [];
    if (opts.none) out.push([0, opts.noneLabel || "None"]);
    for (let i = 1; i < array.length; i++) out.push([i, idName(i, array[i] ? array[i].name : "")]);
    return out;
}

export function typeOptions(names, opts = {}) {
    const out = [];
    if (opts.none) out.push([0, opts.noneLabel || "None"]);
    for (let i = 1; i < names.length; i++) out.push([i, idName(i, names[i])]);
    return out;
}

export function bindIcon(obj, key) {
    const canvas = h("canvas", { width: 32, height: 32 });
    drawIcon(canvas, obj[key] || 0);
    const box = h("div", { class: "image-thumb", style: { width: "40px", height: "40px" }, title: "Click to choose an icon" }, canvas);
    box.addEventListener("click", async () => {
        const r = await iconPicker(obj[key] || 0);
        if (r !== undefined) {
            obj[key] = r;
            drawIcon(canvas, r);
        }
    });
    return box;
}

export function bindFace(obj, nameKey, indexKey, size = 96) {
    const canvas = h("canvas", { width: size, height: size });
    drawFaceThumb(canvas, obj[nameKey], obj[indexKey]);
    const box = h("div", { class: "image-thumb", style: { width: size + 4 + "px", height: size + 4 + "px" }, title: "Double-click to change" }, canvas);
    box.addEventListener("dblclick", async () => {
        const r = await facePicker(obj[nameKey], obj[indexKey]);
        if (r) {
            obj[nameKey] = r.faceName;
            obj[indexKey] = r.faceIndex;
            drawFaceThumb(canvas, r.faceName, r.faceIndex);
        }
    });
    return box;
}

export function bindCharacter(obj, nameKey, indexKey, store) {
    const canvas = h("canvas", { width: 72, height: 96 });
    const value = () => ({ characterName: obj[nameKey], characterIndex: obj[indexKey], direction: 2, pattern: 1 });
    drawCharacterThumb(canvas, value());
    const box = h("div", { class: "image-thumb", style: { width: "76px", height: "100px" }, title: "Double-click to change" }, canvas);
    box.addEventListener("dblclick", async () => {
        const r = await characterPicker(store, value());
        if (r) {
            obj[nameKey] = r.characterName;
            obj[indexKey] = r.characterIndex;
            drawCharacterThumb(canvas, value());
        }
    });
    return box;
}

export function bindImage(obj, key, folder, opts = {}) {
    const btn = pickerButton(obj[key] || "(None)", async () => {
        const r = await imagePicker(folder, obj[key], opts);
        if (r !== undefined) {
            obj[key] = r;
            btn.setText(r || "(None)");
            if (opts.onChange) opts.onChange(r);
        }
    });
    if (opts.width) btn.style.width = opts.width + "px";
    return btn;
}

export function bindAudio(obj, key, folder, opts = {}) {
    const btn = pickerButton(audioLabel(obj[key]), async () => {
        const r = await audioPicker(folder, obj[key]);
        if (r) {
            obj[key] = r;
            btn.setText(audioLabel(r));
        }
    });
    btn.style.width = (opts.width || 260) + "px";
    return btn;
}

export function labeled(label, control, width = 110) {
    return h("div", { class: "row center" }, h("span", { style: { width: width + "px", color: "var(--text-dim)", flex: "none" } }, label), control);
}

export { field, h };
