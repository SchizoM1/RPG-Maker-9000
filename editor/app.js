// app.js — the editor application shell.
import { h, clear, svg, deepClone, pad } from "./ui/dom.js";
import { icons } from "./ui/icons.js";
import { MenuBar } from "./ui/menu.js";
import { openDialog, alertDialog, yesNoCancel, toast, isDialogOpen } from "./ui/dialog.js";
import { field, textInput, button, vSplitter, hSplitter } from "./ui/widgets.js";
import { api } from "./core/api.js";
import { EventBus } from "./core/eventBus.js";
import { UndoStack } from "./core/undoStack.js";
import { ActionRegistry } from "./core/actions.js";
import { ProjectStore } from "./core/projectStore.js";
import { invalidateImages } from "./core/images.js";
import { MapView } from "./map/mapView.js";
import { TilePalette } from "./map/tilePalette.js";
import { MapTree } from "./map/mapTree.js";
import { applyDiff, diffCells } from "./map/paint.js";
import { EventOps } from "./events/eventOps.js";

const SETTINGS_KEY = "rpg9k-editor-settings";
const AUTOSAVE_MINUTES = 5;

export class App {
    constructor(root) {
        this.root = root;
        this.bus = new EventBus();
        this.store = new ProjectStore(this.bus);
        this.undo = new UndoStack(this.bus);
        this.actions = new ActionRegistry();
        this.mode = "map";
        this.tool = "pencil";
        this.currentMapId = 0;
        this.settings = this.loadSettings();
        this.palette = new TilePalette(this);
        this.mapTree = new MapTree(this);
        this.mapView = new MapView(this);
        this.events = new EventOps(this);
        this.registerActions();
        this.buildLayout();
        this.bus.on("undo-changed", () => this.refreshToolbar());
        this.bus.on("dirty-changed", () => this.updateTitle());
        this.bus.on("maps-changed", () => this.mapTree.refresh());
        window.addEventListener("keydown", e => this.onKeyDown(e));
        api.app.onBeforeClose(() => this.requestClose());
        this.lastSaveTime = Date.now();
        setInterval(() => this.autosaveTick(), 30 * 1000);
    }

    // Saves every AUTOSAVE_MINUTES while there are unsaved changes, but never
    // while a dialog is open (its edits are not applied yet).
    autosaveTick() {
        if (!this.settings.autosave || !this.store.isOpen || !this.store.isDirty() || isDialogOpen()) return;
        if (Date.now() - this.lastSaveTime < AUTOSAVE_MINUTES * 60 * 1000) return;
        this.save({ auto: true });
    }

    loadSettings() {
        try {
            return { showGrid: false, leftWidth: 404, paletteHeight: null, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
        } catch (e) {
            return { showGrid: false, leftWidth: 404 };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (e) {
            // ignore
        }
    }

    async init() {
        const info = await api.app.info();
        this.info = info;
        if (info.cliProject) {
            await this.openProject(info.cliProject);
        } else {
            this.showStartScreen();
        }
    }

    // --- layout ----------------------------------------------------------------

    buildLayout() {
        this.menuBar = new MenuBar(this.buildMenus());
        this.toolbar = h("div", { class: "toolbar" });
        this.buildToolbar();
        this.leftColumn = h("div", { class: "left-column" }, this.palette.el, hSplitter(this.palette.el, {
            min: 120,
            onEnd: () => {
                this.settings.paletteHeight = this.palette.el.getBoundingClientRect().height;
                this.saveSettings();
            }
        }), this.mapTree.el);
        this.leftColumn.style.width = this.settings.leftWidth + "px";
        if (this.settings.paletteHeight) {
            this.palette.el.style.height = this.settings.paletteHeight + "px";
        }
        this.mainArea = h("div", { style: { flex: "1", display: "flex", minWidth: "0", minHeight: "0" } });
        this.workspace = h("div", { class: "workspace" }, this.leftColumn, vSplitter(this.leftColumn, {
            min: 220,
            max: 800,
            onEnd: () => {
                this.settings.leftWidth = this.leftColumn.getBoundingClientRect().width;
                this.saveSettings();
            }
        }), this.mainArea);
        this.statusLeft = h("span", { class: "grow" });
        this.statusMap = h("span");
        this.statusPos = h("span");
        this.statusZoom = h("span");
        this.statusbar = h("div", { class: "statusbar" }, this.statusLeft, this.statusMap, this.statusPos, this.statusZoom);
        clear(this.root);
        this.root.append(this.menuBar.el, this.toolbar, this.workspace, this.statusbar);
        this.bus.on("zoom-changed", () => this.updateStatus());
    }

    buildMenus() {
        const a = id => this.actions.menuItem(id);
        return [
            { label: "File", items: () => [a("newProject"), a("openProject"), this.recentMenu(), a("closeProject"), a("save"), a("autosave"), "-", a("deploy"), a("openFolder"), a("openBackups"), "-", a("exit")] },
            { label: "Edit", items: () => [a("undo"), a("redo"), "-", a("cut"), a("copy"), a("paste"), a("delete"), "-", a("find")] },
            { label: "Mode", items: () => [a("modeMap"), a("modeEvent"), a("modeRegion")] },
            { label: "Draw", items: () => [a("toolPencil"), a("toolRect"), a("toolEllipse"), a("toolFill"), a("toolShadow")] },
            { label: "Scale", items: () => [a("zoomIn"), a("zoomOut"), a("zoomReset"), "-", a("toggleGrid")] },
            { label: "Tools", items: () => [a("database"), a("pluginManager"), a("soundTest"), a("find"), a("resourceManager"), "-", a("devtools")] },
            { label: "Game", items: () => [a("playtest"), a("battleTest"), "-", a("openFolder")] },
            { label: "Help", items: () => [a("help"), a("about")] }
        ];
    }

    recentMenu() {
        const recent = (this.info && this.info.recentProjects) || [];
        return {
            label: "Recent Projects",
            submenu: recent.length ? recent.map(p => ({ label: p, action: () => this.openProject(p) })) : [{ label: "(none)", enabled: false }]
        };
    }

    buildToolbar() {
        clear(this.toolbar);
        const groups = [
            ["newProject", "openProject", "save"],
            ["cut", "copy", "paste", "delete"],
            ["undo"],
            ["modeMap", "modeEvent", "modeRegion"],
            ["toolPencil", "toolRect", "toolEllipse", "toolFill", "toolShadow"],
            ["zoomIn", "zoomOut", "zoomReset"],
            ["database", "pluginManager", "soundTest", "find", "resourceManager"],
            ["playtest"]
        ];
        this.toolButtons = {};
        groups.forEach((group, gi) => {
            if (gi > 0) this.toolbar.appendChild(h("div", { class: "toolbar-sep" }));
            for (const id of group) {
                const action = this.actions.get(id);
                const btn = h("button", { class: "tool-btn", title: action.label + (action.shortcut ? " (" + action.shortcut + ")" : ""), dataset: { action: id } }, svg(action.icon));
                btn.addEventListener("click", () => this.actions.run(id));
                this.toolButtons[id] = btn;
                this.toolbar.appendChild(btn);
            }
        });
        this.refreshToolbar();
    }

    refreshToolbar() {
        for (const [id, btn] of Object.entries(this.toolButtons || {})) {
            btn.disabled = !this.actions.isEnabled(id);
            btn.classList.toggle("active", this.actions.isChecked(id));
        }
    }

    // --- actions -------------------------------------------------------------------

    registerActions() {
        const A = this.actions;
        const open = () => this.store.isOpen;
        const mapOpen = () => this.store.isOpen && !!this.currentMapId;
        const eventMode = () => mapOpen() && this.mode === "event";
        A.register({ id: "newProject", label: "New Project…", shortcut: "Ctrl+N", icon: icons.newProject, run: () => this.newProjectDialog() });
        A.register({ id: "openProject", label: "Open Project…", shortcut: "Ctrl+O", icon: icons.open, run: () => this.openProjectDialog() });
        A.register({ id: "closeProject", label: "Close Project", enabled: open, run: () => this.closeProject() });
        A.register({ id: "save", label: "Save Project", shortcut: "Ctrl+S", icon: icons.save, enabled: open, run: () => this.save() });
        A.register({ id: "deploy", label: "Deployment…", icon: icons.deploy, enabled: open, run: () => this.lazy("./deploy/deployDialog.js", m => m.openDeployDialog(this)) });
        A.register({ id: "openFolder", label: "Open Folder", icon: icons.folder, enabled: open, run: () => api.app.showProjectFolder(".") });
        A.register({
            id: "autosave", label: "Autosave Every " + AUTOSAVE_MINUTES + " Minutes", checked: () => !!this.settings.autosave, run: () => {
                this.settings.autosave = !this.settings.autosave;
                this.saveSettings();
            }
        });
        A.register({ id: "openBackups", label: "Open Backups Folder", enabled: open, run: () => api.app.showProjectFolder("backups") });
        A.register({ id: "exit", label: "Exit", run: () => this.requestClose() });
        A.register({ id: "undo", label: "Undo", shortcut: "Ctrl+Z", icon: icons.undo, enabled: () => this.undo.canUndo(), run: () => this.doUndo() });
        A.register({ id: "redo", label: "Redo", shortcut: "Ctrl+Y", icon: icons.redo, enabled: () => this.undo.canRedo(), run: () => this.doRedo() });
        A.register({ id: "redo2", label: "Redo", shortcut: "Ctrl+Shift+Z", icon: icons.redo, enabled: () => this.undo.canRedo(), run: () => this.doRedo() });
        A.register({ id: "cut", label: "Cut", shortcut: "Ctrl+X", icon: icons.cut, enabled: () => eventMode() && !!this.events.eventAtCursor(), run: () => this.events.cut() });
        A.register({ id: "copy", label: "Copy", shortcut: "Ctrl+C", icon: icons.copy, enabled: () => eventMode() && !!this.events.eventAtCursor(), run: () => this.events.copy() });
        A.register({ id: "paste", label: "Paste", shortcut: "Ctrl+V", icon: icons.paste, enabled: () => eventMode() && this.events.canPaste(), run: () => this.events.paste() });
        A.register({ id: "delete", label: "Delete", shortcut: "Delete", icon: icons.delete, enabled: () => eventMode() && !!this.events.eventAtCursor(), run: () => this.events.deleteAtCursor() });
        A.register({ id: "find", label: "Event Searcher…", shortcut: "Ctrl+F", icon: icons.search, enabled: open, run: () => this.lazy("./events/eventSearch.js", m => m.openEventSearch(this)) });
        A.register({ id: "modeMap", label: "Map", shortcut: "F5", icon: icons.mapMode, enabled: open, checked: () => this.mode === "map", run: () => this.setMode("map") });
        A.register({ id: "modeEvent", label: "Event", shortcut: "F6", icon: icons.eventMode, enabled: open, checked: () => this.mode === "event", run: () => this.setMode("event") });
        A.register({ id: "modeRegion", label: "Region", shortcut: "F7", icon: icons.regionMode, enabled: open, checked: () => this.mode === "region", run: () => this.setMode("region") });
        const tool = (id, label, icon, key) =>
            A.register({ id, label, icon, shortcut: key, enabled: () => open() && this.mode !== "event", checked: () => this.tool === toolName(id), run: () => this.setTool(toolName(id)) });
        const toolName = id => ({ toolPencil: "pencil", toolRect: "rect", toolEllipse: "ellipse", toolFill: "fill", toolShadow: "shadow" })[id];
        tool("toolPencil", "Pencil", icons.pencil, "P");
        tool("toolRect", "Rectangle", icons.rect, "R");
        tool("toolEllipse", "Ellipse", icons.ellipse, "E");
        tool("toolFill", "Flood Fill", icons.fill, "F");
        tool("toolShadow", "Shadow Pen", icons.shadow, "S");
        A.register({ id: "zoomIn", label: "Zoom In", shortcut: "Ctrl+=", icon: icons.zoomIn, enabled: mapOpen, run: () => this.mapView.setZoom(this.mapView.zoom * 1.25) });
        A.register({ id: "zoomOut", label: "Zoom Out", shortcut: "Ctrl+-", icon: icons.zoomOut, enabled: mapOpen, run: () => this.mapView.setZoom(this.mapView.zoom * 0.8) });
        A.register({ id: "zoomReset", label: "Actual Size", shortcut: "Ctrl+0", icon: icons.zoomReset, enabled: mapOpen, run: () => this.mapView.setZoom(1) });
        A.register({
            id: "toggleGrid", label: "Show Grid", shortcut: "G", icon: icons.grid, checked: () => this.settings.showGrid, run: () => {
                this.settings.showGrid = !this.settings.showGrid;
                this.saveSettings();
                this.mapView.requestRedraw();
            }
        });
        A.register({ id: "database", label: "Database…", shortcut: "F9", icon: icons.database, enabled: open, run: () => this.lazy("./database/databaseDialog.js", m => m.openDatabase(this)) });
        A.register({ id: "pluginManager", label: "Plugin Manager…", shortcut: "F10", icon: icons.plugin, enabled: open, run: () => this.lazy("./plugins/pluginManager.js", m => m.openPluginManager(this)) });
        A.register({ id: "soundTest", label: "Sound Test…", shortcut: "F11", icon: icons.sound, enabled: open, run: () => this.lazy("./resources/soundTest.js", m => m.openSoundTest(this)) });
        A.register({ id: "resourceManager", label: "Resource Manager…", icon: icons.resources, enabled: open, run: () => this.lazy("./resources/resourceManager.js", m => m.openResourceManager(this)) });
        A.register({ id: "playtest", label: "Playtest", shortcut: "Ctrl+R", icon: icons.play, enabled: open, run: () => this.playtest() });
        A.register({ id: "battleTest", label: "Battle Test…", enabled: open, run: () => this.lazy("./database/databaseDialog.js", m => m.openDatabase(this, "Troops")) });
        A.register({ id: "devtools", label: "Developer Tools", shortcut: "Ctrl+Shift+I", run: () => api.app.toggleDevTools() });
        A.register({ id: "help", label: "Contents", shortcut: "F1", icon: icons.help, run: () => this.lazy("./help.js", m => m.openHelp(this)) });
        A.register({ id: "about", label: "About RPG Maker 9000", run: () => alertDialog("RPG Maker 9000\nAn RPG Maker-style editor for HTML5 games.\n\nRuntime: Canvas 2D, MZ-compatible data and plugin API.", "About") });
    }

    async lazy(path, fn) {
        try {
            const mod = await import(path);
            await fn(mod);
        } catch (e) {
            console.error(e);
            toast("Error: " + e.message, "error");
        }
    }

    onKeyDown(e) {
        if (isDialogOpen()) return;
        if (document.querySelector(".menu-popup")) return;
        const tag = document.activeElement ? document.activeElement.tagName : "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
        if (typing && !/^F\d+$/.test(e.key) && !(e.ctrlKey && e.key.toLowerCase() === "s")) return;
        // Single-letter tool shortcuts only apply when the map view or body has focus.
        if (!e.ctrlKey && !e.altKey && e.key.length === 1 && document.activeElement && document.activeElement.closest(".tree")) return;
        if (e.key === "Delete" && !(this.mode === "event" && document.activeElement === this.mapView.el)) return;
        if (this.actions.handleKey(e)) this.refreshToolbar();
    }

    // --- projects ------------------------------------------------------------------

    showStartScreen() {
        clear(this.mainArea);
        const recent = (this.info && this.info.recentProjects) || [];
        const recentEl = h("div", { class: "recent" });
        if (recent.length) {
            recentEl.appendChild(h("div", { class: "panel-header" }, "Recent Projects"));
            for (const p of recent) {
                const name = p.split(/[\\/]/).pop();
                const row = h("div", { class: "list-row" }, h("span", {}, name), h("span", { class: "path" }, p));
                row.addEventListener("click", () => this.openProject(p));
                recentEl.appendChild(row);
            }
        }
        this.mainArea.appendChild(
            h(
                "div",
                { class: "empty-state" },
                h("h1", {}, "RPG Maker 9000"),
                h("div", {}, "Create HTML5 RPGs with maps, events, a full database and JS plugins."),
                h("div", { class: "row" }, button("New Project…", () => this.newProjectDialog(), { primary: true }), button("Open Project…", () => this.openProjectDialog())),
                recentEl
            )
        );
        this.mapTree.refresh();
        this.palette.setTileset(null);
        this.updateTitle();
        this.updateStatus();
        this.refreshToolbar();
    }

    async newProjectDialog() {
        if (!(await this.confirmDiscard())) return;
        const state = { title: "New Game", folder: "Project1", parent: (this.info && this.info.defaultProjectDir) || "" };
        const locationInput = textInput(state.parent, v => (state.parent = v));
        const folderInput = textInput(state.folder, v => (state.folder = v));
        const ok = await openDialog({
            title: "New Project",
            id: "new-project",
            body: h(
                "div",
                { class: "col", style: { width: "460px" } },
                field("Game Title", textInput(state.title, v => {
                    state.title = v;
                    const auto = v.replace(/[^\w\- ]/g, "").replace(/\s+/g, "") || "Project1";
                    folderInput.value = auto;
                    state.folder = auto;
                })),
                field("Folder Name", folderInput),
                field("Location", h("div", { class: "row" }, h("div", { class: "grow" }, locationInput), button("Choose…", async () => {
                    const dir = await api.dialog.chooseFolder({ title: "Project Location", defaultPath: state.parent || undefined });
                    if (dir) {
                        state.parent = dir;
                        locationInput.value = dir;
                    }
                }))),
                h("div", { class: "hint" }, "The new project includes the default RTP graphics and audio.")
            ),
            onOk: () => {
                if (!state.parent || !state.folder || /[\\/:*?"<>|]/.test(state.folder)) {
                    toast("Please choose a location and a valid folder name.", "error");
                    return false;
                }
                return true;
            }
        });
        if (!ok) return;
        try {
            const { dir } = await api.project.create({ parentDir: state.parent, folderName: state.folder, title: state.title });
            await this.openProject(dir);
            toast("Project created.", "ok");
        } catch (e) {
            alertDialog("Could not create the project:\n" + e.message, "New Project");
        }
    }

    async openProjectDialog() {
        if (!(await this.confirmDiscard())) return;
        const file = await api.dialog.openProject();
        if (file) await this.openProject(file);
    }

    async openProject(path) {
        try {
            const { dir } = await api.project.open(path);
            this.closeMap();
            this.undo.clear();
            invalidateImages();
            await this.store.open(dir);
            this.info = await api.app.info();
            this.showEditor();
            const system = this.store.system;
            const start = system.editMapId && this.store.mapInfos()[system.editMapId] ? system.editMapId : (this.store.mapInfos().find(i => i) || {}).id;
            if (start) await this.openMap(start);
            this.updateTitle();
        } catch (e) {
            console.error(e);
            alertDialog("Could not open the project:\n" + e.message, "Open Project");
        }
    }

    showEditor() {
        clear(this.mainArea);
        this.mainArea.appendChild(this.mapView.el);
        this.mapTree.refresh();
        this.refreshToolbar();
    }

    async closeProject() {
        if (!(await this.confirmDiscard())) return;
        await api.project.close();
        this.store.close();
        this.undo.clear();
        this.closeMap();
        this.info = await api.app.info();
        this.showStartScreen();
    }

    async confirmDiscard() {
        if (!this.store.isOpen || !this.store.isDirty()) return true;
        const r = await yesNoCancel("Save changes to the project?", "Unsaved Changes");
        if (r === "yes") {
            await this.save();
            return true;
        }
        return r === "no";
    }

    async requestClose() {
        if (await this.confirmDiscard()) api.app.confirmClose();
    }

    async save(options = {}) {
        if (!this.store.isOpen) return;
        try {
            if (this.currentMapId) this.store.system.editMapId = this.currentMapId;
            await this.store.save();
            this.lastSaveTime = Date.now();
            toast(options.auto ? "Autosaved." : "Project saved.", "ok", 1800);
        } catch (e) {
            alertDialog("Save failed:\n" + e.message, "Save");
        }
        this.updateTitle();
    }

    updateTitle() {
        const dirty = this.store.isOpen && this.store.isDirty() ? "*" : "";
        const title = this.store.isOpen ? dirty + (this.store.system.gameTitle || "Untitled") + " — RPG Maker 9000" : "RPG Maker 9000";
        document.title = title;
        api.app.setTitle(title);
    }

    // --- maps ------------------------------------------------------------------------

    async openMap(id) {
        if (!this.store.mapInfos()[id]) return;
        const map = await this.store.loadMap(id);
        this.currentMapId = id;
        this.mapView.setMap(id, map);
        this.palette.setTileset(this.store.data.Tilesets[map.tilesetId]);
        this.mapTree.select(id);
        this.updateStatus();
        this.refreshToolbar();
    }

    closeMap() {
        this.currentMapId = 0;
        this.mapView.clearMap();
        this.updateStatus();
    }

    currentMap() {
        return this.currentMapId ? this.store.getMap(this.currentMapId) : null;
    }

    onMapPropertiesChanged(mapId) {
        if (mapId === this.currentMapId) {
            const map = this.store.getMap(mapId);
            this.mapView.setMap(mapId, map);
            this.palette.setTileset(this.store.data.Tilesets[map.tilesetId]);
        }
        this.mapTree.refresh();
        this.updateStatus();
    }

    // Called by the map view after a drawing stroke.
    commitMapDiff(mapId, diff, label) {
        this.store.markDirty("Map:" + mapId);
        const apply = undo => {
            const map = this.store.getMap(mapId);
            if (!map) return;
            applyDiff(map, diff, undo);
            this.store.markDirty("Map:" + mapId);
            if (mapId === this.currentMapId) this.mapView.invalidate(diffCells(map, diff));
            else this.openMap(mapId);
        };
        this.undo.push({ label, undo: () => apply(true), redo: () => apply(false) });
    }

    // Runs fn and records an undo step that restores the given data keys
    // ("System", "MapInfos", "Map:3", …) to their previous state.
    snapshotCommand(label, fn, keys) {
        const read = key => (key.startsWith("Map:") ? this.store.getMap(Number(key.slice(4))) : this.store.data[key]);
        const write = (key, value) => {
            if (key.startsWith("Map:")) {
                const map = this.store.getMap(Number(key.slice(4)));
                for (const k of Object.keys(map)) delete map[k];
                Object.assign(map, deepClone(value));
            } else {
                this.store.data[key] = deepClone(value);
            }
            this.store.markDirty(key);
        };
        const before = keys.map(k => deepClone(read(k)));
        const result = fn();
        const after = keys.map(k => deepClone(read(k)));
        keys.forEach(k => this.store.markDirty(k));
        const refresh = () => {
            this.mapTree.refresh();
            if (this.currentMapId) {
                this.mapView.invalidate(null);
                this.mapView.requestRedraw();
            }
            this.bus.emit("data-changed");
        };
        this.undo.push({
            label,
            undo: () => {
                keys.forEach((k, i) => write(k, before[i]));
                refresh();
            },
            redo: () => {
                keys.forEach((k, i) => write(k, after[i]));
                refresh();
            }
        });
        return result;
    }

    doUndo() {
        this.undo.undo();
        this.afterUndoRedo();
    }

    doRedo() {
        this.undo.redo();
        this.afterUndoRedo();
    }

    afterUndoRedo() {
        this.mapView.requestRedraw();
        this.refreshToolbar();
        this.updateTitle();
    }

    // --- modes and tools -----------------------------------------------------------

    setMode(mode) {
        this.mode = mode;
        this.palette.onModeChanged();
        this.mapView.requestRedraw();
        this.refreshToolbar();
        this.updateStatus();
        if (mode === "event") this.mapView.el.focus();
    }

    setTool(tool) {
        this.tool = tool;
        this.refreshToolbar();
    }

    onBrushChanged() {
        this.updateStatus();
        this.mapView.requestRedraw();
        if (this.mode === "event") this.setMode("map");
    }

    requestRedrawSoon() {
        if (this._redrawTimer) return;
        this._redrawTimer = setTimeout(() => {
            this._redrawTimer = null;
            this.mapView.requestRedraw();
        }, 120);
    }

    updateStatus() {
        if (!this.statusLeft) return;
        if (!this.store.isOpen) {
            this.statusLeft.textContent = "No project";
            this.statusMap.textContent = "";
            this.statusPos.textContent = "";
            this.statusZoom.textContent = "";
            return;
        }
        const map = this.currentMap();
        const info = this.store.mapInfos()[this.currentMapId];
        this.statusMap.textContent = map && info ? pad(this.currentMapId, 3) + ": " + info.name + " (" + map.width + "×" + map.height + ")" : "";
        const hover = this.mapView.hover;
        const cursor = this.mode === "event" ? this.mapView.eventCursor : hover;
        let posText = "";
        if (map && cursor) {
            posText = cursor.x + ", " + cursor.y;
            const ev = this.events.eventAt(cursor.x, cursor.y);
            if (ev) posText += "  " + pad(ev.id, 3) + ":" + ev.name;
            else if (this.mode === "region") posText += "  Region " + map.data[(5 * map.height + cursor.y) * map.width + cursor.x];
        }
        this.statusPos.textContent = posText;
        this.statusZoom.textContent = Math.round(this.mapView.zoom * 100) + "%";
        const modeName = { map: "Map", event: "Event", region: "Region" }[this.mode];
        this.statusLeft.textContent = modeName + " mode · " + (this.mode === "event" ? "Double-click to edit an event" : this.palette.describeSelection());
    }

    // --- playtest ------------------------------------------------------------------------

    async playtest(flags = []) {
        if (!this.store.isOpen) return;
        await this.save();
        try {
            await api.playtest.start({ flags });
        } catch (e) {
            alertDialog("Could not start the playtest:\n" + e.message, "Playtest");
        }
    }

    async playtestFrom(mapId) {
        const system = this.store.system;
        const saved = { startMapId: system.startMapId, startX: system.startX, startY: system.startY };
        const map = await this.store.loadMap(mapId);
        system.startMapId = mapId;
        system.startX = Math.floor(map.width / 2);
        system.startY = Math.floor(map.height / 2);
        this.store.markDirty("System");
        await this.playtest(["tskip"]);
        Object.assign(system, saved);
        this.store.markDirty("System");
        await this.store.save();
    }
}
