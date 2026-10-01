// eventOps.js — event creation/editing on the map, with undo, quick event
// creation templates and starting positions.
import { h, deepClone, pad } from "../ui/dom.js";
import { showPopupMenu } from "../ui/menu.js";
import { openDialog } from "../ui/dialog.js";
import { field, selectInput, numberInput, textInput } from "../ui/widgets.js";
import { blankEvent, blankEventPage } from "../core/defaultData.js";
import { openEventEditor } from "./eventEditor.js";
import { Form } from "./commandForms.js";

let eventClipboard = null;

const SE = (name, volume = 90) => ({ name, volume, pitch: 100, pan: 0 });
const cmd = (code, indent, parameters = []) => ({ code, indent, parameters });

export class EventOps {
    constructor(app) {
        this.app = app;
        this.store = app.store;
    }

    map() {
        return this.app.currentMap();
    }

    eventAt(x, y) {
        const map = this.map();
        if (!map) return null;
        return map.events.find(e => e && e.x === x && e.y === y) || null;
    }

    eventAtCursor() {
        const c = this.app.mapView.eventCursor;
        return this.eventAt(c.x, c.y);
    }

    nextEventId(map) {
        for (let i = 1; i < map.events.length; i++) if (!map.events[i]) return i;
        return Math.max(1, map.events.length);
    }

    // Records an undoable change of the current map's events.
    change(label, fn) {
        const mapId = this.app.currentMapId;
        const r = this.app.snapshotCommand(label, fn, ["Map:" + mapId]);
        this.app.mapView.requestRedraw();
        this.app.updateStatus();
        return r;
    }

    async editAt(x, y) {
        const map = this.map();
        if (!map) return;
        const existing = this.eventAt(x, y);
        const mapId = this.app.currentMapId;
        const ev = existing || blankEvent(this.nextEventId(map), x, y);
        const apply = edited => {
            this.change(existing ? "Edit Event" : "New Event", () => {
                const m = this.store.getMap(mapId);
                while (m.events.length <= edited.id) m.events.push(null);
                m.events[edited.id] = edited;
            });
        };
        const result = await openEventEditor(this.app, mapId, ev, { onApply: apply });
        if (result) apply(result);
        this.app.mapView.el.focus();
    }

    moveEvent(id, x, y) {
        if (this.eventAt(x, y)) return;
        this.change("Move Event", () => {
            const ev = this.map().events[id];
            ev.x = x;
            ev.y = y;
        });
    }

    deleteAtCursor() {
        const ev = this.eventAtCursor();
        if (!ev) return;
        this.change("Delete Event", () => {
            const map = this.map();
            map.events[ev.id] = null;
            while (map.events.length > 1 && map.events[map.events.length - 1] === null) map.events.pop();
        });
    }

    copy() {
        const ev = this.eventAtCursor();
        if (ev) eventClipboard = deepClone(ev);
    }

    cut() {
        this.copy();
        this.deleteAtCursor();
    }

    canPaste() {
        return !!eventClipboard;
    }

    paste() {
        if (!eventClipboard) return;
        const c = this.app.mapView.eventCursor;
        if (this.eventAt(c.x, c.y)) return;
        this.change("Paste Event", () => {
            const map = this.map();
            const ev = deepClone(eventClipboard);
            ev.id = this.nextEventId(map);
            ev.x = c.x;
            ev.y = c.y;
            while (map.events.length <= ev.id) map.events.push(null);
            map.events[ev.id] = ev;
        });
    }

    showContextMenu(cx, cy, x, y) {
        const ev = this.eventAt(x, y);
        showPopupMenu(
            [
                { label: ev ? "Edit…" : "New…", shortcut: "Enter", action: () => this.editAt(x, y) },
                "-",
                { label: "Cut", shortcut: "Ctrl+X", action: () => this.cut(), enabled: !!ev },
                { label: "Copy", shortcut: "Ctrl+C", action: () => this.copy(), enabled: !!ev },
                { label: "Paste", shortcut: "Ctrl+V", action: () => this.paste(), enabled: !ev && !!eventClipboard },
                { label: "Delete", shortcut: "Del", action: () => this.deleteAtCursor(), enabled: !!ev },
                "-",
                {
                    label: "Quick Event Creation",
                    enabled: !ev,
                    submenu: [
                        { label: "Transfer…", action: () => this.quickTransfer(x, y) },
                        { label: "Door…", action: () => this.quickDoor(x, y) },
                        { label: "Treasure…", action: () => this.quickTreasure(x, y) },
                        { label: "Inn…", action: () => this.quickInn(x, y) }
                    ]
                },
                {
                    label: "Set Starting Position",
                    submenu: [
                        { label: "Player", action: () => this.setStartPosition("player", this.app.currentMapId, x, y) },
                        { label: "Boat", action: () => this.setStartPosition("boat", this.app.currentMapId, x, y) },
                        { label: "Ship", action: () => this.setStartPosition("ship", this.app.currentMapId, x, y) },
                        { label: "Airship", action: () => this.setStartPosition("airship", this.app.currentMapId, x, y) }
                    ]
                }
            ],
            cx,
            cy
        );
    }

    setStartPosition(kind, mapId, x, y) {
        this.app.snapshotCommand("Starting Position", () => {
            const system = this.store.system;
            if (kind === "player") {
                system.startMapId = mapId;
                system.startX = x;
                system.startY = y;
            } else {
                system[kind].startMapId = mapId;
                system[kind].startX = x;
                system[kind].startY = y;
            }
        }, ["System"]);
        this.app.mapView.requestRedraw();
    }

    addEvent(label, ev) {
        this.change(label, () => {
            const map = this.map();
            while (map.events.length <= ev.id) map.events.push(null);
            map.events[ev.id] = ev;
        });
    }

    // --- quick events --------------------------------------------------------------

    async askDestination(title, extra) {
        const p = [0, this.app.currentMapId, 0, 0, 0, 0];
        const f = new Form({ store: this.store, map: this.map() }, p);
        const ok = await openDialog({
            title,
            body: h("div", { class: "col", style: { width: "420px" } }, f.group("Destination", f.position(0, 1, 2, 3)), f.labeled("Direction", f.select(4, [[0, "Retain"], [2, "Down"], [4, "Left"], [6, "Right"], [8, "Up"]])), extra || null)
        });
        return ok ? p : null;
    }

    async quickTransfer(x, y) {
        const p = await this.askDestination("Quick Event: Transfer");
        if (!p) return;
        const ev = blankEvent(this.nextEventId(this.map()), x, y);
        ev.name = "Transfer";
        const page = ev.pages[0];
        page.trigger = 1;
        page.list = [cmd(250, 0, [SE("Move1")]), cmd(201, 0, [0, p[1], p[2], p[3], p[4], 0]), cmd(0, 0)];
        this.addEvent("Quick Event", ev);
    }

    async quickDoor(x, y) {
        const p = await this.askDestination("Quick Event: Door");
        if (!p) return;
        const ev = blankEvent(this.nextEventId(this.map()), x, y);
        ev.name = "Door";
        const page = ev.pages[0];
        page.image = { tileId: 0, characterName: "!Door1", direction: 2, pattern: 0, characterIndex: 0 };
        page.priorityType = 1;
        page.walkAnime = false;
        const route = {
            list: [
                { code: 35, parameters: [] },
                { code: 17, parameters: [] },
                { code: 15, parameters: [3] },
                { code: 18, parameters: [] },
                { code: 15, parameters: [3] },
                { code: 19, parameters: [] },
                { code: 15, parameters: [3] },
                { code: 0, parameters: [] }
            ],
            repeat: false,
            skippable: false,
            wait: true
        };
        page.list = [
            cmd(250, 0, [SE("Open1")]),
            cmd(205, 0, [0, route]),
            ...route.list.filter(c => c.code !== 0).map(c => cmd(505, 0, [c])),
            cmd(211, 0, [0]),
            cmd(205, 0, [-1, { list: [{ code: 12, parameters: [] }, { code: 0, parameters: [] }], repeat: false, skippable: false, wait: true }]),
            cmd(505, 0, [{ code: 12, parameters: [] }]),
            cmd(201, 0, [0, p[1], p[2], p[3], p[4], 0]),
            cmd(211, 0, [1]),
            cmd(0, 0)
        ];
        this.addEvent("Quick Event", ev);
    }

    async quickTreasure(x, y) {
        const state = [0, 1, 100];
        const f = new Form({ store: this.store }, state);
        const itemBox = h("div");
        const renderItem = () => {
            itemBox.innerHTML = "";
            if (state[0] === 3) itemBox.appendChild(f.num(2, { min: 1, max: 99999999 }));
            else itemBox.appendChild(f.db(1, ["item", "weapon", "armor"][state[0]]));
        };
        renderItem();
        const ok = await openDialog({
            title: "Quick Event: Treasure",
            body: h("div", { class: "col", style: { width: "360px" } }, f.labeled("Contents", f.select(0, [[0, "Item"], [1, "Weapon"], [2, "Armor"], [3, "Gold"]], {
                onChange: () => {
                    state[1] = 1;
                    renderItem();
                }
            })), f.labeled("Value", itemBox))
        });
        if (!ok) return;
        const data = this.store.data;
        const ev = blankEvent(this.nextEventId(this.map()), x, y);
        ev.name = "Treasure";
        const page1 = ev.pages[0];
        page1.image = { tileId: 0, characterName: "!Chest", direction: 2, pattern: 0, characterIndex: 0 };
        page1.priorityType = 1;
        page1.walkAnime = false;
        const openRoute = {
            list: [{ code: 17, parameters: [] }, { code: 15, parameters: [3] }, { code: 18, parameters: [] }, { code: 15, parameters: [3] }, { code: 19, parameters: [] }, { code: 15, parameters: [3] }, { code: 0, parameters: [] }],
            repeat: false,
            skippable: false,
            wait: true
        };
        let gain, text;
        if (state[0] === 3) {
            gain = cmd(125, 0, [0, 0, state[2]]);
            text = state[2] + "\\G obtained!";
        } else {
            const kind = ["Items", "Weapons", "Armors"][state[0]];
            const code = [126, 127, 128][state[0]];
            gain = cmd(code, 0, code === 126 ? [state[1], 0, 0, 1] : [state[1], 0, 0, 1, false]);
            text = (data[kind][state[1]] ? data[kind][state[1]].name : "Item") + " obtained!";
        }
        page1.list = [
            cmd(250, 0, [SE("Chest1")]),
            cmd(205, 0, [0, openRoute]),
            ...openRoute.list.filter(c => c.code !== 0).map(c => cmd(505, 0, [c])),
            gain,
            cmd(101, 0, ["", 0, 0, 2, ""]),
            cmd(401, 0, [text]),
            cmd(123, 0, ["A", 0]),
            cmd(0, 0)
        ];
        const page2 = blankEventPage();
        page2.conditions.selfSwitchValid = true;
        page2.conditions.selfSwitchCh = "A";
        page2.image = { tileId: 0, characterName: "!Chest", direction: 8, pattern: 0, characterIndex: 0 };
        page2.priorityType = 1;
        page2.walkAnime = false;
        ev.pages.push(page2);
        this.addEvent("Quick Event", ev);
    }

    async quickInn(x, y) {
        const state = { price: 50, image: "People1", index: 0 };
        const ok = await openDialog({
            title: "Quick Event: Inn",
            body: h("div", { class: "col", style: { width: "320px" } }, field("Price", numberInput(state.price, v => (state.price = v), { min: 0, max: 99999 })))
        });
        if (!ok) return;
        const ev = blankEvent(this.nextEventId(this.map()), x, y);
        ev.name = "Inn";
        const page = ev.pages[0];
        page.image = { tileId: 0, characterName: state.image, direction: 2, pattern: 1, characterIndex: state.index };
        page.priorityType = 1;
        const P = state.price;
        page.list = [
            cmd(101, 0, ["", 0, 0, 2, "Innkeeper"]),
            cmd(401, 0, ["Welcome! A night's stay is " + P + "\\G."]),
            cmd(401, 0, ["Would you like to rest?\\$"]),
            cmd(102, 0, [["Stay", "Leave"], 1, 0, 2, 0]),
            cmd(402, 0, [0, "Stay"]),
            cmd(111, 1, [7, P, 0]),
            cmd(125, 2, [1, 0, P]),
            cmd(221, 2),
            cmd(249, 2, [SE("Inn1")]),
            cmd(230, 2, [180]),
            cmd(314, 2, [0, 0]),
            cmd(222, 2),
            cmd(101, 2, ["", 0, 0, 2, "Innkeeper"]),
            cmd(401, 2, ["Good morning! Come again."]),
            cmd(0, 2),
            cmd(411, 1),
            cmd(101, 2, ["", 0, 0, 2, "Innkeeper"]),
            cmd(401, 2, ["Sorry, you don't have enough money."]),
            cmd(0, 2),
            cmd(412, 1),
            cmd(0, 1),
            cmd(402, 0, [1, "Leave"]),
            cmd(0, 1),
            cmd(404, 0),
            cmd(0, 0)
        ];
        this.addEvent("Quick Event", ev);
    }
}

export { pad, selectInput, textInput };
