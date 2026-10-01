// resourceManager.js — browse, preview, import and delete project assets.
import { h, clear } from "../ui/dom.js";
import { openDialog, confirmDialog, alertDialog, toast } from "../ui/dialog.js";
import { ListBox, button } from "../ui/widgets.js";
import { api, projectUrl } from "../core/api.js";
import { invalidateImages } from "../core/images.js";
import { playAudioPreview, stopAudioPreview } from "../ui/pickers.js";

const FOLDERS = [
    "audio/bgm", "audio/bgs", "audio/me", "audio/se",
    "img/animations", "img/battlebacks1", "img/battlebacks2", "img/characters", "img/enemies", "img/faces",
    "img/parallaxes", "img/pictures", "img/sv_actors", "img/sv_enemies", "img/system", "img/tilesets",
    "img/titles1", "img/titles2", "movies", "fonts", "effects", "js/plugins"
];

export async function openResourceManager(app) {
    let folder = FOLDERS[0];
    let files = [];
    const preview = h("div", { class: "image-thumb", style: { width: "420px", height: "360px", cursor: "default" } });
    const info = h("div", { class: "hint" });
    const fileList = new ListBox({ onChange: i => show(files[i]), onActivate: i => activate(files[i]), multi: true });
    fileList.el.style.width = "260px";
    fileList.el.style.height = "380px";
    const folderList = new ListBox({ onChange: i => selectFolder(FOLDERS[i]) });
    folderList.el.style.width = "160px";
    folderList.el.style.height = "380px";
    folderList.setItems(FOLDERS.map(f => ({ label: f })));
    const selectFolder = async f => {
        folder = f;
        stopAudioPreview();
        files = (await api.fs.list(f, { stat: true })).filter(e => !e.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
        fileList.setItems(files.map(e => ({ label: e.name })), false);
        if (!files.length) {
            clear(preview);
            info.textContent = "(empty)";
        }
    };
    const show = file => {
        clear(preview);
        if (!file) return;
        info.textContent = file.name + (file.size != null ? "  —  " + Math.round(file.size / 1024) + " KB" : "");
        if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
            const img = h("img", { src: projectUrl(folder + "/" + file.name) + "?t=" + Date.now(), style: { maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated" } });
            preview.appendChild(img);
        } else if (/\.(ogg|m4a|mp3|wav)$/i.test(file.name)) {
            preview.appendChild(h("div", { class: "hint" }, "Double-click to play"));
        }
    };
    const activate = file => {
        if (file && /\.(ogg|m4a|mp3|wav)$/i.test(file.name)) {
            playAudioPreview(folder.split("/")[1], { name: file.name.replace(/\.[^.]+$/, ""), volume: 90, pitch: 100, pan: 0 });
        }
    };
    const doImport = async () => {
        const isAudio = folder.startsWith("audio/");
        const filters = isAudio
            ? [{ name: "Audio", extensions: ["ogg", "m4a", "mp3", "wav", "mid", "midi"] }]
            : folder === "js/plugins"
              ? [{ name: "JavaScript", extensions: ["js"] }]
              : [{ name: "All Files", extensions: ["*"] }];
        const paths = await api.dialog.chooseFiles({ title: "Import to " + folder, filters });
        if (!paths.length) return;
        if (isAudio && paths.some(p => /\.midi?$/i.test(p))) toast("Converting MIDI to OGG…", "info", 5000);
        try {
            const imported = await api.fs.import(paths, folder);
            toast("Imported: " + imported.join(", "), "ok");
            invalidateImages();
            await selectFolder(folder);
        } catch (e) {
            toast("Import failed: " + e.message, "error", 6000);
        }
    };
    // Lists files referenced by the saved data that don't exist on disk.
    const showMissing = async () => {
        const missing = await api.project.missingAssets();
        const unsaved = app.store.isDirty() ? "\n\n(Checked the saved project. Save to include your latest changes.)" : "";
        if (!missing.length) return alertDialog("No missing files. Every image and sound used by the database and maps exists." + unsaved, "Missing Files");
        return alertDialog(missing.length + " referenced file(s) are missing:\n\n" + missing.map(m => "  " + m).join("\n") + unsaved, "Missing Files");
    };
    const doDelete = async () => {
        const chosen = fileList.selectedIndices().map(i => files[i]).filter(Boolean);
        if (!chosen.length) return;
        if (!(await confirmDialog("Delete " + chosen.length + " file(s) from " + folder + "?", "Delete", "Delete"))) return;
        for (const f of chosen) await api.fs.delete(folder + "/" + f.name);
        invalidateImages();
        await selectFolder(folder);
    };
    setTimeout(() => folderList.select(0), 0);
    await openDialog({
        title: "Resource Manager",
        id: "resource-manager",
        body: h(
            "div",
            { class: "col" },
            h("div", { class: "row", style: { alignItems: "flex-start" } }, folderList.el, fileList.el, h("div", { class: "col" }, preview, info)),
            h("div", { class: "row" }, button("Import…", doImport, { primary: true }), button("Delete", doDelete), button("Open Folder", () => api.app.showProjectFolder(folder)), button("■ Stop", stopAudioPreview), button("Missing Files…", showMissing)),
            h("div", { class: "hint" }, "MIDI files imported into audio folders are converted to OGG automatically.")
        ),
        buttons: ["close"],
        onClose: () => {
            stopAudioPreview();
            app.mapView.invalidate(null);
            app.palette.requestRender();
        }
    });
}
