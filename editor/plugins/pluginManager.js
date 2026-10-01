// pluginManager.js — the Plugin Manager (F10).
import { h, deepClone } from "../ui/dom.js";
import { openDialog, toast, confirmDialog } from "../ui/dialog.js";
import { ListBox, button, selectInput, radioGroup, field } from "../ui/widgets.js";
import { showPopupMenu } from "../ui/menu.js";
import { api } from "../core/api.js";
import { parsePluginHeader, mergeParameters, checkPluginOrder } from "./headerParser.js";
import { ParamTable } from "./paramEditors.js";

export async function loadPluginHeaders() {
    const files = (await api.fs.list("js/plugins")).filter(f => !f.isDirectory && f.name.endsWith(".js")).map(f => f.name.slice(0, -3));
    const headers = {};
    for (const name of files) {
        try {
            headers[name] = parsePluginHeader(await api.fs.readText("js/plugins/" + name + ".js"), name);
        } catch (e) {
            headers[name] = null;
        }
    }
    return { files: files.sort((a, b) => a.localeCompare(b)), headers };
}

export async function openPluginManager(app) {
    const store = app.store;
    const plugins = deepClone(store.plugins);
    let { files, headers } = await loadPluginHeaders();
    const warningsEl = h("div", { class: "hint", style: { color: "#e0a050", minHeight: "18px" } });
    const list = new ListBox({
        onActivate: i => editPlugin(i),
        trailingRow: "(double-click to add a plugin)",
        columns: [220, 50],
        header: ["Name", "Status", "Description"],
        onContextMenu: (e, i) => menu(e, i),
        onKey: e => {
            if (e.key === "Delete") remove(list.index);
            if (e.altKey && e.key === "ArrowUp") move(-1);
            if (e.altKey && e.key === "ArrowDown") move(1);
        }
    });
    list.el.style.height = "420px";
    list.el.style.width = "820px";
    const render = () => {
        list.setItems(
            plugins.map(p => ({
                cells: [p.name, p.status ? "ON" : "OFF", p.description || ""],
                dim: !p.status
            }))
        );
        const warnings = checkPluginOrder(plugins, headers);
        const missing = plugins.filter(p => !files.includes(p.name)).map(p => ({ plugin: p.name, message: "File js/plugins/" + p.name + ".js not found." }));
        warningsEl.textContent = [...missing, ...warnings].map(w => w.plugin + ": " + w.message).join("\n");
    };
    const editPlugin = async i => {
        const isNew = i >= plugins.length;
        const entry = isNew ? { name: files.find(f => !plugins.some(p => p.name === f)) || files[0] || "", status: true, description: "", parameters: {} } : deepClone(plugins[i]);
        if (!entry.name && !files.length) {
            toast("No plugins found in js/plugins. Import .js files there first.", "error");
            return;
        }
        const r = await editPluginEntry(app, entry, files, headers);
        if (!r) return;
        if (isNew) plugins.push(r);
        else plugins[i] = r;
        render();
        list.select(i);
    };
    const remove = async i => {
        if (i < 0 || i >= plugins.length) return;
        plugins.splice(i, 1);
        render();
    };
    const move = d => {
        const i = list.index, j = i + d;
        if (i < 0 || j < 0 || j >= plugins.length) return;
        [plugins[i], plugins[j]] = [plugins[j], plugins[i]];
        render();
        list.select(j);
    };
    const menu = (e, i) =>
        showPopupMenu(
            [
                { label: "Edit…", action: () => editPlugin(i) },
                { label: "Insert…", action: () => editPlugin(plugins.length) },
                "-",
                { label: "Toggle ON/OFF", enabled: i < plugins.length, action: () => { plugins[i].status = !plugins[i].status; render(); } },
                { label: "Move Up", enabled: i > 0 && i < plugins.length, action: () => move(-1) },
                { label: "Move Down", enabled: i < plugins.length - 1, action: () => move(1) },
                "-",
                { label: "Delete", enabled: i < plugins.length, action: () => remove(i) }
            ],
            e.clientX,
            e.clientY
        );
    const importBtn = button("Import Plugin File…", async () => {
        const paths = await api.dialog.chooseFiles({ title: "Import Plugin", filters: [{ name: "JavaScript", extensions: ["js"] }] });
        if (!paths.length) return;
        await api.fs.import(paths, "js/plugins");
        ({ files, headers } = await loadPluginHeaders());
        toast("Imported " + paths.length + " plugin file(s).", "ok");
        render();
    });
    render();
    const ok = await openDialog({
        title: "Plugin Manager",
        id: "plugin-manager",
        body: h("div", { class: "col" }, list.el, warningsEl, h("div", { class: "row" }, button("Up", () => move(-1)), button("Down", () => move(1)), importBtn, button("Open Plugin Folder", () => api.app.showProjectFolder("js/plugins")))),
        leftButtons: []
    });
    if (!ok) return;
    store.setPlugins(plugins);
    await store.save();
    toast("Plugin settings saved.", "ok");
}

async function editPluginEntry(app, entry, files, headers) {
    const store = app.store;
    const state = deepClone(entry);
    const ctx = { store, map: app.currentMap() };
    const info = h("div", { class: "col", style: { width: "300px" } });
    const helpEl = h("div", { class: "help-text", style: { height: "260px", width: "560px" } });
    const paramsBox = h("div");
    const refresh = () => {
        const header = headers[state.name];
        state.description = header ? header.description : state.description;
        state.parameters = header ? mergeParameters(header.params, state.parameters) : state.parameters;
        info.innerHTML = "";
        info.append(
            ...[
            field("Description", h("div", {}, state.description || "(none)")),
            field("Author", h("div", {}, header ? header.author || "(unknown)" : "(unknown)")),
            header && header.url ? field("URL", h("a", { href: "#", onclick: e => { e.preventDefault(); api.app.openExternal(header.url); } }, header.url)) : null,
            header && header.target ? field("Target", h("div", {}, header.target)) : null
            ].filter(Boolean)
        );
        helpEl.textContent = header ? header.help || "(no help)" : "This file has no plugin annotation block.";
        paramsBox.innerHTML = "";
        if (header && header.params.length) {
            const table = new ParamTable(ctx, header.params, state.parameters, header.structs, { height: 220, width: 560 });
            paramsBox.appendChild(field("Parameters", table.el));
        } else {
            paramsBox.appendChild(h("div", { class: "hint" }, "This plugin has no parameters."));
        }
    };
    refresh();
    const nameSelect = selectInput(state.name, files, v => {
        state.name = v;
        state.parameters = {};
        refresh();
    }, { width: 300 });
    const ok = await openDialog({
        title: "Plugin",
        id: "plugin-entry",
        body: h(
            "div",
            { class: "row", style: { alignItems: "flex-start" } },
            h("div", { class: "col" }, field("Name", nameSelect), field("Status", radioGroup(state.status, [[true, "ON"], [false, "OFF"]], v => (state.status = v))), info),
            h("div", { class: "col" }, field("Help", helpEl), paramsBox)
        )
    });
    void confirmDialog;
    return ok ? state : null;
}
