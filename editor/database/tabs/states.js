// States tab
import { h } from "../../ui/dom.js";
import { fieldset, field } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindArea, bindNum, bindSelect, bindCheck, bindIcon, labeled } from "../dbFields.js";
import { TraitsEditor } from "../traits.js";

export function statesTab(env) {
    const db = env.db;
    return listTab(env, "States", (s, ui) =>
        h(
            "div",
            { class: "col" },
            fieldset(
                "General Settings",
                h(
                    "div",
                    { class: "grid-3" },
                    field("Name", bindText(s, "name", { onChange: ui.updateName })),
                    field("Icon", bindIcon(s, "iconIndex")),
                    field("Restriction", bindSelect(s, "restriction", [[0, "None"], [1, "Attack an enemy"], [2, "Attack anyone"], [3, "Attack an ally"], [4, "Cannot move"]])),
                    field("Priority", bindNum(s, "priority", { min: 0, max: 100 })),
                    field("[SV] Motion", bindSelect(s, "motion", [[0, "Normal"], [1, "Abnormal"], [2, "Sleep"], [3, "Dead"]])),
                    field("[SV] Overlay", bindSelect(s, "overlay", [[0, "None"], [1, "Poison"], [2, "Blind"], [3, "Silence"], [4, "Rage"], [5, "Confusion"], [6, "Fascination"], [7, "Sleep"], [8, "Paralyze"], [9, "Curse"], [10, "Fear"]]))
                )
            ),
            fieldset(
                "Removal Conditions",
                h(
                    "div",
                    { class: "col" },
                    h("div", { class: "row" }, bindCheck(s, "removeAtBattleEnd", "Remove at Battle End"), bindCheck(s, "removeByRestriction", "Remove by Restriction")),
                    h("div", { class: "row center" }, labeled("Auto-removal", bindSelect(s, "autoRemovalTiming", [[0, "None"], [1, "Action End"], [2, "Turn End"]]), 90), "Duration in Turns", bindNum(s, "minTurns", { min: 1, max: 9999, width: 70 }), "~", bindNum(s, "maxTurns", { min: 1, max: 9999, width: 70 })),
                    h("div", { class: "row center" }, bindCheck(s, "removeByDamage", "Remove by Damage"), bindNum(s, "chanceByDamage", { min: 0, max: 100, width: 60 }), "%"),
                    h("div", { class: "row center" }, bindCheck(s, "removeByWalking", "Remove by Walking"), bindNum(s, "stepsToRemove", { min: 0, max: 9999, width: 70 }), "steps")
                )
            ),
            fieldset(
                "Messages",
                h(
                    "div",
                    { class: "col" },
                    labeled("If an actor…", bindText(s, "message1", { width: 360 }), 150),
                    labeled("If an enemy…", bindText(s, "message2", { width: 360 }), 150),
                    labeled("If the state persists", bindText(s, "message3", { width: 360 }), 150),
                    labeled("If the state is removed", bindText(s, "message4", { width: 360 }), 150),
                    h("div", { class: "hint" }, "%1 is replaced with the battler's name.")
                )
            ),
            new TraitsEditor(db, s, "traits", { height: 130 }).el,
            field("Note", bindArea(s, "note", { rows: 2 }))
        )
    );
}
