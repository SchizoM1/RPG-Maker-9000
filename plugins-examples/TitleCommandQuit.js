//=============================================================================
// TitleCommandQuit.js — RPG Maker 9000 example plugin
//=============================================================================
/*:
 * @target RPG9K MZ
 * @plugindesc Adds a "Quit" command to the title screen.
 * @author RPG Maker 9000
 *
 * @help
 * Adds a command to the title menu that closes the game.
 * In a browser tab the page can't always close itself, so the screen just
 * fades to black.
 *
 * This example shows the usual way to extend a class: keep the old method
 * in a variable, replace it, and call the old one from inside.
 *
 * @param commandName
 * @text Command Name
 * @type string
 * @default Quit
 */

(() => {
    "use strict";
    const params = PluginManager.parameters("TitleCommandQuit");
    const commandName = params.commandName || "Quit";

    const _makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function() {
        _makeCommandList.call(this);
        this.addCommand(commandName, "quit");
    };

    const _createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _createCommandWindow.call(this);
        this._commandWindow.setHandler("quit", this.commandQuit.bind(this));
    };

    // Make the window one row taller for the extra command.
    const _commandWindowRect = Scene_Title.prototype.commandWindowRect;
    Scene_Title.prototype.commandWindowRect = function() {
        const rect = _commandWindowRect.call(this);
        const extra = this.calcWindowHeight(4, true) - this.calcWindowHeight(3, true);
        rect.y -= extra;
        rect.height += extra;
        return rect;
    };

    Scene_Title.prototype.commandQuit = function() {
        this._commandWindow.close();
        this.fadeOutAll();
        SceneManager.exit();
    };
})();
