// System 1, System 2, Types and Terms tabs.
import { h, clear, idName } from "../../ui/dom.js";
import { promptDialog } from "../../ui/dialog.js";
import { fieldset, field, ListBox, button, selectInput, textInput, numberInput } from "../../ui/widgets.js";
import { bindText, bindNum, bindSelect, bindCheck, bindImage, bindAudio, bindCharacter, dbOptions, typeOptions, labeled } from "../dbFields.js";
import { tonePicker } from "../../ui/pickers.js";

const SOUND_NAMES = [
    "Cursor", "OK", "Cancel", "Buzzer", "Equip", "Save", "Load", "Battle Start", "Escape", "Enemy Attack",
    "Enemy Damage", "Enemy Collapse", "Boss Collapse 1", "Boss Collapse 2", "Actor Damage", "Actor Collapse",
    "Recovery", "Miss", "Evasion", "Magic Evasion", "Magic Reflection", "Shop", "Use Item", "Use Skill"
];

function scrollCol(...children) {
    return h("div", { class: "col", style: { flex: "1", overflow: "auto", minHeight: "0", paddingRight: "6px" } }, ...children);
}

export function system1Tab(env) {
    const db = env.db;
    const sys = db.System;
    // Starting party
    const party = new ListBox({ onKey: e => e.key === "Delete" && removeMember() });
    party.el.style.height = "110px";
    const renderParty = () => party.setItems(sys.partyMembers.map(id => ({ label: idName(id, (db.Actors[id] || {}).name) })));
    let addActor = 1;
    const removeMember = () => {
        if (party.index >= 0) {
            sys.partyMembers.splice(party.index, 1);
            renderParty();
        }
    };
    renderParty();
    const toneBtn = button("(" + sys.windowTone.join(",") + ")", async () => {
        const r = await tonePicker(sys.windowTone, "Window Color");
        if (r) {
            sys.windowTone = r;
            toneBtn.textContent = "(" + r.join(",") + ")";
        }
    });
    const sounds = sys.sounds.map((s, i) => labeled(SOUND_NAMES[i], bindAudio(sys.sounds, i, "se", { width: 230 }), 120));
    const vehicles = ["boat", "ship", "airship"].map(v => field(v[0].toUpperCase() + v.slice(1), bindCharacter(sys[v], "characterName", "characterIndex", env.store)));
    const left = scrollCol(
        fieldset("Game Title", bindText(sys, "gameTitle", { width: 300 })),
        fieldset("Currency", bindText(sys, "currencyUnit", { width: 100 })),
        fieldset(
            "Starting Party",
            party.el,
            h("div", { class: "row" }, selectInput(addActor, dbOptions(db.Actors), v => (addActor = v), { width: 180 }), button("Add", () => {
                sys.partyMembers.push(addActor);
                renderParty();
            }, { small: true }), button("Remove", removeMember, { small: true }))
        ),
        fieldset("Window Color", toneBtn),
        fieldset("Vehicle Images", h("div", { class: "row" }, ...vehicles)),
        fieldset(
            "Title Screen",
            h(
                "div",
                { class: "col" },
                labeled("Background 1", bindImage(sys, "title1Name", "titles1", { width: 200 })),
                labeled("Background 2", bindImage(sys, "title2Name", "titles2", { width: 200 })),
                bindCheck(sys, "optDrawTitle", "Draw Game Title"),
                labeled("Command Window", bindSelect(sys.titleCommandWindow, "background", [[0, "Window"], [1, "Dim"], [2, "Transparent"]]))
            )
        )
    );
    const middle = scrollCol(
        fieldset(
            "Music",
            h(
                "div",
                { class: "col" },
                labeled("Title", bindAudio(sys, "titleBgm", "bgm"), 100),
                labeled("Battle", bindAudio(sys, "battleBgm", "bgm"), 100),
                labeled("Victory", bindAudio(sys, "victoryMe", "me"), 100),
                labeled("Defeat", bindAudio(sys, "defeatMe", "me"), 100),
                labeled("Game Over", bindAudio(sys, "gameoverMe", "me"), 100),
                labeled("Boat", bindAudio(sys.boat, "bgm", "bgm"), 100),
                labeled("Ship", bindAudio(sys.ship, "bgm", "bgm"), 100),
                labeled("Airship", bindAudio(sys.airship, "bgm", "bgm"), 100)
            )
        ),
        fieldset(
            "Options",
            h(
                "div",
                { class: "col", style: { gap: "0" } },
                bindCheck(sys, "optSideView", "Use Side-view Battle"),
                bindCheck(sys, "optTransparent", "Start Transparent"),
                bindCheck(sys, "optFollowers", "Show Player Followers"),
                bindCheck(sys, "optSlipDeath", "Knockout by Slip Damage"),
                bindCheck(sys, "optFloorDeath", "Knockout by Floor Damage"),
                bindCheck(sys, "optDisplayTp", "Display TP in Battle"),
                bindCheck(sys, "optExtraExp", "EXP for Reserve Members"),
                bindCheck(sys, "optAutosave", "Enable Autosave"),
                bindCheck(sys, "optSplashScreen", "Show Splash Screen"),
                bindCheck(sys, "optMessageSkip", "Enable Message Skip"),
                bindCheck(sys, "optKeyItemsNumber", "Show Number of Key Items")
            )
        ),
        fieldset("Battle System", bindSelect(sys, "battleSystem", [[0, "Turn-based"], [1, "Time Progress (Active)"], [2, "Time Progress (Wait)"]])),
        fieldset(
            "Menu Commands",
            h("div", { class: "grid-2" }, ...["Item", "Skill", "Equip", "Status", "Formation", "Save"].map((n, i) => bindCheck(sys.menuCommands, i, n)))
        ),
        fieldset("Item Categories", h("div", { class: "grid-2" }, ...["Item", "Weapon", "Armor", "Key Item"].map((n, i) => bindCheck(sys.itemCategories, i, n))))
    );
    const right = scrollCol(fieldset("Sound Effects", h("div", { class: "col", style: { gap: "3px" } }, ...sounds)));
    return h("div", { class: "row", style: { alignItems: "stretch", height: "100%", minHeight: "0" } }, left, middle, right);
}

export function system2Tab(env) {
    const db = env.db;
    const sys = db.System;
    const adv = sys.advanced;
    const testList = new ListBox({});
    testList.el.style.height = "110px";
    const renderTest = () => testList.setItems(sys.testBattlers.map(b => ({ label: idName(b.actorId, (db.Actors[b.actorId] || {}).name) + "  Lv " + b.level })));
    renderTest();
    const magic = h("div", { class: "col", style: { gap: "0" } });
    sys.skillTypes.forEach((name, id) => {
        if (id === 0) return;
        const cb = h("input", { type: "checkbox", checked: sys.magicSkills.includes(id) });
        cb.addEventListener("change", () => {
            sys.magicSkills = sys.magicSkills.filter(x => x !== id);
            if (cb.checked) sys.magicSkills.push(id);
            sys.magicSkills.sort((a, b) => a - b);
        });
        magic.appendChild(h("label", { class: "check-label" }, cb, name || "(" + id + ")"));
    });
    return h(
        "div",
        { class: "row", style: { alignItems: "stretch", height: "100%", minHeight: "0" } },
        scrollCol(
            fieldset(
                "Advanced Settings",
                h(
                    "div",
                    { class: "grid-2" },
                    field("Screen Width", bindNum(adv, "screenWidth", { min: 640, max: 3840 })),
                    field("Screen Height", bindNum(adv, "screenHeight", { min: 360, max: 2160 })),
                    field("UI Area Width", bindNum(adv, "uiAreaWidth", { min: 640, max: 3840 })),
                    field("UI Area Height", bindNum(adv, "uiAreaHeight", { min: 360, max: 2160 })),
                    field("Window Opacity", bindNum(adv, "windowOpacity", { min: 0, max: 255 })),
                    field("Font Size", bindNum(adv, "fontSize", { min: 12, max: 72 })),
                    field("Main Font File", bindText(adv, "mainFontFilename")),
                    field("Number Font File", bindText(adv, "numberFontFilename")),
                    field("Fallback Fonts", bindText(adv, "fallbackFonts")),
                    field("Screen Scale", bindNum(adv, "screenScale", { min: 1, max: 4, float: true, step: 0.25 })),
                    field("Picture Upper Limit", bindNum(adv, "picturesUpperLimit", { min: 1, max: 999 })),
                    field("Game ID", bindNum(adv, "gameId", { min: 0, max: 99999999 }))
                )
            ),
            fieldset("Sizes", h("div", { class: "grid-3" }, field("Tile Size", bindNum(sys, "tileSize", { min: 16, max: 128 })), field("Face Size", bindNum(sys, "faceSize", { min: 32, max: 512 })), field("Icon Size", bindNum(sys, "iconSize", { min: 8, max: 128 })))),
            fieldset("Locale", bindSelect(sys, "locale", ["en_US", "ja_JP", "zh_CN", "zh_TW", "ko_KR", "de_DE", "es_ES", "fr_FR", "it_IT", "pt_BR", "ru_RU"]))
        ),
        scrollCol(
            fieldset("Test Battle", testList.el, labeled("Troop", bindSelect(sys, "testTroopId", dbOptions(db.Troops)), 60), h("div", { class: "hint" }, "Set test battlers from the Troops tab → Battle Test.")),
            fieldset("Battle Screen (test)", h("div", { class: "col" }, labeled("Background 1", bindImage(sys, "battleback1Name", "battlebacks1", { width: 200 })), labeled("Background 2", bindImage(sys, "battleback2Name", "battlebacks2", { width: 200 })), labeled("Battler", bindText(sys, "battlerName", { width: 200 })))),
            fieldset("Magic Skills (show spell motion)", magic),
            fieldset("Editor", labeled("Edit Map ID", bindNum(sys, "editMapId", { min: 1 })))
        )
    );
}

function typeList(env, title, key, options = {}) {
    const names = env.db.System[key];
    const list = new ListBox({ onChange: i => (input.value = names[i + 1] || "") });
    list.el.style.height = "380px";
    const input = textInput("", v => {
        const i = list.index + 1;
        if (i < 1) return;
        names[i] = v;
        list.rows[i - 1].textContent = idName(i, v);
    });
    const render = () => list.setItems(names.slice(1).map((n, i) => ({ label: idName(i + 1, n) })));
    const changeMax = async () => {
        const v = await promptDialog("Maximum number:", String(names.length - 1), "Change Maximum");
        const n = parseInt(v, 10);
        if (isNaN(n) || n < (options.min || 1) || n > 999) return;
        while (names.length - 1 < n) names.push("");
        names.length = n + 1;
        render();
    };
    render();
    setTimeout(() => list.select(0), 0);
    return fieldset(title, h("div", { class: "col" }, list.el, input, options.fixed ? null : button("Change Maximum…", changeMax, { small: true })));
}

export function typesTab(env) {
    return h(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" } },
        typeList(env, "Elements", "elements"),
        typeList(env, "Skill Types", "skillTypes"),
        typeList(env, "Weapon Types", "weaponTypes"),
        typeList(env, "Armor Types", "armorTypes"),
        typeList(env, "Equipment Types", "equipTypes", { min: 1 })
    );
}

const COMMAND_LABELS = ["Fight", "Escape", "Attack", "Guard", "Item", "Skill", "Equip", "Status", "Formation", "Save", "Game End", "Options", "Weapon", "Armor", "Key Item", "Equip (2)", "Optimize", "Clear", "New Game", "Continue", null, "To Title", "Cancel", null, "Buy", "Sell"];
const BASIC_LABELS = ["Level", "Level (abbr.)", "HP", "HP (abbr.)", "MP", "MP (abbr.)", "TP", "TP (abbr.)", "EXP", "EXP (abbr.)"];
const PARAM_LABELS = ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "Hit", "Evasion"];

export function termsTab(env) {
    const terms = env.db.System.terms;
    const col = (title, arr, labels) =>
        fieldset(title, h("div", { class: "col", style: { gap: "3px" } }, ...labels.map((label, i) => (label === null ? null : labeled(label, bindText(arr, i, { width: 160 }), 100)))));
    const messages = Object.keys(terms.messages).map(key => labeled(key, bindText(terms.messages, key, { width: 330 }), 140));
    return h(
        "div",
        { class: "row", style: { alignItems: "stretch", height: "100%", minHeight: "0" } },
        scrollCol(col("Basic Status", terms.basic, BASIC_LABELS), col("Parameters", terms.params, PARAM_LABELS)),
        scrollCol(col("Commands", terms.commands, COMMAND_LABELS)),
        h("div", { class: "col", style: { flex: "2", overflow: "auto", minHeight: "0" } }, fieldset("Messages", h("div", { class: "col", style: { gap: "3px" } }, ...messages)))
    );
}

export { clear, numberInput, typeOptions };
