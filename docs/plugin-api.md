# Writing plugins for RPG Maker 9000

A plugin is a JavaScript file in your project's `js/plugins/` folder. The
Plugin Manager (**Tools › Plugin Manager**, F10) lists every `.js` file in that
folder. Enabled plugins are loaded in list order, after the engine and before
the game starts.

The plugin API matches RPG Maker MZ. Many MZ plugins work unchanged, as long
as they don't depend on PIXI or WebGL. Three working examples are in
`plugins-examples/`, and new projects get copies in `js/plugins/`:

| File | Shows |
|---|---|
| `FPSMeter.js` | parameters (boolean / select / number), a plugin command |
| `TitleCommandQuit.js` | aliasing methods to add a title command |
| `SimpleLightFog.js` | a custom sprite, drawing on a bitmap, note tags, saved state, struct parameters |

---

## 1. The basic shape

```js
/*:
 * @target RPG9K MZ
 * @plugindesc One-line description shown in the Plugin Manager.
 * @author You
 *
 * @help
 * Longer help text shown when the plugin is selected.
 *
 * @param speed
 * @text Walk Speed
 * @type number
 * @min 1
 * @max 6
 * @default 4
 */

(() => {
    "use strict";
    const params = PluginManager.parameters("MyPlugin"); // the file name, no .js
    const speed = Number(params.speed || 4);

    const _Game_Player_realMoveSpeed = Game_Player.prototype.realMoveSpeed;
    Game_Player.prototype.realMoveSpeed = function() {
        return _Game_Player_realMoveSpeed.call(this) + (speed - 4);
    };
})();
```

Wrap the plugin in an IIFE `(() => { ... })()` so its variables don't leak into
other plugins.

## 2. Extending engine classes (aliasing)

Every engine class is a global variable (`var Scene_Map = class ...`). Internal
code always calls methods through these globals, so changing a prototype
changes the game's behaviour everywhere.

Usually you keep the old method, replace it, and call the old one:

```js
const _Scene_Map_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    if (Input.isTriggered("pageup")) SceneManager.push(Scene_Status);
};
```

* **Use `.call(this, ...args)`** so the original method runs on the same object.
* **Constructors.** Engine classes call `this.initialize(...args)` from their
  constructor, as MZ does, so alias `initialize` rather than `constructor`:

  ```js
  const _Game_Actor_initialize = Game_Actor.prototype.initialize;
  Game_Actor.prototype.initialize = function(actorId) {
      _Game_Actor_initialize.call(this, actorId);
      this._myCounter = 0;
  };
  ```
* **New classes** can use `class X extends Window_Base { initialize(rect) { super.initialize(rect); ... } }`.
  If other plugins need to see the class, assign it to `window.X`.
* **Static objects** such as `DataManager`, `SceneManager` and `BattleManager`
  are plain objects. Alias their methods the same way, without `.prototype`.

## 3. Header reference

The header is a `/*: ... */` comment block. Put translations in `/*:ja ... */`
or `/*:fr ... */` blocks. The editor uses the block with no language suffix
first.

### Plugin tags

| Tag | Meaning |
|---|---|
| `@target` | `RPG9K` and/or `MZ`. Informational. |
| `@plugindesc` | One-line description. |
| `@author`, `@url` | Shown in the Plugin Manager. |
| `@help` | Help text. Every line up to the next tag is included. |
| `@base Name` | This plugin needs plugin `Name`. The editor warns if it is missing or off. |
| `@orderAfter Name` / `@orderBefore Name` | The editor warns if the list order is wrong. |
| `@requiredAssets path` | An asset (e.g. `img/pictures/Light`) to keep in a deploy that excludes unused files. |

### Parameters

```
@param name          internal key (used in PluginManager.parameters())
@text  Label         display name
@desc  Text          description shown under the table
@type  type          see below (default: string)
@default value
@parent otherParam   indent under another parameter (cosmetic)
```

| `@type` | Value stored | Extra tags |
|---|---|---|
| `string`, `multiline_string` | the text | |
| `note` | JSON-encoded text (`JSON.parse` it) | |
| `number` | `"12"` | `@min`, `@max`, `@decimals` |
| `boolean` | `"true"` / `"false"` | `@on`, `@off` |
| `select` | the chosen `@value` | `@option Label` + `@value v` pairs |
| `combo` | free text with suggestions | `@option` |
| `file` | a file name without extension | `@dir img/pictures/`, `@require 1` |
| `switch`, `variable` | ID | |
| `actor` `class` `skill` `item` `weapon` `armor` `enemy` `troop` `state` `animation` `tileset` `common_event` | database ID (`"0"` = none) | |
| `icon` | icon index | |
| `color` | text color index 0–31 | |
| `location` | JSON `{"mapId":"1","x":"0","y":"0"}` | |
| `struct<Name>` | JSON object of strings | defined by a `/*~struct~Name: ... */` block |
| `anyType[]` | JSON array of strings | |

**All values are strings.** Arrays and structs are JSON strings that contain
strings, so convert them yourself:

```js
const params = PluginManager.parameters("MyPlugin");
const count = Number(params.count);
const enabled = params.enabled === "true";
const points = JSON.parse(params.points || "[]").map(s => JSON.parse(s)); // struct<Point>[]
```

A struct definition looks like this:

```js
/*~struct~Point:
 * @param x
 * @type number
 * @default 0
 *
 * @param y
 * @type number
 * @default 0
 */
```

## 4. Plugin commands

Declare commands in the header so the **Plugin Command** event command (code
357) can show a form for them:

```
@command shake
@text Shake Screen
@desc Shakes the screen.

@arg power
@text Power
@type number
@default 5
```

Then register a function for the command. `this` is the running
`Game_Interpreter`, and `args` holds the arguments as strings:

```js
PluginManager.registerCommand("MyPlugin", "shake", function(args) {
    $gameScreen.startShake(Number(args.power), 5, 30);
});
```

To make the event wait (for example until an animation finishes), set
`this.setWaitMode(...)` or `this.wait(frames)` inside the command.

## 5. Useful globals

**Data (read-only database):** `$dataActors`, `$dataClasses`, `$dataSkills`,
`$dataItems`, `$dataWeapons`, `$dataArmors`, `$dataEnemies`, `$dataTroops`,
`$dataStates`, `$dataAnimations`, `$dataTilesets`, `$dataCommonEvents`,
`$dataSystem`, `$dataMapInfos`, `$dataMap`. Database objects and the current
map have a `meta` object built from `<tag:value>` note tags.

**Game state (saved in the save file):** `$gameTemp` (not saved),
`$gameSystem`, `$gameScreen`, `$gameTimer`, `$gameMessage`, `$gameSwitches`,
`$gameVariables`, `$gameSelfSwitches`, `$gameActors`, `$gameParty`,
`$gameTroop`, `$gameMap`, `$gamePlayer`.

Store your plugin's own saved state on one of these objects (e.g.
`$gameSystem._myPlugin = {...}`). They are serialised with `JsonEx`, which keeps
class instances.

**Engine classes by file:**

| File | Classes |
|---|---|
| `rpg9k_core.js` | `Utils`, `Graphics`, `Input`, `TouchInput`, `Bitmap`, `Sprite`, `Container`, `Stage`, `TilingSprite`, `ScreenSprite`, `Point`, `Rectangle`, `JsonEx` |
| `rpg9k_tilemap.js` | `Tilemap`, `TileUtils`, `Weather` |
| `rpg9k_window.js` | `Window`, `WindowLayer` |
| `rpg9k_audio.js` | `WebAudio`, `Video` |
| `rpg9k_managers.js` | `DataManager`, `ConfigManager`, `StorageManager`, `FontManager`, `ImageManager`, `EffectManager`, `AudioManager`, `SoundManager`, `TextManager`, `ColorManager`, `SceneManager`, `PluginManager` |
| `rpg9k_battlers.js` | `Game_Action`, `Game_ActionResult`, `Game_BattlerBase`, `Game_Battler`, `Game_Actor`, `Game_Enemy`, `Game_Actors`, `Game_Unit`, `Game_Party`, `Game_Troop`, `Game_Item` |
| `rpg9k_objects.js` | `Game_Temp`, `Game_System`, `Game_Timer`, `Game_Message`, `Game_Switches`, `Game_Variables`, `Game_SelfSwitches`, `Game_Screen`, `Game_Picture`, `Game_Map`, `Game_CommonEvent`, `Game_CharacterBase`, `Game_Character`, `Game_Player`, `Game_Follower`, `Game_Followers`, `Game_Vehicle`, `Game_Event` |
| `rpg9k_interpreter.js` | `Game_Interpreter` |
| `rpg9k_battle.js` | `BattleManager` |
| `rpg9k_sprites.js` | `Sprite_Character`, `Sprite_Actor`, `Sprite_Enemy`, `Sprite_Animation`, `Sprite_AnimationMV`, `Sprite_Damage`, `Sprite_Picture`, `Sprite_Balloon`, `Sprite_Button`, `Spriteset_Map`, `Spriteset_Battle`, … |
| `rpg9k_windows.js` | `Window_Base`, `Window_Selectable`, `Window_Command`, `Window_Message`, `Window_MenuCommand`, `Window_TitleCommand`, … (the full MZ set) |
| `rpg9k_scenes.js` | `Scene_Base`, `Scene_Boot`, `Scene_Title`, `Scene_Map`, `Scene_Menu`, `Scene_Battle`, … (the full MZ set) |

## 6. Differences from RPG Maker MZ

RPG Maker 9000 draws with the **Canvas 2D API** and does not include PIXI:

* `PIXI.*` does not exist, so plugins that create PIXI filters, graphics or
  meshes won't work. Use `Bitmap` drawing (`fillRect`, `drawText`, `blt`,
  `gradientFillRect`, or `bitmap.context` directly) instead.
* After drawing on `bitmap.context` directly, call `bitmap.update()`.
  `bitmap.baseTexture.update()` also works, for MZ compatibility.
* Sprites support `opacity`, `scale`, `rotation`, `anchor`, `blendMode`,
  `setColorTone()`, `setBlendColor()` and `setFrame()`. Custom shaders and
  `filters` are ignored.
* `Graphics.app` and `Graphics.renderer` are not available.
* MZ (Effekseer) animations render through `js/libs/effekseer.min.js` +
  `effekseer.wasm`, which new projects include, on an offscreen WebGL canvas.
  Browsers block loading WebAssembly from `file://`, so a game opened straight
  from disk shows a simple fallback burst instead. Sounds and flashes still
  play. MV-style frame animations always work.

## 7. Debugging

* Playtest (Ctrl+R) runs the game with `?test`. In the playtest window, **F8**
  opens the developer tools and **F9** opens the switch and variable debugger.
* If a plugin file fails to load, the engine shows its name on screen. An
  exception during the game stops it and prints the error on screen; a failed
  image or audio load shows a Retry button.
* `console.log` output appears in the playtest window's developer tools.
