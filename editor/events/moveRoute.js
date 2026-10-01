// moveRoute.js — the Movement Route editor (MZ layout).
import { h, deepClone } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { ListBox, checkbox, numberInput, selectInput, textInput, field } from "../ui/widgets.js";
import { switchVariablePicker, audioPicker, characterPicker } from "../ui/pickers.js";
import { moveCommandText, MOVE_COMMAND_NAMES } from "./format.js";
import { Form } from "./commandForms.js";

const COLUMNS = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
];

async function askParams(ctx, code, params) {
    const p = deepClone(params || []);
    switch (code) {
        case 14: {
            if (p.length < 2) p.splice(0, 2, 0, 0);
            const ok = await openDialog({
                title: "Jump",
                body: h("div", { class: "row center" }, "X", numberInput(p[0], v => (p[0] = v), { min: -100, max: 100 }), "Y", numberInput(p[1], v => (p[1] = v), { min: -100, max: 100 }))
            });
            return ok ? p : null;
        }
        case 15: {
            if (!p.length) p.push(60);
            const ok = await openDialog({ title: "Wait", body: h("div", { class: "row center" }, numberInput(p[0], v => (p[0] = v), { min: 1, max: 999 }), "frames") });
            return ok ? p : null;
        }
        case 27:
        case 28: {
            const id = await switchVariablePicker(ctx.store, "switch", p[0] || 1);
            return id ? [id] : null;
        }
        case 29: {
            if (!p.length) p.push(4);
            const ok = await openDialog({
                title: "Speed",
                body: selectInput(p[0], [[1, "1: x8 Slower"], [2, "2: x4 Slower"], [3, "3: x2 Slower"], [4, "4: Normal"], [5, "5: x2 Faster"], [6, "6: x4 Faster"]], v => (p[0] = v))
            });
            return ok ? p : null;
        }
        case 30: {
            if (!p.length) p.push(3);
            const ok = await openDialog({ title: "Frequency", body: selectInput(p[0], [[1, "1: Lowest"], [2, "2: Lower"], [3, "3: Normal"], [4, "4: Higher"], [5, "5: Highest"]], v => (p[0] = v)) });
            return ok ? p : null;
        }
        case 41: {
            const r = await characterPicker(ctx.store, { characterName: p[0] || "", characterIndex: p[1] || 0 });
            return r ? [r.characterName, r.characterIndex] : null;
        }
        case 42: {
            if (!p.length) p.push(255);
            const ok = await openDialog({ title: "Opacity", body: numberInput(p[0], v => (p[0] = v), { min: 0, max: 255 }) });
            return ok ? p : null;
        }
        case 43: {
            if (!p.length) p.push(0);
            const ok = await openDialog({ title: "Blend Mode", body: selectInput(p[0], [[0, "Normal"], [1, "Additive"], [2, "Multiply"], [3, "Screen"]], v => (p[0] = v)) });
            return ok ? p : null;
        }
        case 44: {
            const r = await audioPicker("se", p[0]);
            return r ? [r] : null;
        }
        case 45: {
            if (!p.length) p.push("");
            const ok = await openDialog({ title: "Script", body: textInput(p[0], v => (p[0] = v), { width: 420 }) });
            return ok ? p : null;
        }
    }
    return [];
}

export function moveCommandNeedsParams(code) {
    return [14, 15, 27, 28, 29, 30, 41, 42, 43, 44, 45].includes(code);
}

// route: {list, repeat, skippable, wait}. Returns {characterId, route} or undefined.
export async function editMoveRoute(ctx, route, options = {}) {
    const r = deepClone(route || { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true });
    if (!r.list.length || r.list[r.list.length - 1].code !== 0) r.list.push({ code: 0, parameters: [] });
    const charState = [options.characterId == null ? -1 : options.characterId];
    const list = new ListBox({
        multi: true,
        onActivate: i => editAt(i),
        onKey: e => {
            if (e.key === "Delete") {
                e.preventDefault();
                deleteSelected();
            }
        }
    });
    list.el.style.width = "320px";
    list.el.style.height = "380px";
    const render = () => list.setItems(r.list.map(c => ({ label: c.code === 0 ? "◇" : "◇" + moveCommandText(ctx, c) })));
    const insert = async code => {
        const at = Math.max(0, Math.min(list.index, r.list.length - 1));
        let params = [];
        if (moveCommandNeedsParams(code)) {
            params = await askParams(ctx, code, []);
            if (!params) return;
        }
        r.list.splice(at, 0, { code, parameters: params });
        render();
        list.select(at + 1);
        list.el.focus();
    };
    const editAt = async i => {
        const c = r.list[i];
        if (!c || c.code === 0) return;
        if (moveCommandNeedsParams(c.code)) {
            const params = await askParams(ctx, c.code, c.parameters);
            if (params) {
                c.parameters = params;
                render();
                list.select(i);
            }
        }
    };
    const deleteSelected = () => {
        const indices = list.selectedIndices().filter(i => r.list[i] && r.list[i].code !== 0).sort((a, b) => b - a);
        for (const i of indices) r.list.splice(i, 1);
        render();
        list.select(Math.min(indices.length ? indices[indices.length - 1] : 0, r.list.length - 1));
    };
    render();
    setTimeout(() => list.select(r.list.length - 1), 0);
    const buttons = h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(3, 170px)", gap: "3px" } },
        ...COLUMNS[0].map((c, row) => [COLUMNS[0][row], COLUMNS[1][row], COLUMNS[2][row]])
            .flat()
            .map(code => {
                const b = h("button", { class: "btn small", style: { textAlign: "left" } }, MOVE_COMMAND_NAMES[code] + (moveCommandNeedsParams(code) ? "…" : ""));
                b.addEventListener("click", () => insert(code));
                return b;
            })
    );
    const charForm = new Form(ctx, charState);
    const ok = await openDialog({
        title: "Set Movement Route",
        id: "move-route",
        body: h(
            "div",
            { class: "row", style: { alignItems: "flex-start" } },
            h(
                "div",
                { class: "col" },
                options.showCharacter ? field("Character", charForm.charSelect(0)) : null,
                list.el,
                h(
                    "fieldset",
                    {},
                    h("legend", {}, "Options"),
                    checkbox(r.repeat, "Repeat Movements", v => (r.repeat = v)),
                    checkbox(r.skippable, "Skip If Cannot Move", v => (r.skippable = v)),
                    options.showCharacter !== false ? checkbox(r.wait, "Wait for Completion", v => (r.wait = v)) : null
                )
            ),
            h("fieldset", {}, h("legend", {}, "Movement Commands"), buttons)
        )
    });
    if (!ok) return undefined;
    return { characterId: charState[0], route: r };
}
