// databaseDialog.js — the Database (F9): a tabbed editor over a working copy
// of the project data. OK/Apply writes changed files back as one undo step.
import { h, clear, deepClone, idName } from "../ui/dom.js";
import { openDialog, promptDialog, toast } from "../ui/dialog.js";
import { ListBox, TabView, button } from "../ui/widgets.js";
import { showPopupMenu } from "../ui/menu.js";
import { changeMaximum, BLANK_FACTORIES, DATA_FILES } from "../core/defaultData.js";

const TAB_DEFS = [
    ["Actors", "Actors", () => import("./tabs/actors.js").then(m => m.actorsTab)],
    ["Classes", "Classes", () => import("./tabs/classes.js").then(m => m.classesTab)],
    ["Skills", "Skills", () => import("./tabs/usable.js").then(m => m.skillsTab)],
    ["Items", "Items", () => import("./tabs/usable.js").then(m => m.itemsTab)],
    ["Weapons", "Weapons", () => import("./tabs/equipment.js").then(m => m.weaponsTab)],
    ["Armors", "Armors", () => import("./tabs/equipment.js").then(m => m.armorsTab)],
    ["Enemies", "Enemies", () => import("./tabs/enemies.js").then(m => m.enemiesTab)],
    ["Troops", "Troops", () => import("./tabs/troops.js").then(m => m.troopsTab)],
    ["States", "States", () => import("./tabs/states.js").then(m => m.statesTab)],
    ["Animations", "Animations", () => import("./tabs/animations.js").then(m => m.animationsTab)],
    ["Tilesets", "Tilesets", () => import("./tabs/tilesets.js").then(m => m.tilesetsTab)],
    ["CommonEvents", "Common Events", () => import("./tabs/commonEvents.js").then(m => m.commonEventsTab)],
    ["System1", "System 1", () => import("./tabs/system.js").then(m => m.system1Tab)],
    ["System2", "System 2", () => import("./tabs/system.js").then(m => m.system2Tab)],
    ["Types", "Types", () => import("./tabs/system.js").then(m => m.typesTab)],
    ["Terms", "Terms", () => import("./tabs/system.js").then(m => m.termsTab)]
];

export async function openDatabase(app, initialTab = "Actors") {
    const store = app.store;
    const db = {};
    for (const key of DATA_FILES) if (key !== "MapInfos") db[key] = deepClone(store.data[key]);
    // A store-like object whose data is the working copy (for pickers).
    const workStore = Object.create(store);
    workStore.data = { ...store.data, ...db };
    workStore.markDirty = () => {};
    const env = { app, store: workStore, db, realStore: store };

    const builders = {};
    for (const [id, , loader] of TAB_DEFS) builders[id] = loader;
    const tabs = TAB_DEFS.map(([id, label]) => ({
        id,
        label,
        build: () => {
            const holder = h("div", { style: { flex: "1", minHeight: "0", display: "flex", flexDirection: "column", padding: "8px 0 0" } }, h("div", { class: "hint" }, "Loading…"));
            builders[id]().then(fn => {
                clear(holder);
                holder.appendChild(fn(env));
            }).catch(e => {
                console.error(e);
                clear(holder);
                holder.appendChild(h("div", { class: "hint" }, "Error: " + e.message));
            });
            return holder;
        }
    }));
    const view = new TabView(tabs, { initial: initialTab });

    const apply = () => {
        const changed = [];
        for (const key of Object.keys(db)) {
            if (JSON.stringify(db[key]) !== JSON.stringify(store.data[key])) changed.push(key);
        }
        if (!changed.length) return;
        app.snapshotCommand("Database", () => {
            for (const key of changed) store.data[key] = deepClone(db[key]);
        }, changed);
        app.mapTree.refresh();
        app.palette.setTileset(app.currentMap() ? store.data.Tilesets[app.currentMap().tilesetId] : null);
        app.mapView.refreshTileset();
        app.updateTitle();
    };

    const ok = await openDialog({
        title: "Database",
        id: "database",
        width: 1180,
        height: 790,
        body: h("div", { style: { display: "flex", flexDirection: "column", height: "100%" } }, view.el),
        buttons: ["ok", "cancel", "apply"],
        noEnterOk: true,
        onApply: () => {
            apply();
            toast("Database changes applied.", "ok", 1500);
        }
    });
    if (ok) apply();
}

//-----------------------------------------------------------------------------
// List + form tab helper

let entryClipboard = {};

export function listTab(env, kind, buildForm, options = {}) {
    const arr = env.db[kind];
    const formHost = h("div", { class: "db-form" });
    let current = 1;
    const label = id => idName(id, arr[id] ? arr[id].name : "");
    const list = new ListBox({
        onChange: i => show(i + 1),
        onContextMenu: (e, i) => menu(e, i + 1)
    });
    const renderList = () => list.setItems(arr.slice(1).map((x, i) => ({ label: label(i + 1) })));
    const updateName = () => {
        const row = list.rows && list.rows[current - 1];
        if (row) row.textContent = label(current);
    };
    const show = id => {
        current = id;
        clear(formHost);
        if (!arr[id]) arr[id] = BLANK_FACTORIES[kind](id);
        formHost.appendChild(buildForm(arr[id], { env, updateName, refreshList: renderList, id }));
    };
    const changeMax = async () => {
        const v = await promptDialog("Maximum number of " + kind.toLowerCase() + ":", String(arr.length - 1), "Change Maximum");
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1 || n > 5000) return;
        const resized = changeMaximum(arr, n, kind);
        arr.length = 0;
        arr.push(...resized);
        renderList();
        list.select(Math.min(current, n) - 1);
    };
    const menu = (e, id) =>
        showPopupMenu(
            [
                { label: "Copy", action: () => (entryClipboard[kind] = deepClone(arr[id])) },
                {
                    label: "Paste",
                    enabled: !!entryClipboard[kind],
                    action: () => {
                        arr[id] = { ...deepClone(entryClipboard[kind]), id };
                        renderList();
                        list.select(id - 1);
                    }
                },
                {
                    label: "Clear",
                    action: () => {
                        arr[id] = BLANK_FACTORIES[kind](id);
                        renderList();
                        list.select(id - 1);
                    }
                }
            ],
            e.clientX,
            e.clientY
        );
    renderList();
    setTimeout(() => list.select(0), 0);
    const left = h("div", { class: "db-list" }, h("div", { class: "panel-header" }, options.title || kind), list.el, button("Change Maximum…", changeMax));
    return h("div", { class: "db-layout" }, left, formHost);
}
