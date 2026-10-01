// help.js — quick reference window.
import { h } from "./ui/dom.js";
import { openDialog } from "./ui/dialog.js";

const SHORTCUTS = [
    ["Ctrl+N / Ctrl+O / Ctrl+S", "New / Open / Save project"],
    ["Ctrl+Z / Ctrl+Y", "Undo / Redo"],
    ["F5 / F6 / F7", "Map / Event / Region mode"],
    ["P, R, E, F, S", "Pencil, Rectangle, Ellipse, Flood Fill, Shadow Pen"],
    ["Right-click (map)", "Pick a tile; right-drag copies an area as a brush"],
    ["Middle-drag / Space+drag", "Scroll the map"],
    ["Ctrl+Wheel", "Zoom"],
    ["F9", "Database"],
    ["F10", "Plugin Manager"],
    ["F11", "Sound Test"],
    ["Ctrl+F", "Event Searcher"],
    ["Ctrl+R", "Playtest (F9 in-game opens the debug screen, F8 dev tools)"],
    ["Event list: Space/Enter, Ins, Del, Ctrl+C/X/V", "Edit, insert, delete, copy/cut/paste commands"]
];

export async function openHelp() {
    await openDialog({
        title: "RPG Maker 9000 Help",
        id: "help",
        body: h(
            "div",
            { class: "col", style: { width: "640px" } },
            h("h3", { style: { margin: "0" } }, "Keyboard shortcuts"),
            h("div", { style: { display: "grid", gridTemplateColumns: "260px 1fr", gap: "4px 12px" } }, ...SHORTCUTS.flatMap(([k, d]) => [h("kbd", { style: { justifySelf: "start" } }, k), h("div", {}, d)])),
            h("h3", { style: { margin: "8px 0 0" } }, "Plugins"),
            h("div", {}, "Plugins are JavaScript files in js/plugins. They use the MZ plugin API: PluginManager.parameters(name), PluginManager.registerCommand(plugin, command, fn), and aliasing of runtime classes such as Scene_Map or Window_Base. See docs/plugin-api.md in the RPG Maker 9000 folder.")
        ),
        buttons: ["close"]
    });
}
