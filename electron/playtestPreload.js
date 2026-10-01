// playtestPreload.js — gives a playtest window file-based saves (project/save)
// through window.rpg9kHost, used by the runtime's StorageManager.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("rpg9kHost", {
    saveFile: (name, data) => invoke("playtest:save-file", name, data),
    loadFile: name => invoke("playtest:load-file", name),
    removeFile: name => invoke("playtest:remove-file", name),
    listFiles: () => invoke("playtest:list-files"),
    reload: () => invoke("playtest:reload"),
    showDevTools: () => invoke("playtest:devtools"),
    close: () => invoke("playtest:close")
});
