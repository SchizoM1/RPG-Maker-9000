//=============================================================================
// rpg9k_managers.js — static managers (MZ-compatible API surface)
//=============================================================================
"use strict";

var $dataActors = null;
var $dataClasses = null;
var $dataSkills = null;
var $dataItems = null;
var $dataWeapons = null;
var $dataArmors = null;
var $dataEnemies = null;
var $dataTroops = null;
var $dataStates = null;
var $dataAnimations = null;
var $dataTilesets = null;
var $dataCommonEvents = null;
var $dataSystem = null;
var $dataMapInfos = null;
var $dataMap = null;
var $gameTemp = null;
var $gameSystem = null;
var $gameScreen = null;
var $gameTimer = null;
var $gameMessage = null;
var $gameSwitches = null;
var $gameVariables = null;
var $gameSelfSwitches = null;
var $gameActors = null;
var $gameParty = null;
var $gameTroop = null;
var $gameMap = null;
var $gamePlayer = null;
var $testEvent = null;

//-----------------------------------------------------------------------------
// DataManager

var DataManager = {
    _globalInfo: null,
    _errors: [],

    _databaseFiles: [
        { name: "$dataActors", src: "Actors.json" },
        { name: "$dataClasses", src: "Classes.json" },
        { name: "$dataSkills", src: "Skills.json" },
        { name: "$dataItems", src: "Items.json" },
        { name: "$dataWeapons", src: "Weapons.json" },
        { name: "$dataArmors", src: "Armors.json" },
        { name: "$dataEnemies", src: "Enemies.json" },
        { name: "$dataTroops", src: "Troops.json" },
        { name: "$dataStates", src: "States.json" },
        { name: "$dataAnimations", src: "Animations.json" },
        { name: "$dataTilesets", src: "Tilesets.json" },
        { name: "$dataCommonEvents", src: "CommonEvents.json" },
        { name: "$dataSystem", src: "System.json" },
        { name: "$dataMapInfos", src: "MapInfos.json" }
    ],

    loadGlobalInfo() {
        StorageManager.loadObject("global")
            .then(globalInfo => {
                this._globalInfo = globalInfo || [];
                this.removeInvalidGlobalInfo();
                return 0;
            })
            .catch(() => {
                this._globalInfo = [];
            });
    },

    removeInvalidGlobalInfo() {
        const globalInfo = this._globalInfo;
        for (const info of globalInfo) {
            const savefileId = globalInfo.indexOf(info);
            if (info && !this.savefileExists(savefileId)) delete globalInfo[savefileId];
        }
    },

    saveGlobalInfo() {
        StorageManager.saveObject("global", this._globalInfo);
    },

    isGlobalInfoLoaded() {
        return !!this._globalInfo;
    },

    loadDatabase() {
        // The editor saves the database before any test, so tests read the
        // regular files; an event test adds Test_Event.json.
        for (const databaseFile of this._databaseFiles) {
            this.loadDataFile(databaseFile.name, databaseFile.src);
        }
        if (this.isEventTest()) this.loadDataFile("$testEvent", "Test_Event.json");
    },

    loadDataFile(name, src, fallbackSrc) {
        window[name] = null;
        const bundled = window.$rpg9kBundledData;
        if (bundled) {
            const key = bundled[src] !== undefined ? src : fallbackSrc;
            if (bundled[key] !== undefined) {
                // Deep copy so reloading data doesn't reuse mutated objects.
                setTimeout(() => this.onXhrLoad({ status: 200, responseText: JSON.stringify(bundled[key]) }, name, src, "data/" + src), 0);
                return;
            }
        }
        const xhr = new XMLHttpRequest();
        const url = "data/" + src;
        xhr.open("GET", url);
        xhr.overrideMimeType("application/json");
        xhr.onload = () => {
            if (xhr.status >= 400 && fallbackSrc && fallbackSrc !== src) {
                this.loadDataFile(name, fallbackSrc);
                return;
            }
            this.onXhrLoad(xhr, name, src, url);
        };
        xhr.onerror = () => {
            if (fallbackSrc && fallbackSrc !== src) this.loadDataFile(name, fallbackSrc);
            else this.onXhrError(name, src, url);
        };
        xhr.send();
    },

    onXhrLoad(xhr, name, src, url) {
        if (xhr.status < 400) {
            window[name] = JSON.parse(xhr.responseText);
            this.onLoad(window[name]);
        } else {
            this.onXhrError(name, src, url);
        }
    },

    onXhrError(name, src, url) {
        const error = { name: name, src: src, url: url };
        this._errors.push(error);
    },

    isDatabaseLoaded() {
        this.checkError();
        for (const databaseFile of this._databaseFiles) {
            if (!window[databaseFile.name]) return false;
        }
        return true;
    },

    loadMapData(mapId) {
        if (mapId > 0) {
            const filename = "Map%1.json".format(mapId.padZero(3));
            this.loadDataFile("$dataMap", filename);
        } else {
            this.makeEmptyMap();
        }
    },

    makeEmptyMap() {
        $dataMap = {};
        $dataMap.data = [];
        $dataMap.events = [];
        $dataMap.width = 100;
        $dataMap.height = 100;
        $dataMap.scrollType = 3;
    },

    isMapLoaded() {
        this.checkError();
        return !!$dataMap;
    },

    onLoad(object) {
        if (this.isMapObject(object)) {
            this.extractMetadata(object);
            this.extractArrayMetadata(object.events);
        } else {
            this.extractArrayMetadata(object);
        }
    },

    isMapObject(object) {
        return !!(object && object.data && object.events);
    },

    extractArrayMetadata(array) {
        if (Array.isArray(array)) {
            for (const data of array) {
                if (data && "note" in data) this.extractMetadata(data);
            }
        }
    },

    extractMetadata(data) {
        const regExp = /<([^<>:]+)(:?)([^>]*)>/g;
        data.meta = {};
        for (;;) {
            const match = regExp.exec(data.note || "");
            if (match) {
                if (match[2] === ":") data.meta[match[1]] = match[3];
                else data.meta[match[1]] = true;
            } else {
                break;
            }
        }
    },

    checkError() {
        if (this._errors.length > 0) {
            const error = this._errors.shift();
            const retry = () => this.loadDataFile(error.name, error.src);
            throw ["LoadError", error.url, retry];
        }
    },

    isBattleTest() {
        return Utils.isOptionValid("btest");
    },

    isEventTest() {
        return Utils.isOptionValid("etest");
    },

    isTitleSkip() {
        return Utils.isOptionValid("tskip");
    },

    isSkill(item) {
        return item && $dataSkills.includes(item);
    },

    isItem(item) {
        return item && $dataItems.includes(item);
    },

    isWeapon(item) {
        return item && $dataWeapons.includes(item);
    },

    isArmor(item) {
        return item && $dataArmors.includes(item);
    },

    createGameObjects() {
        $gameTemp = new Game_Temp();
        $gameSystem = new Game_System();
        $gameScreen = new Game_Screen();
        $gameTimer = new Game_Timer();
        $gameMessage = new Game_Message();
        $gameSwitches = new Game_Switches();
        $gameVariables = new Game_Variables();
        $gameSelfSwitches = new Game_SelfSwitches();
        $gameActors = new Game_Actors();
        $gameParty = new Game_Party();
        $gameTroop = new Game_Troop();
        $gameMap = new Game_Map();
        $gamePlayer = new Game_Player();
    },

    setupNewGame() {
        this.createGameObjects();
        this.selectSavefileForNewGame();
        $gameParty.setupStartingMembers();
        $gamePlayer.setupForNewGame();
        Graphics.frameCount = 0;
    },

    setupBattleTest() {
        this.createGameObjects();
        $gameParty.setupBattleTest();
        BattleManager.setup($dataSystem.testTroopId, true, false);
        BattleManager.setBattleTest(true);
        BattleManager.playBattleBgm();
    },

    setupEventTest() {
        this.createGameObjects();
        this.selectSavefileForNewGame();
        $gameParty.setupStartingMembers();
        $gamePlayer.reserveTransfer(-1, 8, 6);
        $gamePlayer.setTransparent(false);
    },

    isAnySavefileExists() {
        return this._globalInfo.some(x => x);
    },

    latestSavefileId() {
        const globalInfo = this._globalInfo;
        const validInfo = globalInfo.slice(1).filter(x => x);
        const latest = Math.max(...validInfo.map(x => x.timestamp));
        const index = globalInfo.findIndex(x => x && x.timestamp === latest);
        return index > 0 ? index : 0;
    },

    earliestSavefileId() {
        const globalInfo = this._globalInfo;
        const validInfo = globalInfo.slice(1).filter(x => x);
        const earliest = Math.min(...validInfo.map(x => x.timestamp));
        const index = globalInfo.findIndex(x => x && x.timestamp === earliest);
        return index > 0 ? index : 0;
    },

    emptySavefileId() {
        const globalInfo = this._globalInfo;
        const maxSavefiles = this.maxSavefiles();
        if (globalInfo.length < maxSavefiles) {
            return Math.max(1, globalInfo.length);
        } else {
            const index = globalInfo.slice(1).findIndex(x => !x);
            return index >= 0 ? index + 1 : -1;
        }
    },

    loadAllSavefileImages() {
        for (const info of this._globalInfo.filter(x => x)) this.loadSavefileImages(info);
    },

    loadSavefileImages(info) {
        if (info.characters && Symbol.iterator in info.characters) {
            for (const character of info.characters) ImageManager.loadCharacter(character[0]);
        }
        if (info.faces && Symbol.iterator in info.faces) {
            for (const face of info.faces) ImageManager.loadFace(face[0]);
        }
    },

    maxSavefiles() {
        return 20;
    },

    savefileInfo(savefileId) {
        const globalInfo = this._globalInfo;
        return globalInfo[savefileId] ? globalInfo[savefileId] : null;
    },

    savefileExists(savefileId) {
        const saveName = this.makeSavename(savefileId);
        return StorageManager.exists(saveName);
    },

    saveGame(savefileId) {
        const contents = this.makeSaveContents();
        const saveName = this.makeSavename(savefileId);
        return StorageManager.saveObject(saveName, contents).then(() => {
            this._globalInfo[savefileId] = this.makeSavefileInfo();
            this.saveGlobalInfo();
            return 0;
        });
    },

    loadGame(savefileId) {
        const saveName = this.makeSavename(savefileId);
        return StorageManager.loadObject(saveName).then(contents => {
            this.createGameObjects();
            this.extractSaveContents(contents);
            this.correctDataErrors();
            return 0;
        });
    },

    makeSavename(savefileId) {
        return "file%1".format(savefileId);
    },

    selectSavefileForNewGame() {
        const emptySavefileId = this.emptySavefileId();
        const earliestSavefileId = this.earliestSavefileId();
        if (emptySavefileId > 0) $gameSystem.setSavefileId(emptySavefileId);
        else $gameSystem.setSavefileId(earliestSavefileId);
    },

    makeSavefileInfo() {
        const info = {};
        info.title = $dataSystem.gameTitle;
        info.characters = $gameParty.charactersForSavefile();
        info.faces = $gameParty.facesForSavefile();
        info.playtime = $gameSystem.playtimeText();
        info.timestamp = Date.now();
        return info;
    },

    makeSaveContents() {
        const contents = {};
        contents.system = $gameSystem;
        contents.screen = $gameScreen;
        contents.timer = $gameTimer;
        contents.switches = $gameSwitches;
        contents.variables = $gameVariables;
        contents.selfSwitches = $gameSelfSwitches;
        contents.actors = $gameActors;
        contents.party = $gameParty;
        contents.map = $gameMap;
        contents.player = $gamePlayer;
        return contents;
    },

    extractSaveContents(contents) {
        $gameSystem = contents.system;
        $gameScreen = contents.screen;
        $gameTimer = contents.timer;
        $gameSwitches = contents.switches;
        $gameVariables = contents.variables;
        $gameSelfSwitches = contents.selfSwitches;
        $gameActors = contents.actors;
        $gameParty = contents.party;
        $gameMap = contents.map;
        $gamePlayer = contents.player;
    },

    correctDataErrors() {
        $gameParty.removeInvalidMembers();
    }
};

//-----------------------------------------------------------------------------
// ConfigManager

var ConfigManager = {
    alwaysDash: false,
    commandRemember: false,
    touchUI: false,
    _isLoaded: false,

    get bgmVolume() {
        return AudioManager._bgmVolume;
    },
    set bgmVolume(value) {
        AudioManager.bgmVolume = value;
    },
    get bgsVolume() {
        return AudioManager.bgsVolume;
    },
    set bgsVolume(value) {
        AudioManager.bgsVolume = value;
    },
    get meVolume() {
        return AudioManager.meVolume;
    },
    set meVolume(value) {
        AudioManager.meVolume = value;
    },
    get seVolume() {
        return AudioManager.seVolume;
    },
    set seVolume(value) {
        AudioManager.seVolume = value;
    },

    load() {
        StorageManager.loadObject("config")
            .then(config => this.applyData(config || {}))
            .catch(() => 0)
            .then(() => {
                this._isLoaded = true;
                return 0;
            })
            .catch(() => 0);
    },

    save() {
        StorageManager.saveObject("config", this.makeData());
    },

    isLoaded() {
        return this._isLoaded;
    },

    makeData() {
        const config = {};
        config.alwaysDash = this.alwaysDash;
        config.commandRemember = this.commandRemember;
        config.touchUI = this.touchUI;
        config.bgmVolume = this.bgmVolume;
        config.bgsVolume = this.bgsVolume;
        config.meVolume = this.meVolume;
        config.seVolume = this.seVolume;
        return config;
    },

    applyData(config) {
        this.alwaysDash = this.readFlag(config, "alwaysDash", false);
        this.commandRemember = this.readFlag(config, "commandRemember", false);
        this.touchUI = this.readFlag(config, "touchUI", false);
        this.bgmVolume = this.readVolume(config, "bgmVolume");
        this.bgsVolume = this.readVolume(config, "bgsVolume");
        this.meVolume = this.readVolume(config, "meVolume");
        this.seVolume = this.readVolume(config, "seVolume");
    },

    readFlag(config, name, defaultValue) {
        if (name in config) return !!config[name];
        return defaultValue;
    },

    readVolume(config, name) {
        if (name in config) return Number(config[name]).clamp(0, 100);
        return 100;
    }
};

//-----------------------------------------------------------------------------
// StorageManager — saves to the playtest host (project save/ folder) when
// running inside the editor, otherwise to IndexedDB (localStorage fallback).

var StorageManager = {
    _keys: new Set(),
    _keysLoaded: false,
    _dbPromise: null,

    host() {
        return typeof window !== "undefined" ? window.rpg9kHost || null : null;
    },

    isLocalMode() {
        return !!this.host();
    },

    saveObject(saveName, object) {
        return this.objectToJson(object)
            .then(json => this.jsonToData(json))
            .then(data => this.saveData(saveName, data));
    },

    loadObject(saveName) {
        return this.loadData(saveName)
            .then(data => this.dataToJson(data))
            .then(json => this.jsonToObject(json));
    },

    objectToJson(object) {
        return new Promise((resolve, reject) => {
            try {
                resolve(JsonEx.stringify(object));
            } catch (e) {
                reject(e);
            }
        });
    },

    jsonToObject(json) {
        return new Promise((resolve, reject) => {
            try {
                resolve(JsonEx.parse(json));
            } catch (e) {
                reject(e);
            }
        });
    },

    // Saves are compressed with gzip + base64 when CompressionStream exists.
    jsonToData(json) {
        if (typeof CompressionStream === "undefined") return Promise.resolve("J" + json);
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
        return new Response(stream).arrayBuffer().then(buf => "Z" + this._toBase64(new Uint8Array(buf)));
    },

    dataToJson(data) {
        if (data === null || data === undefined) return Promise.resolve("null");
        if (data[0] === "J") return Promise.resolve(data.slice(1));
        if (data[0] === "Z") {
            const bytes = this._fromBase64(data.slice(1));
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
            return new Response(stream).text();
        }
        return Promise.resolve(data);
    },

    _toBase64(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    },

    _fromBase64(str) {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    },

    saveData(saveName, data) {
        this._keys.add(saveName);
        const host = this.host();
        if (host) return host.saveFile(saveName, data);
        return this._idbPut(saveName, data).catch(() => {
            localStorage.setItem(this.storageKey(saveName), data);
        });
    },

    loadData(saveName) {
        const host = this.host();
        if (host) return host.loadFile(saveName);
        return this._idbGet(saveName)
            .catch(() => undefined)
            .then(data => {
                if (data === undefined || data === null) {
                    const ls = localStorage.getItem(this.storageKey(saveName));
                    if (ls === null) throw new Error("Savefile not found: " + saveName);
                    return ls;
                }
                return data;
            });
    },

    exists(saveName) {
        return this._keys.has(saveName);
    },

    remove(saveName) {
        this._keys.delete(saveName);
        const host = this.host();
        if (host) return host.removeFile(saveName);
        localStorage.removeItem(this.storageKey(saveName));
        return this._idbDelete(saveName).catch(() => 0);
    },

    // Must be awaited once at boot so exists() can answer synchronously.
    updateKeys() {
        const host = this.host();
        const p = host ? host.listFiles() : this._idbKeys().catch(() => []);
        return p.then(keys => {
            this._keys = new Set(keys);
            try {
                const prefix = this.storageKey("");
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(prefix)) this._keys.add(k.slice(prefix.length));
                }
            } catch (e) {
                // localStorage unavailable
            }
            this._keysLoaded = true;
            return 0;
        });
    },

    storageKey(saveName) {
        const id = $dataSystem && $dataSystem.advanced ? $dataSystem.advanced.gameId : 0;
        return "RPG9K " + id + " " + saveName;
    },

    _openDb() {
        if (!this._dbPromise) {
            this._dbPromise = new Promise((resolve, reject) => {
                if (!Utils.canUseIndexedDB()) return reject(new Error("No IndexedDB"));
                const req = indexedDB.open("rpg9k", 1);
                req.onupgradeneeded = () => req.result.createObjectStore("saves");
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        return this._dbPromise;
    },

    _idb(mode, fn) {
        return this._openDb().then(
            db =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction("saves", mode);
                    const req = fn(tx.objectStore("saves"));
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                })
        );
    },

    _idbPut(saveName, data) {
        return this._idb("readwrite", s => s.put(data, this.storageKey(saveName)));
    },
    _idbGet(saveName) {
        return this._idb("readonly", s => s.get(this.storageKey(saveName)));
    },
    _idbDelete(saveName) {
        return this._idb("readwrite", s => s.delete(this.storageKey(saveName)));
    },
    _idbKeys() {
        const prefix = this.storageKey("");
        return this._idb("readonly", s => s.getAllKeys()).then(keys =>
            keys.filter(k => String(k).startsWith(prefix)).map(k => String(k).slice(prefix.length))
        );
    }
};

//-----------------------------------------------------------------------------
// FontManager

var FontManager = {
    _urls: {},
    _states: {},

    load(family, filename) {
        if (this._states[family] !== "loaded") {
            if (filename) {
                const url = this.makeUrl(filename);
                this.startLoading(family, url);
            } else {
                this._urls[family] = "";
                this._states[family] = "loaded";
            }
        }
    },

    isReady() {
        for (const family in this._states) {
            const state = this._states[family];
            if (state === "loading") return false;
            if (state === "error") this.throwLoadError(family);
        }
        return true;
    },

    startLoading(family, url) {
        if (typeof FontFace === "undefined") {
            this._states[family] = "loaded";
            return;
        }
        const source = "url(" + url + ")";
        const font = new FontFace(family, source);
        this._urls[family] = url;
        this._states[family] = "loading";
        font.load()
            .then(() => {
                document.fonts.add(font);
                this._states[family] = "loaded";
                return 0;
            })
            .catch(() => {
                // A missing font is not fatal; the fallback font list is used.
                this._states[family] = "loaded";
            });
    },

    throwLoadError(family) {
        const url = this._urls[family];
        const retry = () => this.startLoading(family, url);
        throw ["LoadError", url, retry];
    },

    makeUrl(filename) {
        return "fonts/" + Utils.encodeURI(filename);
    }
};

//-----------------------------------------------------------------------------
// ImageManager

var ImageManager = {
    standardIconWidth: 32,
    standardIconHeight: 32,
    standardFaceWidth: 144,
    standardFaceHeight: 144,
    _cache: {},
    _system: {},
    _emptyBitmap: null,

    get iconWidth() {
        return ($dataSystem && $dataSystem.iconSize) || this.standardIconWidth;
    },
    get iconHeight() {
        return ($dataSystem && $dataSystem.iconSize) || this.standardIconHeight;
    },
    get faceWidth() {
        return ($dataSystem && $dataSystem.faceSize) || this.standardFaceWidth;
    },
    get faceHeight() {
        return ($dataSystem && $dataSystem.faceSize) || this.standardFaceHeight;
    },

    loadAnimation(filename) {
        return this.loadBitmap("img/animations/", filename);
    },
    loadBattleback1(filename) {
        return this.loadBitmap("img/battlebacks1/", filename);
    },
    loadBattleback2(filename) {
        return this.loadBitmap("img/battlebacks2/", filename);
    },
    loadEnemy(filename) {
        return this.loadBitmap("img/enemies/", filename);
    },
    loadCharacter(filename) {
        return this.loadBitmap("img/characters/", filename);
    },
    loadFace(filename) {
        return this.loadBitmap("img/faces/", filename);
    },
    loadParallax(filename) {
        return this.loadBitmap("img/parallaxes/", filename);
    },
    loadPicture(filename) {
        return this.loadBitmap("img/pictures/", filename);
    },
    loadSvActor(filename) {
        return this.loadBitmap("img/sv_actors/", filename);
    },
    loadSvEnemy(filename) {
        return this.loadBitmap("img/sv_enemies/", filename);
    },
    loadSystem(filename) {
        return this.loadBitmap("img/system/", filename);
    },
    loadTileset(filename) {
        return this.loadBitmap("img/tilesets/", filename);
    },
    loadTitle1(filename) {
        return this.loadBitmap("img/titles1/", filename);
    },
    loadTitle2(filename) {
        return this.loadBitmap("img/titles2/", filename);
    },

    loadBitmap(folder, filename) {
        if (filename) {
            const url = folder + Utils.encodeURI(filename) + ".png";
            return this.loadBitmapFromUrl(url);
        } else {
            return this._emptyBitmap || (this._emptyBitmap = new Bitmap());
        }
    },

    loadBitmapFromUrl(url) {
        const cache = url.includes("/system/") ? this._system : this._cache;
        if (!cache[url]) {
            const fallback = typeof Fallbacks !== "undefined" ? Fallbacks.forUrl(url) : null;
            cache[url] = Bitmap.load(url, fallback);
        }
        return cache[url];
    },

    clear() {
        const cache = this._cache;
        for (const url in cache) cache[url].destroy();
        this._cache = {};
    },

    isReady() {
        for (const cache of [this._cache, this._system]) {
            for (const url in cache) {
                const bitmap = cache[url];
                if (bitmap.isError()) {
                    // Missing images without a fallback are treated as empty.
                    continue;
                }
                if (!bitmap.isReady()) return false;
            }
        }
        return true;
    },

    throwLoadError(bitmap) {
        const retry = bitmap.retry.bind(bitmap);
        throw ["LoadError", bitmap.url, retry];
    },

    isObjectCharacter(filename) {
        const sign = (filename || "").match(/^[!$]+/);
        return !!(sign && sign[0].includes("!"));
    },

    isBigCharacter(filename) {
        const sign = (filename || "").match(/^[!$]+/);
        return !!(sign && sign[0].includes("$"));
    },

    isZeroParallax(filename) {
        return (filename || "").charAt(0) === "!";
    }
};

//-----------------------------------------------------------------------------
// EffectManager — Effekseer support (MZ animations). The Effekseer runtime is
// loaded lazily when present in js/libs; without it animations still play
// their sound and flash timings.

var EffectManager = {
    _cache: {},
    _errorUrls: [],

    load(filename) {
        if (!filename) return null;
        const url = this.makeUrl(filename);
        if (this._cache[url]) return this._cache[url];
        if (typeof EffekseerRenderer === "undefined" || !EffekseerRenderer.isReady()) return null;
        const effect = EffekseerRenderer.loadEffect(url);
        this._cache[url] = effect;
        return effect;
    },

    makeUrl(filename) {
        return "effects/" + Utils.encodeURI(filename) + ".efkefc";
    },

    checkErrors() {},

    isReady() {
        if (typeof EffekseerRenderer === "undefined") return true;
        return EffekseerRenderer.isEffectsReady(this._cache);
    }
};

//-----------------------------------------------------------------------------
// AudioManager

var AudioManager = {
    _bgmVolume: 100,
    _bgsVolume: 100,
    _meVolume: 100,
    _seVolume: 100,
    _currentBgm: null,
    _currentBgs: null,
    _bgmBuffer: null,
    _bgsBuffer: null,
    _meBuffer: null,
    _seBuffers: [],
    _staticBuffers: [],
    _replayFadeTime: 0.5,
    _path: "audio/",

    get bgmVolume() {
        return this._bgmVolume;
    },
    set bgmVolume(value) {
        this._bgmVolume = value;
        this.updateBgmParameters(this._currentBgm);
    },
    get bgsVolume() {
        return this._bgsVolume;
    },
    set bgsVolume(value) {
        this._bgsVolume = value;
        this.updateBgsParameters(this._currentBgs);
    },
    get meVolume() {
        return this._meVolume;
    },
    set meVolume(value) {
        this._meVolume = value;
        this.updateMeParameters(this._currentMe);
    },
    get seVolume() {
        return this._seVolume;
    },
    set seVolume(value) {
        this._seVolume = value;
    },

    playBgm(bgm, pos) {
        if (this.isCurrentBgm(bgm)) {
            this.updateBgmParameters(bgm);
        } else {
            this.stopBgm();
            if (bgm.name) {
                this._bgmBuffer = this.createBuffer("bgm/", bgm.name);
                this.updateBgmParameters(bgm);
                if (!this._meBuffer) this._bgmBuffer.play(true, pos || 0);
            }
        }
        this.updateCurrentBgm(bgm, pos);
    },

    replayBgm(bgm) {
        if (this.isCurrentBgm(bgm)) {
            this.updateBgmParameters(bgm);
        } else {
            this.playBgm(bgm, bgm.pos);
            if (this._bgmBuffer) this._bgmBuffer.fadeIn(this._replayFadeTime);
        }
    },

    isCurrentBgm(bgm) {
        return !!(this._currentBgm && this._bgmBuffer && this._currentBgm.name === bgm.name);
    },

    updateBgmParameters(bgm) {
        this.updateBufferParameters(this._bgmBuffer, this._bgmVolume, bgm);
    },

    updateCurrentBgm(bgm, pos) {
        this._currentBgm = { name: bgm.name, volume: bgm.volume, pitch: bgm.pitch, pan: bgm.pan, pos: pos };
    },

    stopBgm() {
        if (this._bgmBuffer) {
            this._bgmBuffer.destroy();
            this._bgmBuffer = null;
            this._currentBgm = null;
        }
    },

    fadeOutBgm(duration) {
        if (this._bgmBuffer && this._currentBgm) {
            this._bgmBuffer.fadeOut(duration);
            this._currentBgm = null;
        }
    },

    fadeInBgm(duration) {
        if (this._bgmBuffer && this._currentBgm) this._bgmBuffer.fadeIn(duration);
    },

    playBgs(bgs, pos) {
        if (this.isCurrentBgs(bgs)) {
            this.updateBgsParameters(bgs);
        } else {
            this.stopBgs();
            if (bgs.name) {
                this._bgsBuffer = this.createBuffer("bgs/", bgs.name);
                this.updateBgsParameters(bgs);
                this._bgsBuffer.play(true, pos || 0);
            }
        }
        this.updateCurrentBgs(bgs, pos);
    },

    replayBgs(bgs) {
        if (this.isCurrentBgs(bgs)) {
            this.updateBgsParameters(bgs);
        } else {
            this.playBgs(bgs, bgs.pos);
            if (this._bgsBuffer) this._bgsBuffer.fadeIn(this._replayFadeTime);
        }
    },

    isCurrentBgs(bgs) {
        return !!(this._currentBgs && this._bgsBuffer && this._currentBgs.name === bgs.name);
    },

    updateBgsParameters(bgs) {
        this.updateBufferParameters(this._bgsBuffer, this._bgsVolume, bgs);
    },

    updateCurrentBgs(bgs, pos) {
        this._currentBgs = { name: bgs.name, volume: bgs.volume, pitch: bgs.pitch, pan: bgs.pan, pos: pos };
    },

    stopBgs() {
        if (this._bgsBuffer) {
            this._bgsBuffer.destroy();
            this._bgsBuffer = null;
            this._currentBgs = null;
        }
    },

    fadeOutBgs(duration) {
        if (this._bgsBuffer && this._currentBgs) {
            this._bgsBuffer.fadeOut(duration);
            this._currentBgs = null;
        }
    },

    fadeInBgs(duration) {
        if (this._bgsBuffer && this._currentBgs) this._bgsBuffer.fadeIn(duration);
    },

    playMe(me) {
        this.stopMe();
        if (me.name) {
            if (this._bgmBuffer && this._currentBgm) {
                this._currentBgm.pos = this._bgmBuffer.seek();
                this._bgmBuffer.stop();
            }
            this._meBuffer = this.createBuffer("me/", me.name);
            this._currentMe = me;
            this.updateMeParameters(me);
            this._meBuffer.play(false);
            this._meBuffer.addStopListener(this.stopMe.bind(this));
        }
    },

    updateMeParameters(me) {
        this.updateBufferParameters(this._meBuffer, this._meVolume, me);
    },

    fadeOutMe(duration) {
        if (this._meBuffer) this._meBuffer.fadeOut(duration);
    },

    stopMe() {
        if (this._meBuffer) {
            const buffer = this._meBuffer;
            this._meBuffer = null;
            this._currentMe = null;
            buffer.destroy();
            if (this._bgmBuffer && this._currentBgm && !this._bgmBuffer.isPlaying()) {
                this._bgmBuffer.play(true, this._currentBgm.pos);
                this._bgmBuffer.fadeIn(this._replayFadeTime);
            }
        }
    },

    playSe(se) {
        if (se.name) {
            // [Note] Do not play the same sound in the same frame.
            const latestBuffers = this._seBuffers.filter(buffer => buffer.frameCount === Graphics.frameCount);
            if (latestBuffers.find(buffer => buffer.name === se.name)) return;
            const buffer = this.createBuffer("se/", se.name);
            this.updateSeParameters(buffer, se);
            buffer.play(false);
            this._seBuffers.push(buffer);
            this.cleanupSe();
        }
    },

    updateSeParameters(buffer, se) {
        this.updateBufferParameters(buffer, this._seVolume, se);
    },

    cleanupSe() {
        for (const buffer of this._seBuffers.slice()) {
            if (!buffer.isPlaying() && (buffer.isReady() || buffer.isError())) {
                this._seBuffers.remove(buffer);
                buffer.destroy();
            }
        }
    },

    stopSe() {
        for (const buffer of this._seBuffers) buffer.destroy();
        this._seBuffers = [];
    },

    playStaticSe(se) {
        if (se.name) {
            this.loadStaticSe(se);
            for (const buffer of this._staticBuffers) {
                if (buffer.name === se.name) {
                    buffer.stop();
                    this.updateSeParameters(buffer, se);
                    buffer.play(false);
                    break;
                }
            }
        }
    },

    loadStaticSe(se) {
        if (se.name && !this.isStaticSe(se)) {
            const buffer = this.createBuffer("se/", se.name);
            this._staticBuffers.push(buffer);
        }
    },

    isStaticSe(se) {
        return this._staticBuffers.some(buffer => buffer.name === se.name);
    },

    stopAll() {
        this.stopMe();
        this.stopBgm();
        this.stopBgs();
        this.stopSe();
    },

    saveBgm() {
        if (this._currentBgm) {
            const bgm = this._currentBgm;
            return {
                name: bgm.name,
                volume: bgm.volume,
                pitch: bgm.pitch,
                pan: bgm.pan,
                pos: this._bgmBuffer ? this._bgmBuffer.seek() : 0
            };
        } else {
            return this.makeEmptyAudioObject();
        }
    },

    saveBgs() {
        if (this._currentBgs) {
            const bgs = this._currentBgs;
            return {
                name: bgs.name,
                volume: bgs.volume,
                pitch: bgs.pitch,
                pan: bgs.pan,
                pos: this._bgsBuffer ? this._bgsBuffer.seek() : 0
            };
        } else {
            return this.makeEmptyAudioObject();
        }
    },

    makeEmptyAudioObject() {
        return { name: "", volume: 0, pitch: 0 };
    },

    createBuffer(folder, name) {
        const ext = this.audioFileExt();
        const url = this._path + folder + Utils.encodeURI(name) + ext;
        const buffer = new WebAudio(url);
        buffer.name = name;
        buffer.frameCount = Graphics.frameCount;
        return buffer;
    },

    updateBufferParameters(buffer, configVolume, audio) {
        if (buffer && audio) {
            buffer.volume = (configVolume * (audio.volume || 0)) / 10000;
            buffer.pitch = (audio.pitch || 0) / 100;
            buffer.pan = (audio.pan || 0) / 100;
        }
    },

    audioFileExt() {
        if (this._ext === undefined) {
            try {
                this._ext = Utils.canPlayOgg() ? ".ogg" : ".m4a";
            } catch (e) {
                this._ext = ".ogg";
            }
        }
        return this._ext;
    },

    checkErrors() {}
};

//-----------------------------------------------------------------------------
// SoundManager

var SoundManager = {
    preloadImportantSounds() {
        this.loadSystemSound(0);
        this.loadSystemSound(1);
        this.loadSystemSound(2);
        this.loadSystemSound(3);
    },
    loadSystemSound(n) {
        if ($dataSystem && $dataSystem.sounds[n]) AudioManager.loadStaticSe($dataSystem.sounds[n]);
    },
    playSystemSound(n) {
        if ($dataSystem && $dataSystem.sounds[n]) AudioManager.playStaticSe($dataSystem.sounds[n]);
    },
    playCursor() {
        this.playSystemSound(0);
    },
    playOk() {
        this.playSystemSound(1);
    },
    playCancel() {
        this.playSystemSound(2);
    },
    playBuzzer() {
        this.playSystemSound(3);
    },
    playEquip() {
        this.playSystemSound(4);
    },
    playSave() {
        this.playSystemSound(5);
    },
    playLoad() {
        this.playSystemSound(6);
    },
    playBattleStart() {
        this.playSystemSound(7);
    },
    playEscape() {
        this.playSystemSound(8);
    },
    playEnemyAttack() {
        this.playSystemSound(9);
    },
    playEnemyDamage() {
        this.playSystemSound(10);
    },
    playEnemyCollapse() {
        this.playSystemSound(11);
    },
    playBossCollapse1() {
        this.playSystemSound(12);
    },
    playBossCollapse2() {
        this.playSystemSound(13);
    },
    playActorDamage() {
        this.playSystemSound(14);
    },
    playActorCollapse() {
        this.playSystemSound(15);
    },
    playRecovery() {
        this.playSystemSound(16);
    },
    playMiss() {
        this.playSystemSound(17);
    },
    playEvasion() {
        this.playSystemSound(18);
    },
    playMagicEvasion() {
        this.playSystemSound(19);
    },
    playReflection() {
        this.playSystemSound(20);
    },
    playShop() {
        this.playSystemSound(21);
    },
    playUseItem() {
        this.playSystemSound(22);
    },
    playUseSkill() {
        this.playSystemSound(23);
    }
};

//-----------------------------------------------------------------------------
// TextManager

var TextManager = {
    basic(basicId) {
        return $dataSystem.terms.basic[basicId] || "";
    },
    param(paramId) {
        return $dataSystem.terms.params[paramId] || "";
    },
    command(commandId) {
        return $dataSystem.terms.commands[commandId] || "";
    },
    message(messageId) {
        return $dataSystem.terms.messages[messageId] || "";
    },
    getter(method, param) {
        return {
            get: function() {
                return this[method](param);
            },
            configurable: true
        };
    }
};

Object.defineProperty(TextManager, "currencyUnit", {
    get: function() {
        return $dataSystem.currencyUnit;
    },
    configurable: true
});

Object.defineProperties(TextManager, {
    level: TextManager.getter("basic", 0),
    levelA: TextManager.getter("basic", 1),
    hp: TextManager.getter("basic", 2),
    hpA: TextManager.getter("basic", 3),
    mp: TextManager.getter("basic", 4),
    mpA: TextManager.getter("basic", 5),
    tp: TextManager.getter("basic", 6),
    tpA: TextManager.getter("basic", 7),
    exp: TextManager.getter("basic", 8),
    expA: TextManager.getter("basic", 9),
    fight: TextManager.getter("command", 0),
    escape: TextManager.getter("command", 1),
    attack: TextManager.getter("command", 2),
    guard: TextManager.getter("command", 3),
    item: TextManager.getter("command", 4),
    skill: TextManager.getter("command", 5),
    equip: TextManager.getter("command", 6),
    status: TextManager.getter("command", 7),
    formation: TextManager.getter("command", 8),
    save: TextManager.getter("command", 9),
    gameEnd: TextManager.getter("command", 10),
    options: TextManager.getter("command", 11),
    weapon: TextManager.getter("command", 12),
    armor: TextManager.getter("command", 13),
    keyItem: TextManager.getter("command", 14),
    equip2: TextManager.getter("command", 15),
    optimize: TextManager.getter("command", 16),
    clear: TextManager.getter("command", 17),
    newGame: TextManager.getter("command", 18),
    continue_: TextManager.getter("command", 19),
    toTitle: TextManager.getter("command", 21),
    cancel: TextManager.getter("command", 22),
    buy: TextManager.getter("command", 24),
    sell: TextManager.getter("command", 25),
    alwaysDash: TextManager.getter("message", "alwaysDash"),
    commandRemember: TextManager.getter("message", "commandRemember"),
    touchUI: TextManager.getter("message", "touchUI"),
    bgmVolume: TextManager.getter("message", "bgmVolume"),
    bgsVolume: TextManager.getter("message", "bgsVolume"),
    meVolume: TextManager.getter("message", "meVolume"),
    seVolume: TextManager.getter("message", "seVolume"),
    possession: TextManager.getter("message", "possession"),
    expTotal: TextManager.getter("message", "expTotal"),
    expNext: TextManager.getter("message", "expNext"),
    saveMessage: TextManager.getter("message", "saveMessage"),
    loadMessage: TextManager.getter("message", "loadMessage"),
    file: TextManager.getter("message", "file"),
    autosave: TextManager.getter("message", "autosave"),
    partyName: TextManager.getter("message", "partyName"),
    emerge: TextManager.getter("message", "emerge"),
    preemptive: TextManager.getter("message", "preemptive"),
    surprise: TextManager.getter("message", "surprise"),
    escapeStart: TextManager.getter("message", "escapeStart"),
    escapeFailure: TextManager.getter("message", "escapeFailure"),
    victory: TextManager.getter("message", "victory"),
    defeat: TextManager.getter("message", "defeat"),
    obtainExp: TextManager.getter("message", "obtainExp"),
    obtainGold: TextManager.getter("message", "obtainGold"),
    obtainItem: TextManager.getter("message", "obtainItem"),
    levelUp: TextManager.getter("message", "levelUp"),
    obtainSkill: TextManager.getter("message", "obtainSkill"),
    useItem: TextManager.getter("message", "useItem"),
    criticalToEnemy: TextManager.getter("message", "criticalToEnemy"),
    criticalToActor: TextManager.getter("message", "criticalToActor"),
    actorDamage: TextManager.getter("message", "actorDamage"),
    actorRecovery: TextManager.getter("message", "actorRecovery"),
    actorGain: TextManager.getter("message", "actorGain"),
    actorLoss: TextManager.getter("message", "actorLoss"),
    actorDrain: TextManager.getter("message", "actorDrain"),
    actorNoDamage: TextManager.getter("message", "actorNoDamage"),
    actorNoHit: TextManager.getter("message", "actorNoHit"),
    enemyDamage: TextManager.getter("message", "enemyDamage"),
    enemyRecovery: TextManager.getter("message", "enemyRecovery"),
    enemyGain: TextManager.getter("message", "enemyGain"),
    enemyLoss: TextManager.getter("message", "enemyLoss"),
    enemyDrain: TextManager.getter("message", "enemyDrain"),
    enemyNoDamage: TextManager.getter("message", "enemyNoDamage"),
    enemyNoHit: TextManager.getter("message", "enemyNoHit"),
    evasion: TextManager.getter("message", "evasion"),
    magicEvasion: TextManager.getter("message", "magicEvasion"),
    magicReflection: TextManager.getter("message", "magicReflection"),
    counterAttack: TextManager.getter("message", "counterAttack"),
    substitute: TextManager.getter("message", "substitute"),
    buffAdd: TextManager.getter("message", "buffAdd"),
    debuffAdd: TextManager.getter("message", "debuffAdd"),
    buffRemove: TextManager.getter("message", "buffRemove"),
    actionFailure: TextManager.getter("message", "actionFailure")
});

//-----------------------------------------------------------------------------
// ColorManager

var ColorManager = {
    _paletteCache: null,

    loadWindowskin() {
        this._windowskin = ImageManager.loadSystem("Window");
        this._paletteCache = null;
    },

    textColor(n) {
        const palette = this._paletteCache || this._buildPalette();
        return palette[n] || "#ffffff";
    },

    _buildPalette() {
        const skin = this._windowskin;
        const palette = Fallbacks.TEXT_COLORS.slice();
        if (skin && skin.isReady() && skin.source && !skin._isFallback) {
            try {
                for (let n = 0; n < 32; n++) {
                    const px = 96 + (n % 8) * 12 + 6;
                    const py = 144 + Math.floor(n / 8) * 12 + 6;
                    palette[n] = skin.getPixel(px, py);
                }
                palette.pending = skin.getPixel(120, 120);
            } catch (e) {
                // tainted canvas (file://): keep defaults
            }
        }
        if (skin && skin.isReady()) this._paletteCache = palette;
        return palette;
    },

    normalColor() {
        return this.textColor(0);
    },
    systemColor() {
        return this.textColor(16);
    },
    crisisColor() {
        return this.textColor(17);
    },
    deathColor() {
        return this.textColor(18);
    },
    gaugeBackColor() {
        return this.textColor(19);
    },
    hpGaugeColor1() {
        return this.textColor(20);
    },
    hpGaugeColor2() {
        return this.textColor(21);
    },
    mpGaugeColor1() {
        return this.textColor(22);
    },
    mpGaugeColor2() {
        return this.textColor(23);
    },
    mpCostColor() {
        return this.textColor(23);
    },
    powerUpColor() {
        return this.textColor(24);
    },
    powerDownColor() {
        return this.textColor(25);
    },
    ctGaugeColor1() {
        return this.textColor(26);
    },
    ctGaugeColor2() {
        return this.textColor(27);
    },
    tpGaugeColor1() {
        return this.textColor(28);
    },
    tpGaugeColor2() {
        return this.textColor(29);
    },
    tpCostColor() {
        return this.textColor(29);
    },
    pendingColor() {
        const palette = this._paletteCache || this._buildPalette();
        return palette.pending || "#2a3c5a";
    },
    hpColor(actor) {
        if (!actor) return this.normalColor();
        if (actor.isDead()) return this.deathColor();
        if (actor.isDying()) return this.crisisColor();
        return this.normalColor();
    },
    mpColor() {
        return this.normalColor();
    },
    tpColor() {
        return this.normalColor();
    },
    paramchangeTextColor(change) {
        if (change > 0) return this.powerUpColor();
        if (change < 0) return this.powerDownColor();
        return this.normalColor();
    },
    damageColor(colorType) {
        switch (colorType) {
            case 0: return "#ffffff";
            case 1: return "#b9ffb5";
            case 2: return "#ffff90";
            case 3: return "#80b0ff";
            default: return "#808080";
        }
    },
    outlineColor() {
        return "rgba(0, 0, 0, 0.6)";
    },
    dimColor1() {
        return "rgba(0, 0, 0, 0.6)";
    },
    dimColor2() {
        return "rgba(0, 0, 0, 0)";
    },
    itemBackColor1() {
        return "rgba(32, 32, 32, 0.5)";
    },
    itemBackColor2() {
        return "rgba(0, 0, 0, 0.5)";
    }
};

//-----------------------------------------------------------------------------
// SceneManager

var SceneManager = {
    _scene: null,
    _nextScene: null,
    _stack: [],
    _exiting: false,
    _previousScene: null,
    _previousClass: null,
    _backgroundBitmap: null,
    _smoothDeltaTime: 1,
    _elapsedTime: 0,

    run(sceneClass) {
        try {
            this.initialize();
            this.goto(sceneClass);
            Graphics.startGameLoop();
        } catch (e) {
            this.catchException(e);
        }
    },

    initialize() {
        this.checkBrowser();
        this.initGraphics();
        this.initAudio();
        this.initVideo();
        this.initInput();
        this.setupEventHandlers();
    },

    checkBrowser() {
        if (!Utils.canUseCssFontLoading()) {
            throw new Error("Your browser does not support CSS Font Loading.");
        }
    },

    initGraphics() {
        const w = window.$rpg9kScreen ? window.$rpg9kScreen.width : 816;
        const h = window.$rpg9kScreen ? window.$rpg9kScreen.height : 624;
        if (!Graphics.initialize(w, h)) throw new Error("Failed to initialize graphics.");
        Graphics.setTickHandler(this.update.bind(this));
    },

    initAudio() {
        WebAudio.initialize();
    },

    initVideo() {
        Video.initialize(Graphics.width, Graphics.height);
    },

    initInput() {
        Input.initialize();
        TouchInput.initialize();
    },

    setupEventHandlers() {
        window.addEventListener("error", this.onError.bind(this));
        window.addEventListener("unhandledrejection", this.onReject.bind(this));
        document.addEventListener("keydown", this.onKeyDown.bind(this));
    },

    update(deltaTime) {
        try {
            const n = this.determineRepeatNumber(deltaTime);
            for (let i = 0; i < n; i++) this.updateMain();
            Graphics.render();
        } catch (e) {
            this.catchException(e);
        }
    },

    determineRepeatNumber(deltaTime) {
        // A fixed 60 updates per second regardless of display refresh rate.
        this._smoothDeltaTime *= 0.8;
        this._smoothDeltaTime += Math.min(deltaTime, 2) * 0.2;
        if (this._smoothDeltaTime >= 0.9) {
            this._elapsedTime = 0;
            return Math.round(this._smoothDeltaTime);
        } else {
            this._elapsedTime += deltaTime;
            if (this._elapsedTime >= 1) {
                this._elapsedTime -= 1;
                return 1;
            }
            return 0;
        }
    },

    terminate() {
        Graphics.stopGameLoop();
        if (window.rpg9kHost && window.rpg9kHost.close) window.rpg9kHost.close();
        else window.close();
    },

    onError(event) {
        console.error(event.message);
        console.error(event.filename, event.lineno);
        try {
            this.stop();
            Graphics.printError("Error", event.message, event.error);
            AudioManager.stopAll();
        } catch (e) {
            // ignore
        }
    },

    onReject(event) {
        // Surface unhandled promise rejections like errors.
        event.message = event.reason && event.reason.message ? event.reason.message : String(event.reason);
        event.error = event.reason;
        this.onError(event);
    },

    onUnload() {
        ImageManager.clear();
        EffectManager.clear && EffectManager.clear();
        AudioManager.stopAll();
    },

    onKeyDown(event) {
        if (!event.ctrlKey && !event.altKey) {
            switch (event.keyCode) {
                case 116: // F5
                    this.reloadGame();
                    break;
                case 119: // F8
                    this.showDevTools();
                    break;
            }
        }
    },

    reloadGame() {
        if (window.rpg9kHost && window.rpg9kHost.reload) window.rpg9kHost.reload();
        else location.reload();
    },

    showDevTools() {
        if (Utils.isOptionValid("test") && window.rpg9kHost && window.rpg9kHost.showDevTools) {
            window.rpg9kHost.showDevTools();
        }
    },

    catchException(e) {
        if (e instanceof Error) {
            this.catchNormalError(e);
        } else if (e instanceof Array && e[0] === "LoadError") {
            this.catchLoadError(e);
        } else {
            this.catchUnknownError(e);
        }
        this.stop();
    },

    catchNormalError(e) {
        Graphics.printError(e.name, e.message, e);
        AudioManager.stopAll();
        console.error(e.stack);
    },

    catchLoadError(e) {
        const url = e[1];
        const retry = e[2];
        Graphics.printError("Failed to load", url);
        if (retry) {
            Graphics.showRetryButton(() => {
                retry();
                SceneManager.resume();
            });
        } else {
            AudioManager.stopAll();
        }
    },

    catchUnknownError(e) {
        Graphics.printError("UnknownError", String(e));
        AudioManager.stopAll();
    },

    updateMain() {
        this.updateFrameCount();
        this.updateInputData();
        this.updateEffekseer();
        this.changeScene();
        this.updateScene();
    },

    updateFrameCount() {
        Graphics.frameCount++;
    },

    updateInputData() {
        Input.update();
        TouchInput.update();
    },

    updateEffekseer() {
        if (typeof EffekseerRenderer !== "undefined") EffekseerRenderer.update();
    },

    changeScene() {
        if (this.isSceneChanging() && !this.isCurrentSceneBusy()) {
            if (this._scene) {
                this._scene.terminate();
                this.onSceneTerminate();
            }
            this._scene = this._nextScene;
            this._nextScene = null;
            if (this._scene) {
                this._scene.create();
                this.onSceneCreate();
            }
            if (this._exiting) this.terminate();
        }
    },

    updateScene() {
        if (this._scene) {
            if (this._scene.isStarted()) {
                if (this.isGameActive()) this._scene.update();
            } else if (this._scene.isReady()) {
                this.onBeforeSceneStart();
                this._scene.start();
                this.onSceneStart();
            }
        }
    },

    isGameActive() {
        // Unlike MZ, the game keeps running when the window loses focus.
        return true;
    },

    onSceneTerminate() {
        this._previousScene = this._scene;
        this._previousClass = this._scene.constructor;
        Graphics.setStage(null);
    },

    onSceneCreate() {
        Graphics.startLoading();
    },

    onBeforeSceneStart() {
        if (this._previousScene) {
            this._previousScene.destroy();
            this._previousScene = null;
        }
    },

    onSceneStart() {
        Graphics.endLoading();
        Graphics.setStage(this._scene);
    },

    isSceneChanging() {
        return this._exiting || !!this._nextScene;
    },

    isCurrentSceneBusy() {
        return this._scene && this._scene.isBusy();
    },

    isNextScene(sceneClass) {
        return this._nextScene && this._nextScene.constructor === sceneClass;
    },

    isPreviousScene(sceneClass) {
        return this._previousClass === sceneClass;
    },

    goto(sceneClass) {
        if (sceneClass) this._nextScene = new sceneClass();
        if (this._scene) this._scene.stop();
    },

    push(sceneClass) {
        this._stack.push(this._scene.constructor);
        this.goto(sceneClass);
    },

    pop() {
        if (this._stack.length > 0) this.goto(this._stack.pop());
        else this.exit();
    },

    exit() {
        this.goto(null);
        this._exiting = true;
    },

    clearStack() {
        this._stack = [];
    },

    stop() {
        Graphics.stopGameLoop();
    },

    prepareNextScene(...args) {
        this._nextScene.prepare(...args);
    },

    snap() {
        return Bitmap.snap(this._scene);
    },

    snapForBackground() {
        if (this._backgroundBitmap) this._backgroundBitmap.destroy();
        this._backgroundBitmap = this.snap();
    },

    backgroundBitmap() {
        return this._backgroundBitmap;
    },

    resume() {
        TouchInput.update();
        Graphics.eraseError();
        Graphics.startGameLoop();
    }
};

//-----------------------------------------------------------------------------
// PluginManager

var PluginManager = {
    _scripts: [],
    _errorUrls: [],
    _parameters: {},
    _commands: {},

    // Loads enabled plugins in order. Returns a promise resolved once every
    // plugin script has executed.
    setup(plugins) {
        const loads = [];
        for (const plugin of plugins || []) {
            const pluginName = Utils.extractFileName(plugin.name);
            if (plugin.status && !this._scripts.includes(pluginName)) {
                this.setParameters(pluginName, plugin.parameters);
                loads.push(this.loadScript(plugin.name));
                this._scripts.push(pluginName);
            }
        }
        return Promise.all(loads);
    },

    parameters(name) {
        return this._parameters[name.toLowerCase()] || {};
    },

    setParameters(name, parameters) {
        this._parameters[name.toLowerCase()] = parameters;
    },

    loadScript(filename) {
        return new Promise(resolve => {
            const url = this.makeUrl(filename);
            const script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;
            script.async = false;
            script.defer = true;
            script.onerror = () => {
                this.onError({ target: { _url: url } });
                resolve();
            };
            script.onload = () => resolve();
            script._url = url;
            document.body.appendChild(script);
        });
    },

    onError(e) {
        this._errorUrls.push(e.target._url);
    },

    makeUrl(filename) {
        return "js/plugins/" + Utils.encodeURI(filename) + ".js";
    },

    checkErrors() {
        const url = this._errorUrls.shift();
        if (url) this.throwLoadError(url);
    },

    throwLoadError(url) {
        throw new Error("Failed to load plugin: " + url);
    },

    registerCommand(pluginName, commandName, func) {
        const key = pluginName + ":" + commandName;
        this._commands[key] = func;
    },

    callCommand(self, pluginName, commandName, args) {
        const key = pluginName + ":" + commandName;
        const func = this._commands[key];
        if (typeof func === "function") {
            func.bind(self)(args);
        }
    }
};
