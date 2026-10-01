// mapTree.js — hierarchical map list (MapInfos) with MZ-style context menu.
import { h, svg, deepClone } from "../ui/dom.js";
import { Tree } from "../ui/widgets.js";
import { icons } from "../ui/icons.js";
import { showPopupMenu } from "../ui/menu.js";
import { confirmDialog } from "../ui/dialog.js";
import { editMapProperties } from "./mapProperties.js";

export class MapTree {
    constructor(app) {
        this.app = app;
        this.store = app.store;
        this.clipboard = null;
        this.tree = new Tree({
            draggable: true,
            onSelect: node => node && node.id > 0 && this.app.openMap(node.id),
            onActivate: node => node && node.id > 0 && this.editProperties(node.id),
            onContextMenu: (e, node) => this.showMenu(e, node),
            onToggle: node => this.onToggle(node),
            onDrop: (dragged, target, where) => this.onDrop(dragged, target, where),
            onKey: (e, node) => {
                if (e.key === "Delete" && node && node.id > 0) this.deleteMap(node.id);
                if (e.key === " " && node && node.id > 0) this.editProperties(node.id);
            }
        });
        this.header = h("div", { class: "panel-header" }, "Maps");
        this.el = h("div", { class: "maptree-panel" }, this.header, this.tree.el);
        this.mapIcon = svg(icons.map);
        this.gameIcon = svg(icons.game);
    }

    refresh() {
        if (!this.store.isOpen) {
            this.tree.setRoots([]);
            return;
        }
        const build = parentId =>
            this.store.childrenOf(parentId).map(info => ({
                id: info.id,
                label: info.name,
                icon: this.mapIcon,
                expanded: info.expanded,
                children: build(info.id)
            }));
        const root = {
            id: 0,
            label: this.store.system.gameTitle || "Project",
            icon: this.gameIcon,
            expanded: true,
            draggable: false,
            children: build(0)
        };
        this.tree.selectedId = this.app.currentMapId || null;
        this.tree.setRoots([root]);
    }

    select(id) {
        this.tree.select(id, false);
    }

    onToggle(node) {
        if (node.id > 0) {
            const info = this.store.mapInfos()[node.id];
            if (info) {
                info.expanded = node.expanded;
                this.store.markDirty("MapInfos");
            }
        }
    }

    onDrop(dragged, target, where) {
        if (target.id === 0) where = "into";
        this.app.snapshotCommand("Move Map", () => this.store.moveMap(dragged.id, target.id, where), ["MapInfos"]);
        const info = this.store.mapInfos()[target.id];
        if (where === "into" && info) info.expanded = true;
        this.refresh();
    }

    showMenu(e, node) {
        const id = node ? node.id : 0;
        const isMap = id > 0;
        showPopupMenu(
            [
                { label: "Edit…", action: () => this.editProperties(id), enabled: isMap },
                { label: "New…", action: () => this.newMap(id) },
                "-",
                { label: "Copy", action: () => this.copyMap(id), enabled: isMap },
                { label: "Paste", action: () => this.pasteMap(id), enabled: !!this.clipboard },
                { label: "Delete", action: () => this.deleteMap(id), enabled: isMap },
                "-",
                { label: "Set as Starting Map", action: () => this.app.events.setStartPosition("player", id, 0, 0), enabled: isMap },
                { label: "Playtest From Here", action: () => this.app.playtestFrom(id), enabled: isMap }
            ],
            e.clientX,
            e.clientY
        );
    }

    async newMap(parentId) {
        const infosBefore = deepClone(this.store.mapInfos());
        const id = this.store.createMap(parentId);
        if (parentId > 0) this.store.mapInfos()[parentId].expanded = true;
        const ok = await editMapProperties(this.app, id, { isNew: true });
        if (!ok) {
            this.store.deleteMap(id);
            this.store.data.MapInfos = infosBefore;
            this.store.deletedMaps.delete(id);
            this.refresh();
            return;
        }
        const map = this.store.getMap(id);
        const infoSnapshot = deepClone(this.store.mapInfos());
        this.app.undo.push({
            label: "New Map",
            undo: () => {
                this.store.data.MapInfos = deepClone(infosBefore);
                this.store.maps.delete(id);
                this.store.deletedMaps.add(id);
                this.store.markDirty("MapInfos");
                this.afterStructureChange();
            },
            redo: () => {
                this.store.data.MapInfos = deepClone(infoSnapshot);
                this.store.maps.set(id, map);
                this.store.deletedMaps.delete(id);
                this.store.markDirty("MapInfos");
                this.store.markDirty("Map:" + id);
                this.afterStructureChange();
            }
        });
        this.refresh();
        this.app.openMap(id);
    }

    async editProperties(id) {
        if (id <= 0) return;
        await editMapProperties(this.app, id);
        this.refresh();
    }

    async copyMap(id) {
        const map = await this.store.loadMap(id);
        const info = this.store.mapInfos()[id];
        this.clipboard = { map: deepClone(map), name: info.name };
    }

    async pasteMap(parentId) {
        if (!this.clipboard) return;
        const id = this.store.createMap(parentId, { map: deepClone(this.clipboard.map), name: this.clipboard.name });
        this.refresh();
        this.app.openMap(id);
    }

    async deleteMap(id) {
        const info = this.store.mapInfos()[id];
        if (!info) return;
        const ok = await confirmDialog('Delete "' + info.name + '" and all of its child maps?\nThis can be undone until you close the project.', "Delete Map", "Delete");
        if (!ok) return;
        const infosBefore = deepClone(this.store.mapInfos());
        const loaded = new Map();
        const collect = mapId => {
            loaded.set(mapId, this.store.getMap(mapId));
            for (const child of this.store.childrenOf(mapId)) collect(child.id);
        };
        collect(id);
        // Make sure maps are loaded so undo can restore them.
        for (const mapId of loaded.keys()) if (!loaded.get(mapId)) loaded.set(mapId, await this.store.loadMap(mapId));
        const removed = this.store.deleteMap(id);
        const infosAfter = deepClone(this.store.mapInfos());
        this.app.undo.push({
            label: "Delete Map",
            undo: () => {
                this.store.data.MapInfos = deepClone(infosBefore);
                for (const [mapId, map] of loaded) {
                    this.store.maps.set(mapId, map);
                    this.store.deletedMaps.delete(mapId);
                    this.store.markDirty("Map:" + mapId);
                }
                this.store.markDirty("MapInfos");
                this.afterStructureChange();
            },
            redo: () => {
                this.store.data.MapInfos = deepClone(infosAfter);
                for (const mapId of removed) {
                    this.store.maps.delete(mapId);
                    this.store.deletedMaps.add(mapId);
                    this.store.dirty.delete("Map:" + mapId);
                }
                this.store.markDirty("MapInfos");
                this.afterStructureChange();
            }
        });
        if (removed.includes(this.app.currentMapId)) this.app.closeMap();
        this.refresh();
    }

    afterStructureChange() {
        if (this.app.currentMapId && !this.store.mapInfos()[this.app.currentMapId]) this.app.closeMap();
        this.store.bus.emit("maps-changed");
        this.refresh();
    }
}
