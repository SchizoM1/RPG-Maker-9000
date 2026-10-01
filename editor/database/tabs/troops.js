// Troops tab — battle preview with draggable enemies, battle event pages,
// and Battle Test.
import { h, clear, idName, deepClone } from "../../ui/dom.js";
import { openDialog, toast } from "../../ui/dialog.js";
import { fieldset, field, ListBox, numberInput, selectInput, button, checkbox } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, dbOptions } from "../dbFields.js";
import { loadImage, whenReady } from "../../core/images.js";
import { blankTroopPage } from "../../core/defaultData.js";
import { CommandList, commandListStyles } from "../../events/commandList.js";
import { switchVariablePicker, switchVariableLabel } from "../../ui/pickers.js";

const SCALE = 0.62;

function conditionSummary(env, c) {
    const parts = [];
    if (c.turnEnding) parts.push("Turn End");
    if (c.turnValid) parts.push("Turn " + c.turnA + "+" + c.turnB + "*X");
    if (c.enemyValid) parts.push("Enemy #" + (c.enemyIndex + 1) + " HP ≤ " + c.enemyHp + "%");
    if (c.actorValid) parts.push(((env.db.Actors[c.actorId] || {}).name || "?") + " HP ≤ " + c.actorHp + "%");
    if (c.switchValid) parts.push("Switch " + switchVariableLabel(env.store, "switch", c.switchId));
    return parts.length ? parts.join(", ") : "Don't Run";
}

async function editConditions(env, troop, c) {
    const x = deepClone(c);
    const swBtn = button(switchVariableLabel(env.store, "switch", x.switchId), async () => {
        const r = await switchVariablePicker(env.store, "switch", x.switchId);
        if (r) {
            x.switchId = r;
            swBtn.textContent = switchVariableLabel(env.store, "switch", r);
        }
    });
    const enemies = troop.members.map((m, i) => [i, "#" + (i + 1) + " " + ((env.db.Enemies[m.enemyId] || {}).name || "?")]);
    const ok = await openDialog({
        title: "Conditions",
        body: h(
            "div",
            { class: "col", style: { width: "440px" } },
            checkbox(x.turnEnding, "Turn End", v => (x.turnEnding = v)),
            h("div", { class: "row center" }, checkbox(x.turnValid, "Turn", v => (x.turnValid = v)), numberInput(x.turnA, v => (x.turnA = v), { min: 0, max: 999, width: 60 }), "+", numberInput(x.turnB, v => (x.turnB = v), { min: 0, max: 999, width: 60 }), "* X"),
            h("div", { class: "row center" }, checkbox(x.enemyValid, "Enemy HP", v => (x.enemyValid = v)), selectInput(x.enemyIndex, enemies.length ? enemies : [[0, "#1"]], v => (x.enemyIndex = v)), "≤", numberInput(x.enemyHp, v => (x.enemyHp = v), { min: 0, max: 100, width: 60 }), "%"),
            h("div", { class: "row center" }, checkbox(x.actorValid, "Actor HP", v => (x.actorValid = v)), selectInput(x.actorId, dbOptions(env.db.Actors), v => (x.actorId = v)), "≤", numberInput(x.actorHp, v => (x.actorHp = v), { min: 0, max: 100, width: 60 }), "%"),
            h("div", { class: "row center" }, checkbox(x.switchValid, "Switch", v => (x.switchValid = v)), swBtn, "is ON")
        )
    });
    return ok ? x : null;
}

async function battleTest(env, troopId) {
    const sys = env.db.System;
    const battlers = deepClone(sys.testBattlers).slice(0, 4);
    while (battlers.length < 4) battlers.push({ actorId: 0, level: 1, equips: [0, 0, 0, 0, 0] });
    const rows = battlers.map(b =>
        h("div", { class: "row center" }, selectInput(b.actorId, [[0, "None"], ...dbOptions(env.db.Actors)], v => {
            b.actorId = v;
            const actor = env.db.Actors[v];
            if (actor) b.equips = actor.equips.slice();
        }, { width: 220 }), "Level", numberInput(b.level, v => (b.level = v), { min: 1, max: 99, width: 60 }))
    );
    const ok = await openDialog({ title: "Battle Test", body: h("div", { class: "col" }, h("div", { class: "hint" }, "Party members for the test battle:"), ...rows), okLabel: "Start" });
    if (!ok) return;
    sys.testBattlers = battlers.filter(b => b.actorId > 0);
    sys.testTroopId = troopId;
    // Write the working database so the playtest sees current data.
    const app = env.app;
    for (const key of Object.keys(env.db)) {
        if (JSON.stringify(env.db[key]) !== JSON.stringify(env.realStore.data[key])) {
            env.realStore.data[key] = deepClone(env.db[key]);
            env.realStore.markDirty(key);
        }
    }
    await app.playtest(["btest"]);
    toast("Battle test started.", "ok", 1500);
}

export function troopsTab(env) {
    const db = env.db;
    return listTab(env, "Troops", (troop, ui) => {
        const canvas = h("canvas", { width: Math.round(816 * SCALE), height: Math.round(444 * SCALE) });
        let selected = -1;
        let drag = null;
        const images = new Map();
        const draw = async () => {
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#223";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for (const name of [[db.System.battleback1Name, "battlebacks1"], [db.System.battleback2Name, "battlebacks2"]]) {
                if (!name[0]) continue;
                const b = await whenReady(loadImage(name[1], name[0]));
                if (b && b.source) ctx.drawImage(b.source, (b.width - 816) / 2, (b.height - 624) / 2 + 24, 816, 444, 0, 0, canvas.width, canvas.height);
            }
            const folder = db.System.optSideView ? "sv_enemies" : "enemies";
            for (let i = 0; i < troop.members.length; i++) {
                const m = troop.members[i];
                const enemy = db.Enemies[m.enemyId];
                if (!enemy || !enemy.battlerName) continue;
                let b = images.get(enemy.battlerName);
                if (!b) {
                    b = await whenReady(loadImage(folder, enemy.battlerName));
                    images.set(enemy.battlerName, b);
                }
                if (!b || !b.source) continue;
                const w = b.width * SCALE, hh = b.height * SCALE;
                const x = m.x * SCALE - w / 2, y = m.y * SCALE - hh;
                ctx.globalAlpha = m.hidden ? 0.5 : 1;
                ctx.drawImage(b.source, x, y, w, hh);
                ctx.globalAlpha = 1;
                if (i === selected) {
                    ctx.strokeStyle = "#ffd33d";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, w, hh);
                }
            }
        };
        const hit = (mx, my) => {
            for (let i = troop.members.length - 1; i >= 0; i--) {
                const m = troop.members[i];
                const enemy = db.Enemies[m.enemyId];
                const b = enemy && images.get(enemy.battlerName);
                const w = b ? b.width : 100, hh = b ? b.height : 100;
                if (mx >= m.x - w / 2 && mx <= m.x + w / 2 && my >= m.y - hh && my <= m.y) return i;
            }
            return -1;
        };
        canvas.addEventListener("mousedown", e => {
            const r = canvas.getBoundingClientRect();
            const mx = (e.clientX - r.left) / SCALE, my = (e.clientY - r.top) / SCALE;
            selected = hit(mx, my);
            if (selected >= 0) drag = { i: selected, dx: troop.members[selected].x - mx, dy: troop.members[selected].y - my };
            draw();
        });
        canvas.addEventListener("mousemove", e => {
            if (!drag) return;
            const r = canvas.getBoundingClientRect();
            const m = troop.members[drag.i];
            m.x = Math.round((e.clientX - r.left) / SCALE + drag.dx);
            m.y = Math.round((e.clientY - r.top) / SCALE + drag.dy);
            draw();
        });
        window.addEventListener("mouseup", () => (drag = null));
        canvas.addEventListener("dblclick", () => {
            if (selected >= 0) {
                troop.members[selected].hidden = !troop.members[selected].hidden;
                draw();
            }
        });
        let addId = 1;
        const align = () => {
            const n = troop.members.length;
            troop.members.forEach((m, i) => {
                m.x = Math.round(816 / 2 + (i - (n - 1) / 2) * Math.min(160, 700 / Math.max(1, n)));
                m.y = 436;
            });
            draw();
        };
        const autoName = () => {
            const counts = new Map();
            for (const m of troop.members) {
                const name = (db.Enemies[m.enemyId] || {}).name || "?";
                counts.set(name, (counts.get(name) || 0) + 1);
            }
            troop.name = [...counts].map(([n, c]) => (c > 1 ? n + "*" + c : n)).join(", ");
            nameInput.value = troop.name;
            ui.updateName();
        };
        const nameInput = bindText(troop, "name", { onChange: ui.updateName, width: 280 });
        const controls = h(
            "div",
            { class: "col" },
            selectInput(addId, dbOptions(db.Enemies), v => (addId = v), { width: 200 }),
            button("< Add", () => {
                if (troop.members.length >= 8) return toast("A troop can have up to 8 enemies.", "error");
                troop.members.push({ enemyId: addId, x: 408, y: 436, hidden: false });
                align();
            }),
            button("Remove >", () => {
                if (selected >= 0) {
                    troop.members.splice(selected, 1);
                    selected = -1;
                    draw();
                }
            }),
            button("Clear", () => {
                troop.members = [];
                draw();
            }),
            button("Align", align),
            button("Auto-name", autoName),
            button("Battle Test…", () => battleTest(env, ui.id)),
            h("div", { class: "hint" }, "Drag to move. Double-click\ntoggles 'Appear Halfway'.")
        );
        // Battle event pages
        const pageHost = h("div", { class: "col grow", style: { minHeight: "260px" } });
        let pageIndex = 0;
        const pageBar = h("div", { class: "tabbar" });
        const ctx = { store: env.store, map: null, troop };
        const renderPages = () => {
            clear(pageBar);
            troop.pages.forEach((p, i) => {
                const t = h("div", { class: "tab" + (i === pageIndex ? " active" : "") }, String(i + 1));
                t.addEventListener("mousedown", () => {
                    pageIndex = i;
                    renderPages();
                });
                pageBar.appendChild(t);
            });
            clear(pageHost);
            const page = troop.pages[pageIndex];
            const condBtn = button(conditionSummary(env, page.conditions), async () => {
                const r = await editConditions(env, troop, page.conditions);
                if (r) {
                    page.conditions = r;
                    condBtn.textContent = conditionSummary(env, r);
                }
            });
            const list = new CommandList(ctx, page.list);
            list.el.style.minHeight = "200px";
            pageHost.append(
                h("div", { class: "row center" }, "Condition:", condBtn, "Span:", selectInput(page.span, [[0, "Battle"], [1, "Turn"], [2, "Moment"]], v => (page.span = v))),
                list.el
            );
        };
        const pageButtons = h(
            "div",
            { class: "row" },
            button("New Page", () => {
                troop.pages.push(blankTroopPage());
                pageIndex = troop.pages.length - 1;
                renderPages();
            }, { small: true }),
            button("Delete Page", () => {
                if (troop.pages.length > 1) troop.pages.splice(pageIndex, 1);
                else troop.pages[0] = blankTroopPage();
                pageIndex = Math.min(pageIndex, troop.pages.length - 1);
                renderPages();
            }, { small: true })
        );
        renderPages();
        draw();
        return h(
            "div",
            { class: "col" },
            commandListStyles(),
            field("Name", nameInput),
            h("div", { class: "row", style: { alignItems: "flex-start" } }, h("div", { class: "image-thumb", style: { cursor: "default" } }, canvas), controls),
            fieldset("Battle Event", h("div", { class: "col" }, h("div", { class: "row center" }, pageBar, pageButtons), pageHost))
        );
    });
}
