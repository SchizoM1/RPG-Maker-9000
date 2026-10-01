// deployDialog.js — File > Deployment.
import { h } from "../ui/dom.js";
import { openDialog, alertDialog, toast } from "../ui/dialog.js";
import { field, textInput, button, checkbox } from "../ui/widgets.js";
import { api } from "../core/api.js";

export async function openDeployDialog(app) {
    await app.save();
    const title = app.store.system.gameTitle || "Game";
    const safe = title.replace(/[^\w\- ]/g, "").replace(/\s+/g, "_") || "Game";
    const state = { parent: "", folder: safe + "_web", excludeUnused: true, bundleData: true, zip: true, overwrite: false };
    const parentInput = textInput(state.parent, v => (state.parent = v));
    parentInput.style.flex = "1";
    const progress = h("div", { class: "hint" });
    const ok = await openDialog({
        title: "Deployment",
        id: "deployment",
        body: h(
            "div",
            { class: "col", style: { width: "520px" } },
            h("div", {}, "Exports the game as a web folder that runs in any browser (and from itch.io or any static host)."),
            field("Output Location", h("div", { class: "row" }, h("div", { class: "grow", style: { display: "flex" } }, parentInput), button("Choose…", async () => {
                const dir = await api.dialog.chooseFolder({ title: "Output Location" });
                if (dir) {
                    state.parent = dir;
                    parentInput.value = dir;
                }
            }))),
            field("Folder Name", textInput(state.folder, v => (state.folder = v))),
            checkbox(state.excludeUnused, "Exclude unused files", v => (state.excludeUnused = v)),
            checkbox(state.bundleData, "Bundle data so index.html also works when opened directly (file://)", v => (state.bundleData = v)),
            checkbox(state.zip, "Create a .zip archive", v => (state.zip = v)),
            checkbox(state.overwrite, "Overwrite the output folder if it exists", v => (state.overwrite = v)),
            h("div", { class: "hint" }, "Note: assets referenced only from script calls or plugins without @requiredAssets may be excluded. Turn off \"Exclude unused files\" if something is missing."),
            progress
        ),
        okLabel: "Export",
        onOk: () => {
            if (!state.parent || !state.folder) {
                toast("Choose an output location.", "error");
                return false;
            }
            return true;
        }
    });
    if (!ok) return;
    api.deploy.onProgress(p => (progress.textContent = p.finished ? "Done." : "Copying " + p.done + " / " + p.total));
    try {
        const sep = state.parent.includes("\\") ? "\\" : "/";
        const report = await api.deploy.run({ outDir: state.parent + sep + state.folder, excludeUnused: state.excludeUnused, bundleData: state.bundleData, zip: state.zip, overwrite: state.overwrite });
        await alertDialog("Deployment finished.\n\nFolder: " + report.outDir + (report.zip ? "\nZip: " + report.zip : "") + "\nFiles: " + report.files + " (skipped " + report.skipped + ")", "Deployment");
    } catch (e) {
        alertDialog("Deployment failed:\n" + e.message, "Deployment");
    }
}
