// mapProperties.js — the Map Properties dialog (MZ layout).
import { h, deepClone, idName, pad } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { field, textInput, textArea, numberInput, selectInput, checkbox, pickerButton, fieldset, ListBox, button } from "../ui/widgets.js";
import { audioPicker, audioLabel, imagePicker, databasePicker } from "../ui/pickers.js";
import { resizeMapData } from "./paint.js";

const SCROLL_TYPES = [
    [0, "No Loop"],
    [1, "Loop Vertically"],
    [2, "Loop Horizontally"],
    [3, "Loop Both"]
];

export async function editMapProperties(app, mapId, options = {}) {
    const store = app.store;
    const map = await store.loadMap(mapId);
    const info = store.mapInfos()[mapId];
    const before = { map: deepClone(map), info: deepClone(info) };
    const m = deepClone(map);
    const i = deepClone(info);
    let anchor = 0;

    const tilesetOptions = store.data.Tilesets.filter(Boolean).map(t => [t.id, idName(t.id, t.name)]);

    const bgmBtn = pickerButton(audioLabel(m.bgm), async () => {
        const r = await audioPicker("bgm", m.bgm);
        if (r) {
            m.bgm = r;
            bgmBtn.setText(audioLabel(r));
        }
    });
    const bgsBtn = pickerButton(audioLabel(m.bgs), async () => {
        const r = await audioPicker("bgs", m.bgs);
        if (r) {
            m.bgs = r;
            bgsBtn.setText(audioLabel(r));
        }
    });
    const bb1 = pickerButton(m.battleback1Name || "(None)", async () => {
        const r = await imagePicker("battlebacks1", m.battleback1Name, { title: "Battle Background 1" });
        if (r !== undefined) {
            m.battleback1Name = r;
            bb1.setText(r || "(None)");
        }
    });
    const bb2 = pickerButton(m.battleback2Name || "(None)", async () => {
        const r = await imagePicker("battlebacks2", m.battleback2Name, { title: "Battle Background 2" });
        if (r !== undefined) {
            m.battleback2Name = r;
            bb2.setText(r || "(None)");
        }
    });
    const parallaxBtn = pickerButton(m.parallaxName || "(None)", async () => {
        const r = await imagePicker("parallaxes", m.parallaxName, { title: "Parallax Background" });
        if (r !== undefined) {
            m.parallaxName = r;
            parallaxBtn.setText(r || "(None)");
        }
    });

    // Resize anchor: 3x3 buttons
    const anchorGrid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 18px)", gap: "2px" } });
    const renderAnchor = () => {
        anchorGrid.innerHTML = "";
        for (let a = 0; a < 9; a++) {
            const b = h("button", { class: "btn small", style: { width: "18px", height: "18px", padding: "0", background: a === anchor ? "var(--accent)" : "" } }, "");
            b.addEventListener("click", e => {
                e.preventDefault();
                anchor = a;
                renderAnchor();
            });
            anchorGrid.appendChild(b);
        }
    };
    renderAnchor();

    // Encounters
    const encounterList = new ListBox({
        columns: [140, 50],
        header: ["Troop", "Weight", "Range"],
        onActivate: idx => editEncounter(idx),
        trailingRow: "(add new)"
    });
    encounterList.el.style.height = "150px";
    const renderEncounters = () => {
        encounterList.setItems(
            m.encounterList.map(e => {
                const troop = store.data.Troops[e.troopId];
                const regions = e.regionSet.length ? e.regionSet.join(",") : "Entire Map";
                return { cells: [troop ? idName(e.troopId, troop.name) : pad(e.troopId), String(e.weight), regions] };
            })
        );
    };
    const editEncounter = async idx => {
        const enc = deepClone(m.encounterList[idx] || { troopId: 1, weight: 10, regionSet: [] });
        const troopBtn = pickerButton(idName(enc.troopId, (store.data.Troops[enc.troopId] || {}).name), async () => {
            const r = await databasePicker(store, "Troops", enc.troopId);
            if (r) {
                enc.troopId = r;
                troopBtn.setText(idName(r, store.data.Troops[r].name));
            }
        });
        const regionInput = textInput(enc.regionSet.join(", "), v => {
            enc.regionSet = v
                .split(/[,\s]+/)
                .map(x => parseInt(x, 10))
                .filter(x => x >= 1 && x <= 255);
        }, { placeholder: "e.g. 1, 2, 5 (empty = entire map)" });
        const ok = await openDialog({
            title: "Encounter",
            body: h(
                "div",
                { class: "col", style: { width: "360px" } },
                field("Troop", troopBtn),
                field("Weight", numberInput(enc.weight, v => (enc.weight = v), { min: 1, max: 100 })),
                field("Regions", regionInput)
            ),
            leftButtons: idx < m.encounterList.length ? [button("Delete", () => {
                m.encounterList.splice(idx, 1);
                renderEncounters();
                document.querySelector(".modal-backdrop:last-child .dialog-title .close").click();
            })] : []
        });
        if (ok) {
            if (idx < m.encounterList.length) m.encounterList[idx] = enc;
            else m.encounterList.push(enc);
            renderEncounters();
        }
    };
    renderEncounters();

    const left = h(
        "div",
        { class: "col", style: { width: "360px" } },
        fieldset(
            "General Settings",
            h(
                "div",
                { class: "grid-2" },
                field("Name", textInput(i.name, v => (i.name = v))),
                field("Display Name", textInput(m.displayName, v => (m.displayName = v))),
                field("Tileset", selectInput(m.tilesetId, tilesetOptions, v => (m.tilesetId = v))),
                field("Enc. Steps", numberInput(m.encounterStep, v => (m.encounterStep = v), { min: 1, max: 999 })),
                field("Width", numberInput(m.width, v => (m.width = v), { min: 1, max: 256 })),
                field("Height", numberInput(m.height, v => (m.height = v), { min: 1, max: 256 })),
                field("Scroll Type", selectInput(m.scrollType, SCROLL_TYPES, v => (m.scrollType = v))),
                field("Resize Anchor", anchorGrid)
            )
        ),
        fieldset("Autoplay BGM", h("div", { class: "col" }, checkbox(m.autoplayBgm, "Enabled", v => (m.autoplayBgm = v)), bgmBtn)),
        fieldset("Autoplay BGS", h("div", { class: "col" }, checkbox(m.autoplayBgs, "Enabled", v => (m.autoplayBgs = v)), bgsBtn)),
        fieldset("Battle Background", h("div", { class: "col" }, checkbox(m.specifyBattleback, "Specify", v => (m.specifyBattleback = v)), bb1, bb2)),
        checkbox(m.disableDashing, "Disable Dashing", v => (m.disableDashing = v))
    );
    const right = h(
        "div",
        { class: "col", style: { width: "360px" } },
        fieldset(
            "Parallax Background",
            h(
                "div",
                { class: "col" },
                parallaxBtn,
                h(
                    "div",
                    { class: "grid-2" },
                    checkbox(m.parallaxLoopX, "Loop Horizontally", v => (m.parallaxLoopX = v)),
                    field("Scroll X", numberInput(m.parallaxSx, v => (m.parallaxSx = v), { min: -32, max: 32 })),
                    checkbox(m.parallaxLoopY, "Loop Vertically", v => (m.parallaxLoopY = v)),
                    field("Scroll Y", numberInput(m.parallaxSy, v => (m.parallaxSy = v), { min: -32, max: 32 }))
                ),
                checkbox(m.parallaxShow, "Show in the Editor", v => (m.parallaxShow = v))
            )
        ),
        fieldset("Encounters", encounterList.el, h("div", { class: "hint" }, "Double-click to edit.")),
        field("Note", textArea(m.note, v => (m.note = v), { rows: 4 }))
    );

    const ok = await openDialog({
        title: (options.isNew ? "New Map — " : "Map Properties — ") + pad(mapId, 3),
        body: h("div", { class: "row", style: { alignItems: "flex-start" } }, left, right),
        id: "map-properties"
    });
    if (!ok) return false;

    // Apply
    if (m.width !== map.width || m.height !== map.height) {
        const resized = resizeMapData(map, m.width, m.height, anchor);
        m.data = resized.data;
        m.events = resized.events;
    } else {
        m.data = map.data;
        m.events = map.events;
    }
    Object.assign(map, m);
    Object.assign(info, i);
    store.markDirty("Map:" + mapId);
    store.markDirty("MapInfos");
    if (!options.isNew) {
        const after = { map: deepClone(map), info: deepClone(info) };
        app.undo.push({
            label: "Map Properties",
            undo: () => restore(app, mapId, before),
            redo: () => restore(app, mapId, after)
        });
    }
    app.onMapPropertiesChanged(mapId);
    return true;
}

function restore(app, mapId, snapshot) {
    const map = app.store.getMap(mapId);
    if (!map) return;
    const copy = deepClone(snapshot.map);
    for (const key of Object.keys(map)) delete map[key];
    Object.assign(map, copy);
    Object.assign(app.store.mapInfos()[mapId], deepClone(snapshot.info));
    app.store.markDirty("Map:" + mapId);
    app.store.markDirty("MapInfos");
    app.onMapPropertiesChanged(mapId);
}
