// commandPalette.js — MZ's 3-tab "Event Commands" button dialog.
import { h } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { COMMANDS, PALETTE, PALETTE_ORDER } from "./commands.js";

let lastTab = 1;

export async function chooseCommand(ctx) {
    let chosen = null;
    let dialog = null;
    const content = h("div", { style: { display: "flex", gap: "14px", minWidth: "760px", minHeight: "420px" } });
    const bar = h("div", { class: "tabbar" });
    const show = tab => {
        lastTab = tab;
        content.innerHTML = "";
        [...bar.children].forEach((t, i) => t.classList.toggle("active", i + 1 === tab));
        const groups = PALETTE[tab];
        // Split groups into two columns like MZ.
        const cols = [h("div", { class: "col", style: { flex: "1" } }), h("div", { class: "col", style: { flex: "1" } })];
        let count = 0;
        const total = groups.reduce((n, g) => n + PALETTE_ORDER[g].length + 1, 0);
        for (const group of groups) {
            const col = count < total / 2 ? cols[0] : cols[1];
            const box = h("fieldset", {}, h("legend", {}, group));
            const grid = h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" } });
            for (const code of PALETTE_ORDER[group]) {
                const def = COMMANDS.get(code);
                if (!def) continue;
                const btn = h("button", { class: "btn small", style: { textAlign: "left" }, dataset: { code } }, def.name);
                btn.addEventListener("click", () => {
                    chosen = code;
                    dialog.close(true);
                });
                grid.appendChild(btn);
            }
            box.appendChild(grid);
            col.appendChild(box);
            count += PALETTE_ORDER[group].length + 1;
        }
        content.append(...cols);
    };
    [1, 2, 3].forEach(tab => {
        const t = h("div", { class: "tab", dataset: { tab } }, String(tab));
        t.addEventListener("mousedown", () => show(tab));
        bar.appendChild(t);
    });
    show(lastTab);
    const ok = await openDialog({
        title: "Event Commands",
        id: "event-commands",
        body: h("div", { class: "col" }, bar, content),
        buttons: ["cancel"],
        onOpen: d => (dialog = d)
    });
    void ctx;
    return ok ? chosen : null;
}
