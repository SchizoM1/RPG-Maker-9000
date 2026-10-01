//=============================================================================
// SimpleLightFog.js — RPG Maker 9000 example plugin
//=============================================================================
/*:
 * @target RPG9K MZ
 * @plugindesc Darkens maps with a light around the player, plus an optional scrolling fog.
 * @author RPG Maker 9000
 *
 * @help
 * Map note tags (Map Properties > Note):
 *   <darkness:180>      darkness for this map (0 = none, 255 = black)
 *   <lightRadius:160>   light radius in pixels
 *   <fog:Fog1>          scrolling fog image from img/parallaxes
 *
 * Plugin commands change these during play. Changes made by commands are
 * stored in the save file and last until "Reset to Map Settings".
 *
 * This example shows:
 *   - adding a sprite to Spriteset_Map
 *   - drawing straight onto bitmap.context, then calling bitmap.update()
 *   - map note tags ($dataMap.meta)
 *   - keeping plugin state in $gameSystem so it is saved
 *   - number, string, file and struct parameters
 *
 * @param defaultDarkness
 * @text Default Darkness
 * @type number
 * @min 0
 * @max 255
 * @default 0
 * @desc Darkness on maps without a <darkness> note tag.
 *
 * @param defaultRadius
 * @text Default Light Radius
 * @type number
 * @min 16
 * @max 1000
 * @default 160
 *
 * @param darkColor
 * @text Darkness Color
 * @type string
 * @default 0,0,16
 * @desc Red, green, blue of the darkness, 0-255 each.
 *
 * @param fog
 * @text Fog
 * @type struct<Fog>
 * @default {"image":"","opacity":"96","scrollX":"0.5","scrollY":"0.2"}
 *
 * @command setDarkness
 * @text Set Darkness
 * @desc Changes the darkness and light radius on the current map.
 *
 * @arg darkness
 * @text Darkness
 * @type number
 * @min 0
 * @max 255
 * @default 180
 *
 * @arg radius
 * @text Light Radius
 * @type number
 * @min 16
 * @max 1000
 * @default 160
 *
 * @command reset
 * @text Reset to Map Settings
 * @desc Goes back to the map's note tags / plugin defaults.
 */

/*~struct~Fog:
 * @param image
 * @text Image
 * @type file
 * @dir img/parallaxes/
 * @default
 * @desc Fog image used on maps without a <fog> note tag. Leave empty for none.
 *
 * @param opacity
 * @text Opacity
 * @type number
 * @min 0
 * @max 255
 * @default 96
 *
 * @param scrollX
 * @text Scroll X
 * @type number
 * @decimals 2
 * @min -10
 * @max 10
 * @default 0.5
 *
 * @param scrollY
 * @text Scroll Y
 * @type number
 * @decimals 2
 * @min -10
 * @max 10
 * @default 0.2
 */

(() => {
    "use strict";
    const pluginName = "SimpleLightFog";
    const params = PluginManager.parameters(pluginName);
    const defaultDarkness = Number(params.defaultDarkness || 0);
    const defaultRadius = Number(params.defaultRadius || 160);
    const darkColor = (params.darkColor || "0,0,16").split(",").map(n => Number(n) || 0);
    let fog = {};
    try {
        fog = JSON.parse(params.fog || "{}");
    } catch (e) {
        fog = {};
    }
    const fogOpacity = Number(fog.opacity || 96);
    const fogScrollX = Number(fog.scrollX || 0);
    const fogScrollY = Number(fog.scrollY || 0);

    // Current settings: a command override (saved) or the map's settings.
    const settings = () => {
        const meta = ($dataMap && $dataMap.meta) || {};
        const override = $gameSystem._lightFog;
        return {
            darkness: override ? override.darkness : meta.darkness !== undefined ? Number(meta.darkness) : defaultDarkness,
            radius: override ? override.radius : meta.lightRadius !== undefined ? Number(meta.lightRadius) : defaultRadius,
            fog: meta.fog !== undefined ? String(meta.fog).trim() : fog.image || ""
        };
    };

    PluginManager.registerCommand(pluginName, "setDarkness", args => {
        $gameSystem._lightFog = { darkness: Number(args.darkness), radius: Number(args.radius) };
    });

    PluginManager.registerCommand(pluginName, "reset", () => {
        $gameSystem._lightFog = null;
    });

    //-------------------------------------------------------------------------
    // Sprite_LightFog: fog layer + darkness layer with a hole at the player.

    class Sprite_LightFog extends Sprite {
        initialize() {
            super.initialize();
            this._fogName = "";
            this._fog = new TilingSprite();
            this._fog.move(0, 0, Graphics.width, Graphics.height);
            this._fog.opacity = fogOpacity;
            this.addChild(this._fog);
            this._dark = new Sprite(new Bitmap(Graphics.width, Graphics.height));
            this.addChild(this._dark);
            this._lastKey = "";
        }

        update() {
            super.update();
            const s = settings();
            this.updateFog(s);
            this.updateDarkness(s);
        }

        updateFog(s) {
            if (s.fog !== this._fogName) {
                this._fogName = s.fog;
                this._fog.bitmap = s.fog ? ImageManager.loadParallax(s.fog) : null;
            }
            this._fog.visible = !!s.fog;
            if (s.fog) {
                const tw = $gameMap.tileWidth(), th = $gameMap.tileHeight();
                this._fogX = (this._fogX || 0) + fogScrollX;
                this._fogY = (this._fogY || 0) + fogScrollY;
                this._fog.origin.x = $gameMap.displayX() * tw + this._fogX;
                this._fog.origin.y = $gameMap.displayY() * th + this._fogY;
            }
        }

        updateDarkness(s) {
            this._dark.visible = s.darkness > 0;
            if (!this._dark.visible) return;
            const x = $gamePlayer.screenX();
            const y = $gamePlayer.screenY() - $gameMap.tileHeight() / 2;
            const key = [x, y, s.darkness, s.radius].join();
            if (key === this._lastKey) return;
            this._lastKey = key;
            const bitmap = this._dark.bitmap;
            const ctx = bitmap.context;
            const [r, g, b] = darkColor;
            ctx.save();
            ctx.globalCompositeOperation = "copy";
            ctx.fillStyle = `rgba(${r},${g},${b},${s.darkness / 255})`;
            ctx.fillRect(0, 0, bitmap.width, bitmap.height);
            ctx.globalCompositeOperation = "destination-out";
            const grad = ctx.createRadialGradient(x, y, s.radius * 0.25, x, y, s.radius);
            grad.addColorStop(0, "rgba(0,0,0,1)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(x - s.radius, y - s.radius, s.radius * 2, s.radius * 2);
            ctx.restore();
            bitmap.update();
        }
    }
    window.Sprite_LightFog = Sprite_LightFog;

    // Above the map and characters, below pictures and the timer.
    const _createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _createLowerLayer.call(this);
        this._lightFog = new Sprite_LightFog();
        this.addChild(this._lightFog);
    };
})();
