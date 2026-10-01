// preload.js — the only bridge between the editor renderer and Node/Electron.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("rpg9k", {
    app: {
        info: () => invoke("app:info"),
        setTitle: title => invoke("app:set-title", title),
        confirmClose: () => invoke("app:confirm-close"),
        toggleDevTools: () => invoke("app:toggle-devtools"),
        openExternal: url => invoke("app:open-external", url),
        showProjectFolder: rel => invoke("app:show-project-folder", rel),
        onBeforeClose: callback => {
            ipcRenderer.on("app:before-close", () => callback());
            invoke("app:set-close-guard", true);
        }
    },
    dialog: {
        chooseFolder: options => invoke("dialog:choose-folder", options),
        openProject: () => invoke("dialog:open-project"),
        chooseFiles: options => invoke("dialog:choose-files", options),
        message: options => invoke("dialog:message", options)
    },
    project: {
        create: options => invoke("project:create", options),
        open: path => invoke("project:open", path),
        close: () => invoke("project:close"),
        removeRecent: dir => invoke("project:remove-recent", dir),
        backup: options => invoke("project:backup", options),
        missingAssets: () => invoke("project:missing-assets")
    },
    fs: {
        readText: rel => invoke("fs:read-text", rel),
        readJson: rel => invoke("fs:read-json", rel),
        writeText: (rel, text) => invoke("fs:write-text", rel, text),
        writeJson: (rel, value) => invoke("fs:write-json", rel, value),
        exists: rel => invoke("fs:exists", rel),
        list: (rel, options) => invoke("fs:list", rel, options),
        delete: rel => invoke("fs:delete", rel),
        rename: (from, to) => invoke("fs:rename", from, to),
        import: (absPaths, relDir, options) => invoke("fs:import", absPaths, relDir, options)
    },
    playtest: {
        start: options => invoke("playtest:start", options)
    },
    deploy: {
        run: options => invoke("deploy:run", options),
        onProgress: callback => ipcRenderer.on("deploy:progress", (e, p) => callback(p))
    },
    media: {
        midiSupport: () => invoke("media:midi-available")
    }
});
