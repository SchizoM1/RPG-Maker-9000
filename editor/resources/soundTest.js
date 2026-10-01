// soundTest.js — Sound Test (F11).
import { h } from "../ui/dom.js";
import { openDialog } from "../ui/dialog.js";
import { ListBox, TabView, button } from "../ui/widgets.js";
import { listAssetNames, playAudioPreview, stopAudioPreview } from "../ui/pickers.js";

export async function openSoundTest() {
    const state = { volume: 90, pitch: 100, pan: 0 };
    const makeTab = folder => () => {
        const list = new ListBox({ onActivate: i => play(i) });
        list.el.style.height = "380px";
        let names = [];
        listAssetNames("audio/" + folder, [".ogg", ".m4a", ".mp3", ".wav"]).then(n => {
            names = n;
            list.setItems(n.map(x => ({ label: x })));
        });
        const play = i => names[i] && playAudioPreview(folder, { name: names[i], ...state });
        return h("div", { class: "col" }, list.el, h("div", { class: "row" }, button("▶ Play", () => play(list.index)), button("■ Stop", stopAudioPreview)));
    };
    const tabs = new TabView([
        { id: "bgm", label: "BGM", build: makeTab("bgm") },
        { id: "bgs", label: "BGS", build: makeTab("bgs") },
        { id: "me", label: "ME", build: makeTab("me") },
        { id: "se", label: "SE", build: makeTab("se") }
    ]);
    const slider = (label, key, min, max) => {
        const v = h("span", {}, String(state[key]));
        const input = h("input", { type: "range", min, max, value: state[key] });
        input.addEventListener("input", () => {
            state[key] = Number(input.value);
            v.textContent = input.value;
        });
        return h("div", { class: "row center" }, h("span", { style: { width: "60px" } }, label), input, v);
    };
    await openDialog({
        title: "Sound Test",
        id: "sound-test",
        body: h("div", { class: "row", style: { alignItems: "flex-start", width: "640px" } }, h("div", { class: "grow" }, tabs.el), h("div", { class: "col" }, slider("Volume", "volume", 0, 100), slider("Pitch", "pitch", 50, 150), slider("Pan", "pan", -100, 100))),
        buttons: ["close"],
        onClose: stopAudioPreview
    });
}
