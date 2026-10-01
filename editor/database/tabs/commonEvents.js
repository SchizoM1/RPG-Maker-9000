// Common Events tab
import { h } from "../../ui/dom.js";
import { fieldset, field, pickerButton } from "../../ui/widgets.js";
import { listTab } from "../databaseDialog.js";
import { bindText, bindSelect } from "../dbFields.js";
import { CommandList, commandListStyles } from "../../events/commandList.js";
import { switchVariablePicker, switchVariableLabel } from "../../ui/pickers.js";

export function commonEventsTab(env) {
    return listTab(env, "CommonEvents", (ce, ui) => {
        const swBtn = pickerButton(switchVariableLabel(env.store, "switch", ce.switchId), async () => {
            const r = await switchVariablePicker(env.store, "switch", ce.switchId);
            if (r) {
                ce.switchId = r;
                swBtn.setText(switchVariableLabel(env.store, "switch", r));
            }
        });
        const sync = () => (swBtn.disabled = ce.trigger === 0);
        setTimeout(sync, 0);
        const list = new CommandList({ store: env.store, map: null }, ce.list);
        list.el.style.minHeight = "460px";
        return h(
            "div",
            { class: "col", style: { height: "100%" } },
            commandListStyles(),
            fieldset("General Settings", h("div", { class: "row" }, field("Name", bindText(ce, "name", { onChange: ui.updateName, width: 260 })), field("Trigger", bindSelect(ce, "trigger", [[0, "None"], [1, "Autorun"], [2, "Parallel"]], { onChange: sync })), field("Switch", swBtn))),
            h("div", { class: "panel-header" }, "Contents"),
            list.el
        );
    }, { title: "Common Events" });
}
