# Project and data format

RPG Maker 9000 projects use the **RPG Maker MZ data format**. The JSON file
names, field names, event command codes, tile IDs and folder layout are all the
same, so MZ references and tools also apply here.

## Project folder

```
MyGame/
  game.rpg9kproject     {"format":"rpg9k","version":1,"title":"My Game"}
  index.html            game page (the title is set from System.json)
  css/game.css
  js/
    rpg9k_*.js          engine (refreshed from the editor when a project opens)
    main.js             boot script
    plugins.js          plugin list written by the Plugin Manager
    plugins/*.js        plugin files
    libs/               optional libraries (e.g. effekseer.min.js)
  data/                 database and maps (below)
  img/                  animations battlebacks1 battlebacks2 characters enemies faces
                        parallaxes pictures sv_actors sv_enemies system tilesets titles1 titles2
  audio/                bgm bgs me se          (.ogg; .m4a also accepted)
  fonts/  effects/  movies/  icon/
  save/                 playtest save files (*.rpgsave), not exported
```

Asset references in data leave out the folder and extension: an actor's
`faceName: "Actor1"` means `img/faces/Actor1.png`, and `{"name":"Battle1"}` in
a BGM slot means `audio/bgm/Battle1.ogg`.

The engine scripts in `js/` are refreshed from the editor each time the project
opens. Changes made to them by hand are lost, so put engine changes in a plugin.

## data/

| File | Contents |
|---|---|
| `Actors.json` `Classes.json` `Skills.json` `Items.json` `Weapons.json` `Armors.json` `Enemies.json` `Troops.json` `States.json` `Animations.json` `Tilesets.json` `CommonEvents.json` | Arrays where index 0 is `null` and entry *n* has `id: n`. |
| `System.json` | Game title, starting party and position, terms, types, switch and variable names, sounds, options, `advanced` (screen size, fonts, gameId). |
| `MapInfos.json` | Map tree: `[null, {id, name, parentId, order, expanded, scrollX, scrollY}, …]`. Missing IDs are `null`. |
| `MapNNN.json` | One map, zero-padded to 3 digits (`Map001.json`). |

Any object with a `note` field gets a `meta` object at load time, built from
`<key>` and `<key:value>` tags in the note.

## Maps

```js
{
  "tilesetId": 1, "width": 17, "height": 13, "scrollType": 0,   // 0 none, 1 loop V, 2 loop H, 3 both
  "displayName": "", "note": "",
  "autoplayBgm": false, "bgm": {name, volume, pitch, pan}, "autoplayBgs": false, "bgs": {…},
  "battleback1Name": "", "battleback2Name": "", "specifyBattleback": false,
  "encounterList": [{troopId, weight, regionSet: []}], "encounterStep": 30,
  "parallaxName": "", "parallaxLoopX": false, "parallaxLoopY": false,
  "parallaxSx": 0, "parallaxSy": 0, "parallaxShow": true, "disableDashing": false,
  "data": [ … width * height * 6 numbers … ],
  "events": [null, {id, name, note, x, y, pages: [ … ]}, …]
}
```

### Tile data layout

`data` holds six layers of `width × height` values:

```
index = (z * height + y) * width + x
z = 0..3   tile layers (0–1 for A tiles, 2–3 for B–E tiles)
z = 4      shadow bits (bit 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right)
z = 5      region ID (0–255)
```

### Tile IDs

| Range | Sheet | Notes |
|---|---|---|
| 0–255 | B | `0` is an empty tile |
| 256–511 | C | |
| 512–767 | D | |
| 768–1023 | E | |
| 1536–1663 | A5 | normal tiles |
| 2048–2815 | A1 | animated autotiles (water, waterfalls) |
| 2816–4351 | A2 | ground autotiles |
| 4352–5887 | A3 | building roofs / walls |
| 5888–8191 | A4 | wall tops / walls |

Each autotile *kind* takes 48 IDs: `id = base + kind * 48 + shape`. Floor
autotiles use shapes 0–46, walls use 0–15 and waterfalls use 0–3. `TileUtils`
in `rpg9k_tilemap.js` holds the shape tables, and both the editor and the game
use it.

### Tileset flags

`Tilesets.json` → `flags[tileId]` is a bit field:

| Bit | Meaning |
|---|---|
| 0x0001–0x0008 | impassable down / left / right / up |
| 0x0010 | ☆ draw above characters |
| 0x0020 | ladder |
| 0x0040 | bush |
| 0x0080 | counter |
| 0x0100 | damage floor |
| 0x0200 / 0x0400 | impassable by boat / ship |
| 0x0800 | airship can't land |
| 0xF000 | terrain tag (`flags >> 12`) |

## Events

Each event page has `conditions`, `image`, `moveType`, `moveSpeed`,
`moveFrequency`, `moveRoute`, `walkAnime`, `stepAnime`, `directionFix`,
`through`, `priorityType` (0 below, 1 same, 2 above), `trigger` (0 action
button, 1 player touch, 2 event touch, 3 autorun, 4 parallel) and `list`, the
command list. Command codes are listed in [event-commands.md](event-commands.md).

## Plugins (js/plugins.js)

```js
var $plugins = [
  {"name": "FPSMeter", "status": true, "description": "…", "parameters": {"showOnStart": "true"}}
];
```

Parameter values are always strings. Arrays and structs are JSON strings. See
[plugin-api.md](plugin-api.md).

## Save files

Saves are JSON made with `JsonEx`, which keeps class instances through
`@`-tagged prototypes as in MZ. The stored text is either `"Z" + base64(gzip(json))`
or, in browsers without `CompressionStream`, `"J" + json`.

| Where the game runs | Storage |
|---|---|
| Editor playtest | `save/<name>.rpgsave` in the project folder |
| Browser (exported) | IndexedDB database `rpg9k`, store `saves`, falling back to localStorage |

Save names are `global`, `config` and `file1`, `file2`, …. In the browser,
keys are prefixed with `RPG9K <gameId> ` so several games on one site keep
separate saves.

## Exported games

**File › Deployment…** writes a plain folder that any static web host can serve,
optionally zipped. It has these options:

* **Exclude unused files** keeps only the assets referenced by the database,
  maps, event commands, enabled plugins' file parameters and
  `@requiredAssets` tags.
* **Bundle data** writes `js/data.js`, which defines `window.$rpg9kBundledData`
  (every `data/*.json` file, keyed by file name). `index.html` loads it, so the
  game also runs when opened straight from disk (`file://`), where `fetch` is
  blocked.
