// eventSearch.js — Event Searcher (Ctrl+F): find events by switch,
// variable, name or text across all maps, common events and troops.
import { h, pad } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { ListBox, selectInput, textInput, button, field } from "../ui/widgets.js";
import { switchVariablePicker, switchVariableLabel } from "../ui/pickers.js";
import { commandText } from "./format.js";

function usesId(cmd, kind, id) {
    const p = cmd.parameters || [];
    if (kind === "switch") {
        if (cmd.code === 121) return id >= p[0] && id <= p[1];
        if (cmd.code === 111 && p[0] === 0) return p[1] === id;
    } else {
        if (cmd.code === 122) return id >= p[0] && id <= p[1] || (p[3] === 1 && p[4] === id);
        if (cmd.code === 111 && p[0] === 1) return p[1] === id || (p[2] === 1 && p[3] === id);
        if (cmd.code === 103 || cmd.code === 104 || cmd.code === 285) return p[0] === id;
    }
    return false;
}

export async function openEventSearch(app) {
    const store = app.store;
    const state = { mode: "switch", id: 1, text: "" };
    const results = [];
    const list = new ListBox({ onActivate: i => jump(results[i]) });
    list.el.style.width = "640px";
    list.el.style.height = "360px";
    const svBtn = button(switchVariableLabel(store, "switch", 1), async () => {
        const r = await switchVariablePicker(store, state.mode === "variable" ? "variable" : "switch", state.id);
        if (r) {
            state.id = r;
            svBtn.textContent = switchVariableLabel(store, state.mode === "variable" ? "variable" : "switch", r);
        }
    });
    const search = async () => {
        results.length = 0;
        const ctx = { store };
        const matchList = (where, list, extra) => {
            for (const cmd of list) {
                let hit = false;
                if (state.mode === "switch" || state.mode === "variable") hit = usesId(cmd, state.mode, state.id);
                else if (state.mode === "text") hit = state.text && commandText(ctx, cmd).toLowerCase().includes(state.text.toLowerCase());
                if (hit) {
                    results.push({ ...extra, label: where + "  " + commandText(ctx, cmd) });
                    break;
                }
            }
        };
        for (const info of store.mapInfos()) {
            if (!info) continue;
            const map = await store.loadMap(info.id);
            for (const ev of map.events) {
                if (!ev) continue;
                if (state.mode === "name" && ev.name.toLowerCase().includes(state.text.toLowerCase())) {
                    results.push({ mapId: info.id, x: ev.x, y: ev.y, label: pad(info.id, 3) + ":" + info.name + "  " + pad(ev.id, 3) + ":" + ev.name + " (" + ev.x + "," + ev.y + ")" });
                    continue;
                }
                ev.pages.forEach((page, pi) => {
                    if (state.mode === "switch") {
                        const c = page.conditions;
                        if ((c.switch1Valid && c.switch1Id === state.id) || (c.switch2Valid && c.switch2Id === state.id)) {
                            results.push({ mapId: info.id, x: ev.x, y: ev.y, label: pad(info.id, 3) + ":" + info.name + "  " + pad(ev.id, 3) + ":" + ev.name + " page " + (pi + 1) + " (condition)" });
                            return;
                        }
                    }
                    matchList(pad(info.id, 3) + ":" + info.name + "  " + pad(ev.id, 3) + ":" + ev.name + " p" + (pi + 1), page.list, { mapId: info.id, x: ev.x, y: ev.y });
                });
            }
        }
        for (const ce of store.data.CommonEvents) if (ce) matchList("Common Event " + pad(ce.id) + ":" + ce.name, ce.list, { commonEvent: ce.id });
        for (const t of store.data.Troops) if (t) t.pages.forEach((p, i) => matchList("Troop " + pad(t.id) + ":" + t.name + " p" + (i + 1), p.list, { troop: t.id }));
        list.setItems(results.map(r => ({ label: r.label })));
        status.textContent = results.length + " result(s)";
    };
    const jump = async r => {
        if (!r) return;
        if (r.mapId) {
            await app.openMap(r.mapId);
            app.setMode("event");
            app.mapView.eventCursor = { x: r.x, y: r.y };
            app.mapView.scrollToCell(r.x, r.y);
            app.mapView.requestRedraw();
        }
    };
    const status = h("div", { class: "hint" });
    const textBox = textInput("", v => (state.text = v), { width: 220 });
    textBox.style.display = "none";
    await openDialog({
        title: "Event Searcher",
        id: "event-search",
        body: h(
            "div",
            { class: "col" },
            h("div", { class: "row center" }, field("Search by", selectInput(state.mode, [["switch", "Switch"], ["variable", "Variable"], ["name", "Event Name"], ["text", "Command Text"]], v => {
                state.mode = v;
                svBtn.style.display = v === "switch" || v === "variable" ? "" : "none";
                textBox.style.display = v === "name" || v === "text" ? "" : "none";
                svBtn.textContent = switchVariableLabel(store, v === "variable" ? "variable" : "switch", state.id);
            })), svBtn, textBox, button("Search", search, { primary: true })),
            list.el,
            status,
            h("div", { class: "hint" }, "Double-click a result to jump to the event.")
        ),
        buttons: ["close"]
    });
}
