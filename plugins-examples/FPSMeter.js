//=============================================================================
// FPSMeter.js — RPG Maker 9000 example plugin
//=============================================================================
/*:
 * @target RPG9K MZ
 * @plugindesc Shows a small frames-per-second meter in a screen corner.
 * @author RPG Maker 9000
 *
 * @help
 * Shows the game's frame rate. F2 still toggles it at any time.
 *
 * This example shows:
 *   - reading parameters with PluginManager.parameters()
 *   - boolean / select / number parameter types
 *   - a plugin command with arguments (registerCommand)
 *
 * @param showOnStart
 * @text Show on Start
 * @type boolean
 * @on Show
 * @off Hide
 * @default true
 * @desc Whether the meter is visible when the game starts.
 *
 * @param corner
 * @text Corner
 * @type select
 * @option Top Left
 * @value topLeft
 * @option Top Right
 * @value topRight
 * @option Bottom Left
 * @value bottomLeft
 * @option Bottom Right
 * @value bottomRight
 * @default topLeft
 *
 * @param fontSize
 * @text Font Size
 * @type number
 * @min 8
 * @max 48
 * @default 14
 *
 * @command setVisible
 * @text Show/Hide Meter
 * @desc Shows or hides the FPS meter.
 *
 * @arg visible
 * @text Visible
 * @type boolean
 * @on Show
 * @off Hide
 * @default true
 */

(() => {
    "use strict";
    const pluginName = "FPSMeter";
    const params = PluginManager.parameters(pluginName);
    const showOnStart = params.showOnStart !== "false";
    const corner = params.corner || "topLeft";
    const fontSize = Number(params.fontSize || 14);

    const styleMeter = () => {
        const el = document.getElementById("fpsCounter");
        if (!el) return;
        Object.assign(el.style, {
            top: corner.startsWith("top") ? "4px" : "auto",
            bottom: corner.startsWith("bottom") ? "4px" : "auto",
            left: corner.endsWith("Left") ? "4px" : "auto",
            right: corner.endsWith("Right") ? "4px" : "auto",
            fontSize: fontSize + "px"
        });
    };

    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function() {
        _Scene_Boot_start.call(this);
        styleMeter();
        if (showOnStart) Graphics.showFps();
    };

    PluginManager.registerCommand(pluginName, "setVisible", args => {
        if (args.visible === "false") Graphics.hideFps();
        else Graphics.showFps();
    });
})();
