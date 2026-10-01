// Animations tab (MZ / Effekseer format; MV frame animations are kept as-is).
import { h } from "../../ui/dom.js";
import { openDialog } from "../../ui/dialog.js";
import { fieldset, field, ListBox, numberInput, selectInput, button } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindNum, bindSelect, bindCheck, labeled } from "../dbFields.js";
import { listAssetNames, audioPicker, audioLabel, colorPicker } from "../../ui/pickers.js";

export function animationsTab(env) {
    let effects = null;
    listAssetNames("effects", [".efkefc"]).then(list => (effects = list));
    return listTab(env, "Animations", (a, ui) => {
        if (a.frames) {
            return h("div", { class: "col" }, field("Name", bindText(a, "name", { onChange: ui.updateName, width: 280 })), h("div", { class: "hint" }, "This is an MV-format frame animation (" + a.animation1Name + "). It plays as-is; its cells can't be edited here."));
        }
        a.soundTimings = a.soundTimings || [];
        a.flashTimings = a.flashTimings || [];
        a.rotation = a.rotation || { x: 0, y: 0, z: 0 };
        const effectSelect = h("div");
        const renderEffects = () => {
            effectSelect.innerHTML = "";
            effectSelect.appendChild(selectInput(a.effectName, ["", ...(effects || [a.effectName])], v => (a.effectName = v), { width: 240 }));
        };
        renderEffects();
        if (!effects) setTimeout(renderEffects, 300);
        const sounds = new ListBox({ columns: [50], onActivate: i => editSound(i), trailingRow: " ", onKey: e => e.key === "Delete" && sounds.index < a.soundTimings.length && (a.soundTimings.splice(sounds.index, 1), renderSounds()) });
        sounds.el.style.height = "150px";
        const renderSounds = () => sounds.setItems(a.soundTimings.map(t => ({ cells: ["#" + t.frame, audioLabel(t.se)] })));
        const editSound = async i => {
            const t = i < a.soundTimings.length ? { ...a.soundTimings[i] } : { frame: 0, se: { name: "", volume: 90, pitch: 100, pan: 0 } };
            const seBtn = button(audioLabel(t.se), async () => {
                const r = await audioPicker("se", t.se);
                if (r) {
                    t.se = r;
                    seBtn.textContent = audioLabel(r);
                }
            });
            const ok = await openDialog({ title: "Sound Timing", body: h("div", { class: "col" }, field("Frame", numberInput(t.frame, v => (t.frame = v), { min: 0, max: 9999 })), field("SE", seBtn)) });
            if (!ok) return;
            if (i < a.soundTimings.length) a.soundTimings[i] = t;
            else a.soundTimings.push(t);
            a.soundTimings.sort((x, y) => x.frame - y.frame);
            renderSounds();
        };
        const flashes = new ListBox({ columns: [50, 150], onActivate: i => editFlash(i), trailingRow: " ", onKey: e => e.key === "Delete" && flashes.index < a.flashTimings.length && (a.flashTimings.splice(flashes.index, 1), renderFlashes()) });
        flashes.el.style.height = "150px";
        const renderFlashes = () => flashes.setItems(a.flashTimings.map(t => ({ cells: ["#" + t.frame, "(" + t.color.join(",") + ")", t.duration + " frames"] })));
        const editFlash = async i => {
            const t = i < a.flashTimings.length ? { ...a.flashTimings[i] } : { frame: 0, duration: 30, color: [255, 255, 255, 170] };
            const colorBtn = button("(" + t.color.join(",") + ")", async () => {
                const r = await colorPicker(t.color, "Flash Color");
                if (r) {
                    t.color = r;
                    colorBtn.textContent = "(" + r.join(",") + ")";
                }
            });
            const ok = await openDialog({ title: "Flash Timing", body: h("div", { class: "col" }, field("Frame", numberInput(t.frame, v => (t.frame = v), { min: 0, max: 9999 })), field("Duration", numberInput(t.duration, v => (t.duration = v), { min: 1, max: 999 })), field("Color", colorBtn)) });
            if (!ok) return;
            if (i < a.flashTimings.length) a.flashTimings[i] = t;
            else a.flashTimings.push(t);
            a.flashTimings.sort((x, y) => x.frame - y.frame);
            renderFlashes();
        };
        renderSounds();
        renderFlashes();
        return h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, field("Name", bindText(a, "name", { onChange: ui.updateName, width: 240 })), field("Effect (effects/*.efkefc)", effectSelect)),
                    h("div", { class: "row center" }, labeled("Display Type", bindSelect(a, "displayType", [[0, "For each target"], [1, "For all targets"], [2, "Screen"]]), 90), bindCheck(a, "alignBottom", "Align Bottom")),
                    h("div", { class: "grid-4" }, field("Scale %", bindNum(a, "scale", { min: 0, max: 1000 })), field("Speed %", bindNum(a, "speed", { min: 0, max: 1000 })), field("Offset X", bindNum(a, "offsetX", { min: -2000, max: 2000 })), field("Offset Y", bindNum(a, "offsetY", { min: -2000, max: 2000 }))),
                    h("div", { class: "grid-3" }, field("Rotation X", bindNum(a.rotation, "x", { min: -360, max: 360 })), field("Rotation Y", bindNum(a.rotation, "y", { min: -360, max: 360 })), field("Rotation Z", bindNum(a.rotation, "z", { min: -360, max: 360 })))
                )
            ),
            h("div", { class: "row", style: { alignItems: "stretch" } }, h("div", { class: "grow" }, fieldset("Sound Timings", sounds.el)), h("div", { class: "grow" }, fieldset("Flash Timings", flashes.el)))
        );
    });
}
