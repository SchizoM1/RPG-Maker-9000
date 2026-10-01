// Actors tab
import { h } from "../../ui/dom.js";
import { fieldset, field } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindNum, bindSelect, bindFace, bindCharacter, bindImage, dbOptions, labeled } from "../dbFields.js";
import { TraitsEditor } from "../traits.js";

export function actorsTab(env) {
    const db = env.db;
    return listTab(env, "Actors", (actor, ui) => {
        const sys = db.System;
        // Initial equipment: one row per equip slot.
        const equipRows = sys.equipTypes.slice(1).map((typeName, i) => {
            const etypeId = i + 1;
            while (actor.equips.length <= i) actor.equips.push(0);
            const items = etypeId === 1 ? db.Weapons : db.Armors;
            const options = [[0, "None"], ...dbOptions(items).filter(([id]) => items[id] && items[id].etypeId === etypeId)];
            return labeled(typeName, bindSelect(actor.equips, i, options, { width: 240 }), 90);
        });
        return h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "grid-2" },
                    field("Name", bindText(actor, "name", { onChange: ui.updateName })),
                    field("Nickname", bindText(actor, "nickname")),
                    field("Class", bindSelect(actor, "classId", dbOptions(db.Classes))),
                    h("div", { class: "row" }, field("Initial Level", bindNum(actor, "initialLevel", { min: 1, max: 99 })), field("Max Level", bindNum(actor, "maxLevel", { min: 1, max: 99 }))),
                    h("div", { style: { gridColumn: "1 / span 2" } }, field("Profile", bindArea(actor, "profile", { rows: 2 })))
                )
            ),
            h(
                "div",
                { class: "row", style: { alignItems: "stretch" } },
                fieldset("Images", h("div", { class: "row" }, field("Face", bindFace(actor, "faceName", "faceIndex")), field("Character", bindCharacter(actor, "characterName", "characterIndex", env.store)), field("[SV] Battler", bindImage(actor, "battlerName", "sv_actors", { width: 150 })))),
                fieldset("Initial Equipment", h("div", { class: "col", style: { gap: "3px" } }, ...equipRows))
            ),
            new TraitsEditor(db, actor).el,
            field("Note", bindArea(actor, "note", { rows: 3 }))
        );
    });
}
