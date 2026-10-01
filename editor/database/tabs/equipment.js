// Weapons and Armors tabs.
import { h } from "../../ui/dom.js";
import { fieldset, field } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindNum, bindSelect, bindIcon, dbOptions, typeOptions } from "../dbFields.js";
import { TraitsEditor, PARAMS } from "../traits.js";

function paramsSection(obj) {
    return fieldset("Parameter Changes", h("div", { class: "grid-4" }, ...PARAMS.map((name, i) => field(name, bindNum(obj.params, i, { min: -9999, max: 9999 })))));
}

export function weaponsTab(env) {
    const db = env.db;
    return listTab(env, "Weapons", (w, ui) =>
        h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, field("Name", bindText(w, "name", { onChange: ui.updateName, width: 260 })), field("Icon", bindIcon(w, "iconIndex"))),
                    field("Description", bindArea(w, "description", { rows: 2 })),
                    h(
                        "div",
                        { class: "grid-3" },
                        field("Weapon Type", bindSelect(w, "wtypeId", typeOptions(db.System.weaponTypes, { none: true }))),
                        field("Price", bindNum(w, "price", { min: 0, max: 9999999 })),
                        field("Animation", bindSelect(w, "animationId", [[0, "None"], ...dbOptions(db.Animations)]))
                    )
                )
            ),
            paramsSection(w),
            new TraitsEditor(db, w).el,
            field("Note", bindArea(w, "note", { rows: 3 }))
        )
    );
}

export function armorsTab(env) {
    const db = env.db;
    return listTab(env, "Armors", (a, ui) =>
        h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, field("Name", bindText(a, "name", { onChange: ui.updateName, width: 260 })), field("Icon", bindIcon(a, "iconIndex"))),
                    field("Description", bindArea(a, "description", { rows: 2 })),
                    h(
                        "div",
                        { class: "grid-3" },
                        field("Armor Type", bindSelect(a, "atypeId", typeOptions(db.System.armorTypes, { none: true }))),
                        field("Price", bindNum(a, "price", { min: 0, max: 9999999 })),
                        field("Equipment Type", bindSelect(a, "etypeId", typeOptions(db.System.equipTypes).filter(([id]) => id > 1)))
                    )
                )
            ),
            paramsSection(a),
            new TraitsEditor(db, a).el,
            field("Note", bindArea(a, "note", { rows: 3 }))
        )
    );
}
