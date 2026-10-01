// eventEditor.js — the Event Editor dialog (MZ layout).
import { h, clear, deepClone, pad } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { field, textInput, numberInput, selectInput, checkbox, button, fieldset, radioGroup, pickerButton } from "../ui/widgets.js";
import { switchVariablePicker, switchVariableLabel, characterPicker, drawCharacterThumb } from "../ui/pickers.js";
import { blankEventPage } from "../core/defaultData.js";
import { CommandList, commandListStyles } from "./commandList.js";
import { editMoveRoute } from "./moveRoute.js";
import { idName } from "../ui/dom.js";

let pageClipboard = null;

const SPEEDS = [[1, "1: x8 Slower"], [2, "2: x4 Slower"], [3, "3: x2 Slower"], [4, "4: Normal"], [5, "5: x2 Faster"], [6, "6: x4 Faster"]];
const FREQS = [[1, "1: Lowest"], [2, "2: Lower"], [3, "3: Normal"], [4, "4: Higher"], [5, "5: Highest"]];

// Opens the editor for a copy of `event`. Resolves to the edited event or null.
export async function openEventEditor(app, mapId, event, options = {}) {
    const store = app.store;
    const map = store.getMap(mapId);
    const tileset = store.data.Tilesets[map.tilesetId];
    const ev = deepClone(event);
    const ctx = { store, map, mapId, app };
    let pageIndex = 0;

    const pageTabs = h("div", { class: "tabbar" });
    const pageBody = h("div", { style: { display: "flex", gap: "10px", flex: "1", minHeight: "0" } });

    const renderTabs = () => {
        clear(pageTabs);
        ev.pages.forEach((p, i) => {
            const t = h("div", { class: "tab" + (i === pageIndex ? " active" : ""), dataset: { page: i + 1 } }, String(i + 1));
            t.addEventListener("mousedown", () => {
                pageIndex = i;
                renderTabs();
                renderPage();
            });
            pageTabs.appendChild(t);
        });
    };

    const renderPage = () => {
        clear(pageBody);
        const page = ev.pages[pageIndex];
        pageBody.append(buildPageLeft(ctx, page, tileset), buildPageRight(ctx, page));
    };

    const pageButtons = h(
        "div",
        { class: "row", style: { flexWrap: "wrap" } },
        button("New Event Page", () => {
            ev.pages.splice(pageIndex + 1, 0, blankEventPage());
            pageIndex++;
            renderTabs();
            renderPage();
        }, { small: true }),
        button("Copy Event Page", () => (pageClipboard = deepClone(ev.pages[pageIndex])), { small: true }),
        button("Paste Event Page", () => {
            if (!pageClipboard) return;
            ev.pages.splice(pageIndex + 1, 0, deepClone(pageClipboard));
            pageIndex++;
            renderTabs();
            renderPage();
        }, { small: true }),
        button("Delete Event Page", () => {
            if (ev.pages.length <= 1) {
                ev.pages[0] = blankEventPage();
            } else {
                ev.pages.splice(pageIndex, 1);
                pageIndex = Math.min(pageIndex, ev.pages.length - 1);
            }
            renderTabs();
            renderPage();
        }, { small: true }),
        button("Clear Event Page", () => {
            ev.pages[pageIndex] = blankEventPage();
            renderPage();
        }, { small: true })
    );

    renderTabs();
    renderPage();

    const header = h(
        "div",
        { class: "row" },
        field("Name", textInput(ev.name, v => (ev.name = v), { width: 180 })),
        field("Note", textInput(ev.note, v => (ev.note = v), { width: 260 })),
        h("div", { class: "grow" }),
        pageButtons
    );

    let result = null;
    const ok = await openDialog({
        title: (options.title || "Event") + " — ID:" + pad(ev.id, 3) + " (" + ev.x + "," + ev.y + ")",
        id: "event-editor",
        width: 1060,
        height: 720,
        body: h("div", { class: "col", style: { height: "100%" } }, commandListStyles(), header, pageTabs, pageBody),
        buttons: ["ok", "cancel", "apply"],
        noEnterOk: true,
        onApply: () => options.onApply && options.onApply(deepClone(ev)),
        onOk: () => {
            result = ev;
        }
    });
    return ok ? result : null;
}

function buildPageLeft(ctx, page, tileset) {
    const c = page.conditions;
    const store = ctx.store;
    const swBtn = (key) => {
        const btn = pickerButton(switchVariableLabel(store, "switch", c[key]), async () => {
            const r = await switchVariablePicker(store, "switch", c[key]);
            if (r) {
                c[key] = r;
                btn.setText(switchVariableLabel(store, "switch", r));
            }
        });
        btn.style.width = "190px";
        return btn;
    };
    const varBtn = pickerButton(switchVariableLabel(store, "variable", c.variableId), async () => {
        const r = await switchVariablePicker(store, "variable", c.variableId);
        if (r) {
            c.variableId = r;
            varBtn.setText(switchVariableLabel(store, "variable", r));
        }
    });
    varBtn.style.width = "190px";
    const dbOptions = kind => store.data[kind].map((x, i) => (i > 0 ? [i, idName(i, x ? x.name : "")] : null)).filter(Boolean);
    const condRow = (flag, label, control, suffix) => {
        const cb = checkbox(c[flag], label, v => {
            c[flag] = v;
            sync();
        });
        const row = h("div", { class: "row center" }, h("div", { style: { width: "92px" } }, cb), control, suffix || null);
        row._flag = flag;
        return row;
    };
    const rows = [
        condRow("switch1Valid", "Switch", swBtn("switch1Id"), "is ON"),
        condRow("switch2Valid", "Switch", swBtn("switch2Id"), "is ON"),
        condRow("variableValid", "Variable", varBtn),
        h("div", { class: "row center", style: { paddingLeft: "100px" } }, "≥", numberInput(c.variableValue, v => (c.variableValue = v), { min: -99999999, max: 99999999, width: 110 })),
        condRow("selfSwitchValid", "Self Switch", selectInput(c.selfSwitchCh, ["A", "B", "C", "D"], v => (c.selfSwitchCh = v)), "is ON"),
        condRow("itemValid", "Item", selectInput(c.itemId, dbOptions("Items"), v => (c.itemId = v), { width: 190 }), "exists"),
        condRow("actorValid", "Actor", selectInput(c.actorId, dbOptions("Actors"), v => (c.actorId = v), { width: 190 }), "is present")
    ];
    const sync = () => {
        for (const row of rows) {
            if (!row._flag) continue;
            const on = !!c[row._flag];
            row.querySelectorAll("button, select, input:not([type=checkbox])").forEach(el => (el.disabled = !on));
        }
        rows[3].querySelector("input").disabled = !c.variableValid;
    };
    setTimeout(sync, 0);

    // Image
    const thumb = h("canvas", { width: 96, height: 96 });
    const drawThumb = () => drawCharacterThumb(thumb, page.image, tileset);
    drawThumb();
    const imageBox = h("div", { class: "image-thumb", style: { width: "100px", height: "100px" }, title: "Double-click to change" }, thumb);
    imageBox.addEventListener("dblclick", async () => {
        const r = await characterPicker(store, page.image, { tileset });
        if (r) {
            page.image = { tileId: r.tileId, characterName: r.characterName, characterIndex: r.characterIndex, direction: r.direction, pattern: r.pattern };
            drawThumb();
        }
    });

    // Autonomous movement
    const routeBtn = button("Route…", async () => {
        const r = await editMoveRoute(ctx, page.moveRoute, { showCharacter: false });
        if (r) page.moveRoute = r.route;
    }, { small: true });
    const syncRoute = () => (routeBtn.disabled = page.moveType !== 3);
    setTimeout(syncRoute, 0);

    return h(
        "div",
        { class: "col", style: { width: "430px", flex: "none", overflow: "auto" } },
        fieldset("Conditions", h("div", { class: "col", style: { gap: "4px" } }, ...rows)),
        h(
            "div",
            { class: "row", style: { alignItems: "stretch" } },
            fieldset("Image", imageBox),
            fieldset(
                "Autonomous Movement",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row center" }, "Type", selectInput(page.moveType, [[0, "Fixed"], [1, "Random"], [2, "Approach"], [3, "Custom"]], v => {
                        page.moveType = v;
                        syncRoute();
                    }), routeBtn),
                    h("div", { class: "row center" }, "Speed", selectInput(page.moveSpeed, SPEEDS, v => (page.moveSpeed = v))),
                    h("div", { class: "row center" }, "Freq.", selectInput(page.moveFrequency, FREQS, v => (page.moveFrequency = v)))
                )
            )
        ),
        h(
            "div",
            { class: "row", style: { alignItems: "stretch" } },
            fieldset(
                "Options",
                h(
                    "div",
                    { class: "col", style: { gap: "0" } },
                    checkbox(page.walkAnime, "Walking", v => (page.walkAnime = v)),
                    checkbox(page.stepAnime, "Stepping", v => (page.stepAnime = v)),
                    checkbox(page.directionFix, "Direction Fix", v => (page.directionFix = v)),
                    checkbox(page.through, "Through", v => (page.through = v))
                )
            ),
            h(
                "div",
                { class: "col grow" },
                fieldset("Priority", selectInput(page.priorityType, [[0, "Below characters"], [1, "Same as characters"], [2, "Above characters"]], v => (page.priorityType = v))),
                fieldset("Trigger", selectInput(page.trigger, [[0, "Action Button"], [1, "Player Touch"], [2, "Event Touch"], [3, "Autorun"], [4, "Parallel"]], v => (page.trigger = v)))
            )
        )
    );
}

function buildPageRight(ctx, page) {
    const list = new CommandList(ctx, page.list);
    return h("div", { class: "col grow", style: { minHeight: "0" } }, h("div", { class: "panel-header" }, "Contents"), list.el, h("div", { class: "hint" }, "Double-click or press Space to edit · Ins to insert · Del to delete · Ctrl+C/X/V"));
}

export { radioGroup };
