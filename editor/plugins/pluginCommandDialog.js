// pluginCommandDialog.js — edits an MZ Plugin Command (code 357).
import { h, deepClone } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { selectInput, field } from "../ui/widgets.js";
import { loadPluginHeaders } from "./pluginManager.js";
import { mergeParameters } from "./headerParser.js";
import { ParamTable } from "./paramEditors.js";

// params: [pluginName, commandName, commandText, args]
export async function editPluginCommand(ctx, params) {
    const { headers } = await loadPluginHeaders();
    const enabled = ctx.store.plugins.filter(p => p.status).map(p => p.name);
    const available = enabled.filter(n => headers[n] && headers[n].commands.length);
    const state = { plugin: params[0] || available[0] || "", command: params[1] || "", args: deepClone(params[3] || {}) };
    const commandBox = h("div");
    const descEl = h("div", { class: "hint", style: { minHeight: "34px", whiteSpace: "pre-wrap", maxWidth: "560px" } });
    const argsBox = h("div");
    const header = () => headers[state.plugin];
    const commandDef = () => (header() ? header().commands.find(c => c.name === state.command) : null);
    const renderArgs = () => {
        const def = commandDef();
        descEl.textContent = def ? def.desc : "";
        argsBox.innerHTML = "";
        if (def && def.args.length) {
            state.args = mergeParameters(def.args, state.args);
            const table = new ParamTable(ctx, def.args, state.args, header().structs, { height: 220, width: 560 });
            argsBox.appendChild(field("Arguments", table.el));
        } else {
            argsBox.appendChild(h("div", { class: "hint" }, def ? "This command has no arguments." : "Choose a command."));
        }
    };
    const renderCommands = () => {
        commandBox.innerHTML = "";
        const cmds = header() ? header().commands : [];
        if (!cmds.some(c => c.name === state.command)) {
            state.command = cmds[0] ? cmds[0].name : "";
            state.args = {};
        }
        commandBox.appendChild(selectInput(state.command, cmds.map(c => [c.name, c.text || c.name]), v => {
            state.command = v;
            state.args = {};
            renderArgs();
        }, { width: 300 }));
        renderArgs();
    };
    renderCommands();
    const pluginOptions = (available.length ? available : [state.plugin]).filter(Boolean);
    const ok = await openDialog({
        title: "Plugin Command",
        id: "plugin-command",
        body: h(
            "div",
            { class: "col" },
            available.length ? null : h("div", { class: "hint" }, "No enabled plugin declares commands (@command)."),
            h("div", { class: "row" }, field("Plugin Name", selectInput(state.plugin, pluginOptions, v => {
                state.plugin = v;
                state.command = "";
                renderCommands();
            }, { width: 240 })), field("Command Name", commandBox)),
            descEl,
            argsBox
        )
    });
    if (!ok || !state.plugin || !state.command) return undefined;
    const def = commandDef();
    return [state.plugin, state.command, def ? def.text || def.name : state.command, state.args];
}
