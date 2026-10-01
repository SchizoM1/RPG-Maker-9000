//=============================================================================
// rpg9k_core.js — RPG Maker 9000 runtime core
// Utilities, JSON serialization, Graphics, Input, TouchInput, Bitmap and the
// Canvas 2D display list (Container / Sprite / Stage).
//
// All classes are declared with `var Name = class ...` so they live on the
// global object and can be aliased or replaced by plugins, MZ-style.
// Constructors forward to initialize(), so plugins may subclass with either
// `class X extends Sprite` or the classic prototype pattern.
//=============================================================================
"use strict";

//-----------------------------------------------------------------------------
// Prototype extensions (MZ-compatible helpers used widely by plugins)

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};
Number.prototype.mod = function(n) {
    return ((this % n) + n) % n;
};
Number.prototype.padZero = function(length) {
    return String(this).padZero(length);
};
String.prototype.format = function() {
    return this.replace(/%([0-9]+)/g, (s, n) => arguments[Number(n) - 1]);
};
String.prototype.padZero = function(length) {
    return this.padStart(length, "0");
};
String.prototype.contains = function(s) {
    return this.includes(s);
};
Object.defineProperties(Array.prototype, {
    equals: {
        enumerable: false,
        value: function(array) {
            if (!array || this.length !== array.length) return false;
            for (let i = 0; i < this.length; i++) {
                if (this[i] instanceof Array && array[i] instanceof Array) {
                    if (!this[i].equals(array[i])) return false;
                } else if (this[i] !== array[i]) {
                    return false;
                }
            }
            return true;
        }
    },
    clone: {
        enumerable: false,
        value: function() {
            return this.slice(0);
        }
    },
    contains: {
        enumerable: false,
        value: function(element) {
            return this.includes(element);
        }
    },
    remove: {
        enumerable: false,
        value: function(element) {
            for (;;) {
                const index = this.indexOf(element);
                if (index >= 0) this.splice(index, 1);
                else return this;
            }
        }
    }
});
Math.randomInt = function(max) {
    return Math.floor(max * Math.random());
};

//-----------------------------------------------------------------------------
// Utils

var Utils = {
    RPGMAKER_NAME: "RPG9K",
    RPGMAKER_VERSION: "0.1.0",
    RPG9K_VERSION: "0.1.0",

    isOptionValid(name) {
        if (typeof location === "undefined") return false;
        const args = location.search.slice(1);
        if (args.split("&").includes(name)) return true;
        return false;
    },
    queryParam(name) {
        if (typeof location === "undefined") return null;
        return new URLSearchParams(location.search).get(name);
    },
    isNwjs() {
        return false;
    },
    isRpg9kEditor() {
        return typeof window !== "undefined" && !!window.rpg9kEditor;
    },
    isMobileDevice() {
        if (typeof navigator === "undefined") return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini/i.test(navigator.userAgent);
    },
    isMobileSafari() {
        if (typeof navigator === "undefined") return false;
        const agent = navigator.userAgent;
        return !!(agent.match(/iPhone|iPad|iPod/) && agent.match(/AppleWebKit/) && !agent.match("CriOS"));
    },
    isAndroidChrome() {
        if (typeof navigator === "undefined") return false;
        const agent = navigator.userAgent;
        return !!(agent.match(/Android/) && agent.match(/Chrome/));
    },
    isLocal() {
        return typeof location !== "undefined" && location.protocol === "file:";
    },
    canUseWebGL() {
        try {
            const canvas = document.createElement("canvas");
            return !!canvas.getContext("webgl");
        } catch (e) {
            return false;
        }
    },
    canUseWebAudioAPI() {
        return typeof window !== "undefined" && !!(window.AudioContext || window.webkitAudioContext);
    },
    canUseCssFontLoading() {
        return typeof document !== "undefined" && !!(document.fonts && document.fonts.ready);
    },
    canUseIndexedDB() {
        return typeof window !== "undefined" && !!window.indexedDB;
    },
    canPlayOgg() {
        if (!Utils._audioElement) Utils._audioElement = document.createElement("audio");
        return !!Utils._audioElement.canPlayType('audio/ogg; codecs="vorbis"');
    },
    canPlayWebm() {
        if (!Utils._videoElement) Utils._videoElement = document.createElement("video");
        return !!Utils._videoElement.canPlayType('video/webm; codecs="vp8, vorbis"');
    },
    encodeURI(str) {
        return encodeURIComponent(str).replace(/%2F/g, "/");
    },
    extractFileName(filename) {
        return filename.split("/").pop();
    },
    escapeHtml(str) {
        const entityMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;" };
        return String(str).replace(/[&<>"'/]/g, s => entityMap[s]);
    },
    containsArabic(str) {
        return /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(str);
    },
    setEncryptionInfo() {},
    hasEncryptedImages() {
        return false;
    },
    hasEncryptedAudio() {
        return false;
    },
    decryptArrayBuffer(source) {
        return source;
    },
    rgbToCssColor(r, g, b) {
        return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
    }
};

//-----------------------------------------------------------------------------
// Rectangle / Point

var Point = class {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    set(x, y) {
        this.x = x;
        this.y = y === undefined ? x : y;
    }
    clone() {
        return new Point(this.x, this.y);
    }
};

var Rectangle = class {
    constructor(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = width || 0;
        this.height = height || 0;
    }
    get left() {
        return this.x;
    }
    get right() {
        return this.x + this.width;
    }
    get top() {
        return this.y;
    }
    get bottom() {
        return this.y + this.height;
    }
    contains(x, y) {
        return x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height;
    }
    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }
    enlarge(rect) {
        const x1 = Math.min(this.x, rect.x);
        const y1 = Math.min(this.y, rect.y);
        const x2 = Math.max(this.x + this.width, rect.x + rect.width);
        const y2 = Math.max(this.y + this.height, rect.y + rect.height);
        this.x = x1;
        this.y = y1;
        this.width = x2 - x1;
        this.height = y2 - y1;
        return this;
    }
    pad(n) {
        this.x -= n;
        this.y -= n;
        this.width += n * 2;
        this.height += n * 2;
        return this;
    }
};

//-----------------------------------------------------------------------------
// JsonEx — JSON with class preservation (for save files)

var JsonEx = {
    maxDepth: 100,

    stringify(object) {
        return JSON.stringify(this._encode(object, 0));
    },
    parse(json) {
        return this._decode(JSON.parse(json));
    },
    makeDeepCopy(object) {
        return this.parse(this.stringify(object));
    },
    _encode(value, depth) {
        if (depth >= this.maxDepth) throw new Error("Object too deep");
        if (value === null || typeof value !== "object") return value;
        if (Array.isArray(value)) return value.map(v => this._encode(v, depth + 1));
        const out = {};
        const ctor = Object.getPrototypeOf(value) && Object.getPrototypeOf(value).constructor;
        if (ctor && ctor !== Object && ctor.name) out["@"] = ctor.name;
        for (const key of Object.keys(value)) {
            const v = value[key];
            if (typeof v === "function") continue;
            out[key] = this._encode(v, depth + 1);
        }
        return out;
    },
    _decode(value) {
        if (value === null || typeof value !== "object") return value;
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) value[i] = this._decode(value[i]);
            return value;
        }
        const type = value["@"];
        delete value["@"];
        for (const key of Object.keys(value)) value[key] = this._decode(value[key]);
        if (type) {
            const ctor = JsonEx._resolveClass(type);
            if (ctor && ctor.prototype) Object.setPrototypeOf(value, ctor.prototype);
        }
        return value;
    },
    _resolveClass(name) {
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
        if (globalThis[name]) return globalThis[name];
        try {
            return Function("return typeof " + name + " !== 'undefined' ? " + name + " : null")();
        } catch (e) {
            return null;
        }
    }
};

//-----------------------------------------------------------------------------
// Graphics — owns the game canvas and the frame loop

var Graphics = {
    _width: 816,
    _height: 624,
    boxWidth: 816,
    boxHeight: 624,
    frameCount: 0,
    _canvas: null,
    _context: null,
    _stage: null,
    _tickHandler: null,
    _running: false,
    _stretchEnabled: true,
    _integerScale: false,
    _realScale: 1,
    _fpsCounter: null,
    _errorPrinter: null,
    _loadingCount: 0,
    _loadingEl: null,

    initialize(width, height) {
        this._width = width || 816;
        this._height = height || 624;
        this.boxWidth = this._width;
        this.boxHeight = this._height;
        this.frameCount = 0;
        this._createCanvas();
        this._createErrorPrinter();
        this._createFPSCounter();
        this._createLoadingIndicator();
        this._setupEventHandlers();
        this._updateAllElements();
        return true;
    },

    get width() {
        return this._width;
    },
    set width(value) {
        if (this._width !== value) {
            this._width = value;
            this._updateAllElements();
        }
    },
    get height() {
        return this._height;
    },
    set height(value) {
        if (this._height !== value) {
            this._height = value;
            this._updateAllElements();
        }
    },
    get defaultScale() {
        return this._defaultScale || 1;
    },
    set defaultScale(v) {
        this._defaultScale = v;
        this._updateAllElements();
    },

    resize(width, height) {
        this._width = width;
        this._height = height;
        this._updateAllElements();
    },

    setTickHandler(handler) {
        this._tickHandler = handler;
    },

    setStage(stage) {
        this._stage = stage;
    },

    startGameLoop() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        const loop = now => {
            if (!this._running) return;
            this._fpsBegin();
            const delta = Math.min((now - this._lastTime) / (1000 / 60), 4);
            this._lastTime = now;
            if (this._tickHandler) this._tickHandler(delta);
            this._fpsEnd();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    stopGameLoop() {
        this._running = false;
    },

    render() {
        const ctx = this._context;
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this._width, this._height);
        if (this._stage) this._stage.render(ctx);
    },

    isInsideCanvas(x, y) {
        return x >= 0 && x < this._width && y >= 0 && y < this._height;
    },

    pageToCanvasX(x) {
        if (!this._canvas) return 0;
        const left = this._canvas.getBoundingClientRect().left;
        return Math.round((x - left) / this._realScale);
    },

    pageToCanvasY(y) {
        if (!this._canvas) return 0;
        const top = this._canvas.getBoundingClientRect().top;
        return Math.round((y - top) / this._realScale);
    },

    // Loading indicator
    startLoading() {
        this._loadingCount = 0;
    },
    updateLoading() {
        this._loadingCount++;
        if (this._loadingEl && this._loadingCount > 60) this._loadingEl.style.display = "block";
    },
    endLoading() {
        this._loadingCount = 0;
        if (this._loadingEl) this._loadingEl.style.display = "none";
    },

    printError(name, message, error) {
        if (!this._errorPrinter) {
            console.error(name, message, error);
            return;
        }
        this._errorPrinter.innerHTML =
            '<div class="rpg9k-error-name">' + Utils.escapeHtml(name) + "</div>" +
            '<div class="rpg9k-error-message">' + Utils.escapeHtml(message) + "</div>";
        if (error && error.stack && Utils.isOptionValid("test")) {
            this._errorPrinter.innerHTML +=
                '<pre class="rpg9k-error-stack">' + Utils.escapeHtml(error.stack) + "</pre>";
        }
        this._errorPrinter.style.display = "block";
        this.stopGameLoop();
    },

    showRetryButton(retry) {
        if (!this._errorPrinter) return;
        const button = document.createElement("button");
        button.textContent = "Retry";
        button.onclick = () => {
            this._errorPrinter.style.display = "none";
            retry();
        };
        this._errorPrinter.appendChild(button);
    },

    eraseError() {
        if (this._errorPrinter) this._errorPrinter.style.display = "none";
    },

    showScreen() {
        if (this._canvas) this._canvas.style.opacity = 1;
    },
    hideScreen() {
        if (this._canvas) this._canvas.style.opacity = 0;
    },

    setStretchMode(enabled) {
        this._stretchEnabled = enabled;
        this._updateAllElements();
    },

    showFps() {
        if (this._fpsCounter) this._fpsCounter.style.display = "block";
        this._fpsVisible = true;
    },
    hideFps() {
        if (this._fpsCounter) this._fpsCounter.style.display = "none";
        this._fpsVisible = false;
    },

    toggleFullScreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.body.requestFullscreen().catch(() => {});
    },

    _createCanvas() {
        this._canvas = document.createElement("canvas");
        this._canvas.id = "gameCanvas";
        this._context = this._canvas.getContext("2d", { alpha: false });
        document.body.appendChild(this._canvas);
    },

    _createErrorPrinter() {
        this._errorPrinter = document.createElement("div");
        this._errorPrinter.id = "errorPrinter";
        this._errorPrinter.style.display = "none";
        document.body.appendChild(this._errorPrinter);
    },

    _createFPSCounter() {
        this._fpsCounter = document.createElement("div");
        this._fpsCounter.id = "fpsCounter";
        this._fpsCounter.style.display = "none";
        document.body.appendChild(this._fpsCounter);
        this._fpsFrames = 0;
        this._fpsLast = performance.now();
    },

    _createLoadingIndicator() {
        this._loadingEl = document.createElement("div");
        this._loadingEl.id = "loadingSpinner";
        this._loadingEl.style.display = "none";
        document.body.appendChild(this._loadingEl);
    },

    _fpsBegin() {},
    _fpsEnd() {
        this._fpsFrames++;
        const now = performance.now();
        if (now - this._fpsLast >= 500) {
            this._fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsLast));
            this._fpsFrames = 0;
            this._fpsLast = now;
            if (this._fpsVisible && this._fpsCounter) this._fpsCounter.textContent = "FPS " + this._fps;
        }
    },

    _setupEventHandlers() {
        window.addEventListener("resize", () => this._updateAllElements());
        document.addEventListener("keydown", event => {
            if (event.ctrlKey || event.altKey) return;
            switch (event.keyCode) {
                case 113: // F2
                    event.preventDefault();
                    this._fpsVisible ? this.hideFps() : this.showFps();
                    break;
                case 114: // F3
                    event.preventDefault();
                    this.setStretchMode(!this._stretchEnabled);
                    break;
                case 115: // F4
                    event.preventDefault();
                    this.toggleFullScreen();
                    break;
            }
        });
    },

    _updateAllElements() {
        if (!this._canvas) return;
        this._canvas.width = this._width;
        this._canvas.height = this._height;
        this._context.imageSmoothingEnabled = false;
        this._updateRealScale();
        const w = this._width * this._realScale;
        const h = this._height * this._realScale;
        const style = this._canvas.style;
        style.width = w + "px";
        style.height = h + "px";
        style.position = "absolute";
        style.left = Math.floor((window.innerWidth - w) / 2) + "px";
        style.top = Math.floor((window.innerHeight - h) / 2) + "px";
    },

    _updateRealScale() {
        if (this._stretchEnabled && typeof window !== "undefined") {
            let scale = Math.min(window.innerWidth / this._width, window.innerHeight / this._height);
            if (this._integerScale && scale >= 1) scale = Math.floor(scale);
            this._realScale = scale || 1;
        } else {
            this._realScale = this.defaultScale;
        }
    }
};

//-----------------------------------------------------------------------------
// Input — keyboard and gamepad

var Input = {
    keyRepeatWait: 24,
    keyRepeatInterval: 6,

    keyMapper: {
        9: "tab",
        13: "ok",
        16: "shift",
        17: "control",
        18: "control",
        27: "escape",
        32: "ok",
        33: "pageup",
        34: "pagedown",
        37: "left",
        38: "up",
        39: "right",
        40: "down",
        45: "escape",
        81: "pageup",
        87: "pagedown",
        88: "escape",
        90: "ok",
        96: "escape",
        98: "down",
        100: "left",
        102: "right",
        104: "up",
        120: "debug"
    },

    gamepadMapper: {
        0: "ok",
        1: "cancel",
        2: "shift",
        3: "menu",
        4: "pageup",
        5: "pagedown",
        12: "up",
        13: "down",
        14: "left",
        15: "right"
    },

    initialize() {
        this.clear();
        this._setupEventHandlers();
    },

    clear() {
        this._currentState = {};
        this._previousState = {};
        this._gamepadStates = [];
        this._latestButton = null;
        this._pressedTime = 0;
        this._dir4 = 0;
        this._dir8 = 0;
        this._preferredAxis = "";
        this._date = 0;
        this._virtualButton = null;
        this._quickPresses = [];
    },

    update() {
        this._pollGamepads();
        if (this._currentState[this._latestButton]) {
            this._pressedTime++;
        } else {
            this._latestButton = null;
        }
        for (const name in this._currentState) {
            if (this._currentState[name] && !this._previousState[name]) {
                this._latestButton = name;
                this._pressedTime = 0;
                this._date = Date.now();
            }
            this._previousState[name] = this._currentState[name];
        }
        // Presses that started and ended between two updates still trigger.
        for (const name of this._quickPresses) {
            if (!this._currentState[name] && this._latestButton !== name) {
                this._latestButton = name;
                this._pressedTime = 0;
                this._date = Date.now();
            }
        }
        this._quickPresses = [];
        if (this._virtualButton) {
            this._latestButton = this._virtualButton;
            this._pressedTime = 0;
            this._virtualButton = null;
        }
        this._updateDirection();
    },

    isPressed(keyName) {
        if (this._isEscapeCompatible(keyName) && this.isPressed("escape")) return true;
        return !!this._currentState[keyName];
    },

    isTriggered(keyName) {
        if (this._isEscapeCompatible(keyName) && this.isTriggered("escape")) return true;
        return this._latestButton === keyName && this._pressedTime === 0;
    },

    isRepeated(keyName) {
        if (this._isEscapeCompatible(keyName) && this.isRepeated("escape")) return true;
        return (
            this._latestButton === keyName &&
            (this._pressedTime === 0 ||
                (this._pressedTime >= this.keyRepeatWait && this._pressedTime % this.keyRepeatInterval === 0))
        );
    },

    isLongPressed(keyName) {
        if (this._isEscapeCompatible(keyName) && this.isLongPressed("escape")) return true;
        return this._latestButton === keyName && this._pressedTime >= this.keyRepeatWait;
    },

    virtualClick(buttonName) {
        this._virtualButton = buttonName;
    },

    get dir4() {
        return this._dir4;
    },
    get dir8() {
        return this._dir8;
    },
    get date() {
        return this._date;
    },

    _isEscapeCompatible(keyName) {
        return keyName === "cancel" || keyName === "menu";
    },

    _setupEventHandlers() {
        document.addEventListener("keydown", e => this._onKeyDown(e));
        document.addEventListener("keyup", e => this._onKeyUp(e));
        window.addEventListener("blur", () => this.clear());
    },

    _onKeyDown(event) {
        if (this._shouldPreventDefault(event.keyCode)) event.preventDefault();
        if (event.keyCode === 144) {
            this.clear();
        }
        const buttonName = this.keyMapper[event.keyCode];
        if (buttonName) {
            if (!this._currentState[buttonName]) this._quickPresses.push(buttonName);
            this._currentState[buttonName] = true;
        }
    },

    _shouldPreventDefault(keyCode) {
        switch (keyCode) {
            case 8:
            case 9:
            case 33:
            case 34:
            case 37:
            case 38:
            case 39:
            case 40:
                return true;
        }
        return false;
    },

    _onKeyUp(event) {
        const buttonName = this.keyMapper[event.keyCode];
        if (buttonName) this._currentState[buttonName] = false;
    },

    _pollGamepads() {
        if (typeof navigator === "undefined" || !navigator.getGamepads) return;
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.connected) this._updateGamepadState(gamepad);
        }
    },

    _updateGamepadState(gamepad) {
        const lastState = this._gamepadStates[gamepad.index] || [];
        const newState = [];
        const buttons = gamepad.buttons;
        const axes = gamepad.axes;
        const threshold = 0.5;
        newState[12] = false;
        newState[13] = false;
        newState[14] = false;
        newState[15] = false;
        for (let i = 0; i < buttons.length; i++) newState[i] = buttons[i].pressed;
        if (axes[1] < -threshold) newState[12] = true;
        else if (axes[1] > threshold) newState[13] = true;
        if (axes[0] < -threshold) newState[14] = true;
        else if (axes[0] > threshold) newState[15] = true;
        for (let j = 0; j < newState.length; j++) {
            if (newState[j] !== lastState[j]) {
                const buttonName = this.gamepadMapper[j];
                if (buttonName) this._currentState[buttonName] = newState[j];
            }
        }
        this._gamepadStates[gamepad.index] = newState;
    },

    _updateDirection() {
        let x = this._signX();
        let y = this._signY();
        this._dir8 = this._makeNumpadDirection(x, y);
        if (x !== 0 && y !== 0) {
            if (this._preferredAxis === "x") y = 0;
            else x = 0;
        } else if (x !== 0) {
            this._preferredAxis = "y";
        } else if (y !== 0) {
            this._preferredAxis = "x";
        }
        this._dir4 = this._makeNumpadDirection(x, y);
    },

    _signX() {
        return (this.isPressed("left") ? -1 : 0) + (this.isPressed("right") ? 1 : 0);
    },

    _signY() {
        return (this.isPressed("up") ? -1 : 0) + (this.isPressed("down") ? 1 : 0);
    },

    _makeNumpadDirection(x, y) {
        if (x === 0 && y === 0) return 0;
        return 5 - y * 3 + x;
    }
};

//-----------------------------------------------------------------------------
// TouchInput — mouse, touch and wheel

var TouchInput = {
    keyRepeatWait: 24,
    keyRepeatInterval: 6,
    moveThreshold: 10,

    initialize() {
        this.clear();
        this._setupEventHandlers();
    },

    clear() {
        this._mousePressed = false;
        this._screenPressed = false;
        this._pressedTime = 0;
        this._clicked = false;
        this._newState = this._createNewState();
        this._currentState = this._createNewState();
        this._x = 0;
        this._y = 0;
        this._triggerX = 0;
        this._triggerY = 0;
        this._moved = false;
        this._date = 0;
    },

    update() {
        this._currentState = this._newState;
        this._newState = this._createNewState();
        this._clicked = this._currentState.released && !this._moved;
        if (this.isPressed()) this._pressedTime++;
    },

    isClicked() {
        return this._clicked;
    },
    isPressed() {
        return this._mousePressed || this._screenPressed;
    },
    isTriggered() {
        return this._currentState.triggered;
    },
    isRepeated() {
        return (
            this.isPressed() &&
            (this._currentState.triggered ||
                (this._pressedTime >= this.keyRepeatWait && this._pressedTime % this.keyRepeatInterval === 0))
        );
    },
    isLongPressed() {
        return this.isPressed() && this._pressedTime >= this.keyRepeatWait;
    },
    isCancelled() {
        return this._currentState.cancelled;
    },
    isMoved() {
        return this._currentState.moved;
    },
    isHovered() {
        return this._currentState.hovered;
    },
    isReleased() {
        return this._currentState.released;
    },
    get wheelX() {
        return this._currentState.wheelX;
    },
    get wheelY() {
        return this._currentState.wheelY;
    },
    get x() {
        return this._x;
    },
    get y() {
        return this._y;
    },
    get date() {
        return this._date;
    },

    _createNewState() {
        return {
            triggered: false,
            cancelled: false,
            moved: false,
            hovered: false,
            released: false,
            wheelX: 0,
            wheelY: 0
        };
    },

    _setupEventHandlers() {
        const pf = { passive: false };
        document.addEventListener("mousedown", e => this._onMouseDown(e));
        document.addEventListener("mousemove", e => this._onMouseMove(e));
        document.addEventListener("mouseup", e => this._onMouseUp(e));
        document.addEventListener("wheel", e => this._onWheel(e), pf);
        document.addEventListener("touchstart", e => this._onTouchStart(e), pf);
        document.addEventListener("touchmove", e => this._onTouchMove(e), pf);
        document.addEventListener("touchend", e => this._onTouchEnd(e));
        document.addEventListener("touchcancel", () => (this._screenPressed = false));
        document.addEventListener("contextmenu", e => e.preventDefault());
        window.addEventListener("blur", () => this.clear());
    },

    _onMouseDown(event) {
        if (event.button === 0) {
            const x = Graphics.pageToCanvasX(event.pageX);
            const y = Graphics.pageToCanvasY(event.pageY);
            if (Graphics.isInsideCanvas(x, y)) {
                this._mousePressed = true;
                this._pressedTime = 0;
                this._onTrigger(x, y);
            }
        } else if (event.button === 2) {
            const x = Graphics.pageToCanvasX(event.pageX);
            const y = Graphics.pageToCanvasY(event.pageY);
            if (Graphics.isInsideCanvas(x, y)) this._onCancel(x, y);
        }
    },

    _onMouseMove(event) {
        const x = Graphics.pageToCanvasX(event.pageX);
        const y = Graphics.pageToCanvasY(event.pageY);
        if (this._mousePressed) this._onMove(x, y);
        else if (Graphics.isInsideCanvas(x, y)) this._onHover(x, y);
    },

    _onMouseUp(event) {
        if (event.button === 0) {
            const x = Graphics.pageToCanvasX(event.pageX);
            const y = Graphics.pageToCanvasY(event.pageY);
            this._mousePressed = false;
            this._onRelease(x, y);
        }
    },

    _onWheel(event) {
        this._newState.wheelX += event.deltaX;
        this._newState.wheelY += event.deltaY;
        event.preventDefault();
    },

    _onTouchStart(event) {
        for (const touch of event.changedTouches) {
            const x = Graphics.pageToCanvasX(touch.pageX);
            const y = Graphics.pageToCanvasY(touch.pageY);
            if (Graphics.isInsideCanvas(x, y)) {
                this._screenPressed = true;
                this._pressedTime = 0;
                if (event.touches.length >= 2) this._onCancel(x, y);
                else this._onTrigger(x, y);
                event.preventDefault();
            }
        }
    },

    _onTouchMove(event) {
        for (const touch of event.changedTouches) {
            this._onMove(Graphics.pageToCanvasX(touch.pageX), Graphics.pageToCanvasY(touch.pageY));
        }
    },

    _onTouchEnd(event) {
        for (const touch of event.changedTouches) {
            this._screenPressed = false;
            this._onRelease(Graphics.pageToCanvasX(touch.pageX), Graphics.pageToCanvasY(touch.pageY));
        }
    },

    _onTrigger(x, y) {
        this._newState.triggered = true;
        this._x = x;
        this._y = y;
        this._triggerX = x;
        this._triggerY = y;
        this._moved = false;
        this._date = Date.now();
    },

    _onCancel(x, y) {
        this._newState.cancelled = true;
        this._x = x;
        this._y = y;
    },

    _onMove(x, y) {
        const dx = Math.abs(x - this._triggerX);
        const dy = Math.abs(y - this._triggerY);
        if (dx > this.moveThreshold || dy > this.moveThreshold) this._moved = true;
        if (this._moved) {
            this._newState.moved = true;
            this._x = x;
            this._y = y;
        }
    },

    _onHover(x, y) {
        this._newState.hovered = true;
        this._x = x;
        this._y = y;
    },

    _onRelease(x, y) {
        this._newState.released = true;
        this._x = x;
        this._y = y;
    }
};

//-----------------------------------------------------------------------------
// Bitmap — a canvas-backed image

var Bitmap = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize(width, height) {
        this._canvas = null;
        this._context = null;
        this._image = null;
        this._url = "";
        this._paintOpacity = 255;
        this._smooth = false;
        this._loadListeners = [];
        this._loadingState = "none";
        this._version = 0;
        if (width > 0 && height > 0) this._createCanvas(width, height);
        this.fontFace = "sans-serif";
        this.fontSize = 16;
        this.fontBold = false;
        this.fontItalic = false;
        this.textColor = "#ffffff";
        this.outlineColor = "rgba(0, 0, 0, 0.6)";
        this.outlineWidth = 3;
    }

    static load(url, fallback) {
        const bitmap = Object.create(Bitmap.prototype);
        bitmap.initialize();
        bitmap._url = url;
        bitmap._fallback = fallback || null;
        bitmap._startLoading();
        return bitmap;
    }

    static snap(stage) {
        const width = Graphics.width;
        const height = Graphics.height;
        const bitmap = new Bitmap(width, height);
        const ctx = bitmap.context;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        if (stage) stage.render(ctx);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        bitmap._version++;
        return bitmap;
    }

    static fromCanvas(canvas) {
        const bitmap = new Bitmap();
        bitmap._canvas = canvas;
        bitmap._context = canvas.getContext("2d");
        bitmap._loadingState = "loaded";
        return bitmap;
    }

    isReady() {
        return this._loadingState === "loaded" || this._loadingState === "none";
    }

    isError() {
        return this._loadingState === "error";
    }

    get url() {
        return this._url;
    }

    // The drawable source: the canvas if one exists, otherwise the image.
    get source() {
        return this._canvas || this._image;
    }

    get canvas() {
        this._ensureCanvas();
        return this._canvas;
    }

    get context() {
        this._ensureCanvas();
        return this._context;
    }

    get width() {
        const s = this.source;
        return s ? s.width : 0;
    }

    get height() {
        const s = this.source;
        return s ? s.height : 0;
    }

    get rect() {
        return new Rectangle(0, 0, this.width, this.height);
    }

    get smooth() {
        return this._smooth;
    }
    set smooth(value) {
        this._smooth = value;
    }

    get paintOpacity() {
        return this._paintOpacity;
    }
    set paintOpacity(value) {
        if (this._paintOpacity !== value) {
            this._paintOpacity = value;
            this.context.globalAlpha = value / 255;
        }
    }

    destroy() {
        this._canvas = null;
        this._context = null;
        this._image = null;
    }

    resize(width, height) {
        width = Math.max(width || 0, 1);
        height = Math.max(height || 0, 1);
        this._ensureCanvas();
        this._canvas.width = width;
        this._canvas.height = height;
        this._context.globalAlpha = this._paintOpacity / 255;
        this._context.imageSmoothingEnabled = this._smooth;
        this._version++;
    }

    // Call after drawing on bitmap.context directly (MZ: baseTexture.update()).
    update() {
        this._version++;
    }

    get baseTexture() {
        return { update: () => this.update() };
    }

    blt(source, sx, sy, sw, sh, dx, dy, dw, dh) {
        dw = dw || sw;
        dh = dh || sh;
        const img = source.source;
        if (!img || sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
        try {
            const ctx = this.context;
            ctx.imageSmoothingEnabled = this._smooth || source._smooth;
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            this._version++;
        } catch (e) {
            // Source outside bounds: ignore, matching MZ's tolerance.
        }
    }

    getPixel(x, y) {
        try {
            const data = this.context.getImageData(x, y, 1, 1).data;
            let result = "#";
            for (let i = 0; i < 3; i++) result += data[i].toString(16).padZero(2);
            return result;
        } catch (e) {
            return "#000000";
        }
    }

    getAlphaPixel(x, y) {
        try {
            return this.context.getImageData(x, y, 1, 1).data[3];
        } catch (e) {
            return 255;
        }
    }

    clearRect(x, y, width, height) {
        this.context.clearRect(x, y, width, height);
        this._version++;
    }

    clear() {
        this.clearRect(0, 0, this.width, this.height);
    }

    fillRect(x, y, width, height, color) {
        const ctx = this.context;
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
        this._version++;
    }

    fillAll(color) {
        this.fillRect(0, 0, this.width, this.height, color);
    }

    strokeRect(x, y, width, height, color) {
        const ctx = this.context;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, width, height);
        ctx.restore();
        this._version++;
    }

    gradientFillRect(x, y, width, height, color1, color2, vertical) {
        const ctx = this.context;
        const x1 = vertical ? x : x + width;
        const y1 = vertical ? y + height : y;
        const grad = ctx.createLinearGradient(x, y, x1, y1);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, width, height);
        ctx.restore();
        this._version++;
    }

    drawCircle(x, y, radius, color) {
        const ctx = this.context;
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.restore();
        this._version++;
    }

    drawText(text, x, y, maxWidth, lineHeight, align) {
        text = String(text);
        const ctx = this.context;
        const alpha = ctx.globalAlpha;
        maxWidth = maxWidth || 0xffffffff;
        let tx = x;
        const ty = Math.round(y + lineHeight / 2 + this.fontSize * 0.35);
        if (align === "center") tx += maxWidth / 2;
        if (align === "right") tx += maxWidth;
        ctx.save();
        ctx.font = this._makeFontNameText();
        ctx.textAlign = align || "left";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha = 1;
        this._drawTextOutline(text, tx, ty, maxWidth);
        ctx.globalAlpha = alpha;
        this._drawTextBody(text, tx, ty, maxWidth);
        ctx.restore();
        this._version++;
    }

    measureTextWidth(text) {
        const ctx = this.context;
        ctx.save();
        ctx.font = this._makeFontNameText();
        const width = ctx.measureText(String(text)).width;
        ctx.restore();
        return width;
    }

    addLoadListener(listener) {
        if (!this.isReady()) this._loadListeners.push(listener);
        else listener(this);
    }

    retry() {
        this._startLoading();
    }

    // Marks the bitmap as modified so sprites refresh cached tints.
    touch() {
        this._version++;
    }

    _makeFontNameText() {
        const italic = this.fontItalic ? "Italic " : "";
        const bold = this.fontBold ? "Bold " : "";
        return italic + bold + this.fontSize + "px " + this.fontFace;
    }

    _drawTextOutline(text, tx, ty, maxWidth) {
        if (this.outlineWidth <= 0) return;
        const ctx = this.context;
        ctx.strokeStyle = this.outlineColor;
        ctx.lineWidth = this.outlineWidth;
        ctx.lineJoin = "round";
        ctx.strokeText(text, tx, ty, maxWidth);
    }

    _drawTextBody(text, tx, ty, maxWidth) {
        const ctx = this.context;
        ctx.fillStyle = this.textColor;
        ctx.fillText(text, tx, ty, maxWidth);
    }

    _createCanvas(width, height) {
        this._canvas = document.createElement("canvas");
        this._context = this._canvas.getContext("2d");
        this._canvas.width = Math.max(width || 0, 1);
        this._canvas.height = Math.max(height || 0, 1);
        this._context.imageSmoothingEnabled = this._smooth;
        if (this._image) {
            this._context.drawImage(this._image, 0, 0);
            this._image = null;
        }
    }

    _ensureCanvas() {
        if (!this._canvas) {
            if (this._image) this._createCanvas(this._image.width, this._image.height);
            else this._createCanvas(1, 1);
        }
    }

    _startLoading() {
        this._image = new Image();
        this._image.onload = () => this._onLoad();
        this._image.onerror = () => this._onError();
        this._loadingState = "loading";
        this._image.src = this._url;
    }

    _onLoad() {
        this._loadingState = "loaded";
        this._version++;
        this._callLoadListeners();
    }

    _onError() {
        if (this._fallback) {
            const canvas = this._fallback();
            if (canvas) {
                this._image = null;
                this._canvas = canvas;
                this._context = canvas.getContext("2d");
                this._isFallback = true;
                this._loadingState = "loaded";
                this._version++;
                this._callLoadListeners();
                return;
            }
        }
        this._image = null;
        this._loadingState = "error";
        this._callLoadListeners();
    }

    _callLoadListeners() {
        while (this._loadListeners.length > 0) {
            const listener = this._loadListeners.shift();
            listener(this);
        }
    }
};

//-----------------------------------------------------------------------------
// Tint — applies MZ-style color tone and blend color on an offscreen canvas.
// Only compositing operations are used (no pixel readback), so images loaded
// from file:// work.

var Tint = {
    _filterSupported: null,

    isNeutral(tone, blend, hue) {
        return (
            (!tone || (tone[0] === 0 && tone[1] === 0 && tone[2] === 0 && !tone[3])) &&
            (!blend || !blend[3]) &&
            !hue
        );
    },

    filterSupported() {
        if (this._filterSupported === null) {
            try {
                const ctx = document.createElement("canvas").getContext("2d");
                this._filterSupported = typeof ctx.filter === "string";
            } catch (e) {
                this._filterSupported = false;
            }
        }
        return this._filterSupported;
    },

    // Draws source (sx,sy,sw,sh) into canvas and applies tone/blend/hue.
    render(canvas, source, sx, sy, sw, sh, tone, blend, hue) {
        if (canvas.width !== sw || canvas.height !== sh) {
            canvas.width = sw;
            canvas.height = sh;
        }
        const ctx = canvas.getContext("2d");
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, sw, sh);
        const gray = tone ? tone[3] || 0 : 0;
        const filters = [];
        if (hue && this.filterSupported()) filters.push("hue-rotate(" + hue + "deg)");
        if (gray > 0 && this.filterSupported()) filters.push("grayscale(" + gray / 255 + ")");
        if (filters.length) ctx.filter = filters.join(" ");
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
        if (filters.length) ctx.filter = "none";
        if (tone && (tone[0] || tone[1] || tone[2])) {
            this.applyTone(ctx, sw, sh, tone);
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
        }
        if (blend && blend[3] > 0) {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = "rgba(" + blend[0] + "," + blend[1] + "," + blend[2] + "," + blend[3] / 255 + ")";
            ctx.fillRect(0, 0, sw, sh);
        }
        ctx.globalCompositeOperation = "source-over";
    },

    // Applies the additive/subtractive part of a tone to an opaque area.
    applyTone(ctx, w, h, tone) {
        const r = tone[0], g = tone[1], b = tone[2];
        if (r > 0 || g > 0 || b > 0) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = Utils.rgbToCssColor(Math.max(r, 0), Math.max(g, 0), Math.max(b, 0));
            ctx.fillRect(0, 0, w, h);
        }
        if (r < 0 || g < 0 || b < 0) {
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = Utils.rgbToCssColor(255 + Math.min(r, 0), 255 + Math.min(g, 0), 255 + Math.min(b, 0));
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = "source-over";
    },

    // Applies a full-screen tone directly to an opaque target (the game canvas).
    applyScreenTone(ctx, x, y, w, h, tone) {
        if (!tone) return;
        const gray = tone[3] || 0;
        ctx.save();
        if (gray > 0) {
            ctx.globalCompositeOperation = "saturation";
            ctx.globalAlpha = gray / 255;
            ctx.fillStyle = "#808080";
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1;
        }
        const r = tone[0], g = tone[1], b = tone[2];
        if (r > 0 || g > 0 || b > 0) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = Utils.rgbToCssColor(Math.max(r, 0), Math.max(g, 0), Math.max(b, 0));
            ctx.fillRect(x, y, w, h);
        }
        if (r < 0 || g < 0 || b < 0) {
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = Utils.rgbToCssColor(255 + Math.min(r, 0), 255 + Math.min(g, 0), 255 + Math.min(b, 0));
            ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
    }
};

//-----------------------------------------------------------------------------
// Container — base display object with children

var Container = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this.children = [];
        this.parent = null;
        this.x = 0;
        this.y = 0;
        this.scale = new Point(1, 1);
        this.pivot = new Point(0, 0);
        this.skew = new Point(0, 0);
        this.rotation = 0;
        this.alpha = 1;
        this.visible = true;
        this.z = 0;
        this.spriteId = Container._counter++;
        this._destroyed = false;
        this.mask = null; // Rectangle in local coordinates used for clipping
    }

    get worldVisible() {
        let obj = this;
        while (obj) {
            if (!obj.visible) return false;
            obj = obj.parent;
        }
        return true;
    }

    get destroyed() {
        return this._destroyed;
    }

    get opacity() {
        return this.alpha * 255;
    }
    set opacity(value) {
        this.alpha = Math.max(0, Math.min(255, value)) / 255;
    }

    move(x, y) {
        this.x = x;
        this.y = y;
    }

    addChild(child) {
        if (arguments.length > 1) {
            for (let i = 0; i < arguments.length; i++) this.addChild(arguments[i]);
            return arguments[0];
        }
        if (child.parent) child.parent.removeChild(child);
        child.parent = this;
        this.children.push(child);
        return child;
    }

    addChildAt(child, index) {
        if (child.parent) child.parent.removeChild(child);
        child.parent = this;
        this.children.splice(index, 0, child);
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
            child.parent = null;
        }
        return child;
    }

    removeChildAt(index) {
        const child = this.children[index];
        if (child) this.removeChild(child);
        return child;
    }

    removeChildren() {
        const removed = this.children;
        for (const c of removed) c.parent = null;
        this.children = [];
        return removed;
    }

    getChildIndex(child) {
        return this.children.indexOf(child);
    }

    setChildIndex(child, index) {
        const i = this.children.indexOf(child);
        if (i >= 0) {
            this.children.splice(i, 1);
            this.children.splice(index, 0, child);
        }
    }

    sortChildren() {
        this.children.sort((a, b) => a.z - b.z || a.spriteId - b.spriteId);
    }

    destroy(options) {
        if (this._destroyed) return;
        this._destroyed = true;
        if (this.parent) this.parent.removeChild(this);
        for (const child of this.children.slice()) {
            if (child.destroy) child.destroy(options);
        }
        this.children = [];
    }

    update() {
        for (const child of this.children.slice()) {
            if (child.update) child.update();
        }
    }

    // Converts a point in this object's coordinates to global (canvas) space.
    // Rotation is ignored (as it is for hit testing in MZ's default windows).
    toGlobal(x, y) {
        let obj = this;
        let gx = x, gy = y;
        while (obj) {
            gx = (gx - obj.pivot.x) * obj.scale.x + obj.x;
            gy = (gy - obj.pivot.y) * obj.scale.y + obj.y;
            obj = obj.parent;
        }
        return new Point(gx, gy);
    }

    toLocal(point) {
        const chain = [];
        let obj = this;
        while (obj) {
            chain.unshift(obj);
            obj = obj.parent;
        }
        let x = point.x, y = point.y;
        for (const o of chain) {
            x = (x - o.x) / (o.scale.x || 1) + o.pivot.x;
            y = (y - o.y) / (o.scale.y || 1) + o.pivot.y;
        }
        return new Point(x, y);
    }

    // MZ/PIXI-compatible accessor: worldTransform.apply / applyInverse.
    get worldTransform() {
        const self = this;
        const origin = this.toGlobal(0, 0);
        return {
            tx: origin.x,
            ty: origin.y,
            apply: p => self.toGlobal(p.x, p.y),
            applyInverse: p => self.toLocal(p)
        };
    }

    render(ctx) {
        if (!this.visible || this.alpha <= 0 || this._destroyed) return;
        ctx.save();
        this._applyTransform(ctx);
        if (this.mask) {
            ctx.beginPath();
            ctx.rect(this.mask.x, this.mask.y, this.mask.width, this.mask.height);
            ctx.clip();
        }
        this._renderSelf(ctx);
        this._renderChildren(ctx);
        ctx.restore();
    }

    _applyTransform(ctx) {
        if (this.x || this.y) ctx.translate(this.x, this.y);
        if (this.rotation) ctx.rotate(this.rotation);
        if (this.skew.x || this.skew.y) ctx.transform(1, Math.tan(this.skew.y), Math.tan(this.skew.x), 1, 0, 0);
        if (this.scale.x !== 1 || this.scale.y !== 1) ctx.scale(this.scale.x, this.scale.y);
        if (this.pivot.x || this.pivot.y) ctx.translate(-this.pivot.x, -this.pivot.y);
        if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
    }

    _renderSelf(/* ctx */) {}

    _renderChildren(ctx) {
        const children = this.children;
        for (let i = 0; i < children.length; i++) children[i].render(ctx);
    }
};
Container._counter = 0;

// Stage is the root container of a scene (same role as MZ's Stage).
var Stage = class extends Container {};

//-----------------------------------------------------------------------------
// Sprite

var Sprite = class extends Container {
    initialize(bitmap) {
        super.initialize();
        this._bitmap = null;
        this._frame = new Rectangle();
        this._realFrame = new Rectangle();
        this._frameSet = false;
        this.anchor = new Point(0, 0);
        this._blendColor = [0, 0, 0, 0];
        this._colorTone = [0, 0, 0, 0];
        this._hue = 0;
        this.blendMode = 0;
        this._tintCanvas = null;
        this._tintKey = "";
        this._hidden = false;
        this.bitmap = bitmap || null;
    }

    get bitmap() {
        return this._bitmap;
    }
    set bitmap(value) {
        if (this._bitmap !== value) {
            this._bitmap = value;
            if (value) {
                if (!this._frameSet) this._frame = new Rectangle();
                value.addLoadListener(() => this._onBitmapLoad(value));
            } else {
                this._frame = new Rectangle();
                this._frameSet = false;
            }
        }
    }

    get width() {
        return this._frame.width * Math.abs(this.scale.x);
    }
    set width(value) {
        const w = this._frame.width || 1;
        this.scale.x = (Math.sign(this.scale.x) || 1) * (value / w);
    }
    get height() {
        return this._frame.height * Math.abs(this.scale.y);
    }
    set height(value) {
        const h = this._frame.height || 1;
        this.scale.y = (Math.sign(this.scale.y) || 1) * (value / h);
    }

    destroy(options) {
        super.destroy(options);
        this._bitmap = null;
        this._tintCanvas = null;
    }

    update() {
        super.update();
    }

    hide() {
        this._hidden = true;
        this.visible = false;
    }
    show() {
        this._hidden = false;
        this.visible = true;
    }
    updateVisibility() {
        this.visible = !this._hidden;
    }

    setFrame(x, y, width, height) {
        this._frameSet = true;
        const f = this._frame;
        if (x !== f.x || y !== f.y || width !== f.width || height !== f.height) {
            f.x = x;
            f.y = y;
            f.width = width;
            f.height = height;
        }
    }

    setHue(hue) {
        this._hue = Number(hue) || 0;
    }
    getBlendColor() {
        return this._blendColor.clone();
    }
    setBlendColor(color) {
        if (!(color instanceof Array)) throw new Error("Argument must be an array");
        if (!this._blendColor.equals(color)) this._blendColor = color.clone();
    }
    getColorTone() {
        return this._colorTone.clone();
    }
    setColorTone(tone) {
        if (!(tone instanceof Array)) throw new Error("Argument must be an array");
        if (!this._colorTone.equals(tone)) this._colorTone = tone.clone();
    }

    // Hit testing helper for clickable sprites (global coordinates).
    hitTest(x, y) {
        const p = this.toLocal(new Point(x, y));
        const w = this._frame.width;
        const h = this._frame.height;
        const left = -this.anchor.x * w;
        const top = -this.anchor.y * h;
        return p.x >= left && p.x < left + w && p.y >= top && p.y < top + h;
    }

    _onBitmapLoad(bitmapLoaded) {
        if (bitmapLoaded === this._bitmap && !this._frameSet) {
            this._frame = new Rectangle(0, 0, bitmapLoaded.width, bitmapLoaded.height);
        }
    }

    _renderSelf(ctx) {
        const bitmap = this._bitmap;
        if (!bitmap || !bitmap.isReady()) return;
        let src = bitmap.source;
        if (!src) return;
        const f = this._frame;
        let sx = f.x, sy = f.y, sw = f.width, sh = f.height;
        // Clip to bitmap bounds
        if (sx < 0) {
            sw += sx;
            sx = 0;
        }
        if (sy < 0) {
            sh += sy;
            sy = 0;
        }
        sw = Math.min(sw, src.width - sx);
        sh = Math.min(sh, src.height - sy);
        if (sw <= 0 || sh <= 0) return;
        const dx = -this.anchor.x * f.width + (sx - f.x);
        const dy = -this.anchor.y * f.height + (sy - f.y);
        if (!Tint.isNeutral(this._colorTone, this._blendColor, this._hue)) {
            src = this._tintedSource(bitmap, sx, sy, sw, sh);
            sx = 0;
            sy = 0;
        }
        ctx.imageSmoothingEnabled = bitmap._smooth;
        const op = Sprite.BLEND_OPS[this.blendMode] || "source-over";
        if (op !== "source-over") {
            const prev = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = op;
            ctx.drawImage(src, sx, sy, sw, sh, dx, dy, sw, sh);
            ctx.globalCompositeOperation = prev;
        } else {
            ctx.drawImage(src, sx, sy, sw, sh, dx, dy, sw, sh);
        }
    }

    _tintedSource(bitmap, sx, sy, sw, sh) {
        const key =
            bitmap._version + "|" + sx + "," + sy + "," + sw + "," + sh + "|" +
            this._colorTone.join(",") + "|" + this._blendColor.join(",") + "|" + this._hue + "|" + (bitmap._url || "");
        if (!this._tintCanvas) this._tintCanvas = document.createElement("canvas");
        if (this._tintKey !== key || this._tintBitmap !== bitmap) {
            Tint.render(this._tintCanvas, bitmap.source, sx, sy, sw, sh, this._colorTone, this._blendColor, this._hue);
            this._tintKey = key;
            this._tintBitmap = bitmap;
        }
        return this._tintCanvas;
    }
};
Sprite.BLEND_OPS = ["source-over", "lighter", "multiply", "screen"];
// MZ-compatible blend mode constants
var BLEND_MODES = { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 };

//-----------------------------------------------------------------------------
// ScreenSprite / ColorRect — solid colour overlays

var ScreenSprite = class extends Container {
    initialize() {
        super.initialize();
        this._red = 0;
        this._green = 0;
        this._blue = 0;
        this.blendMode = 0;
        this.opacity = 0;
    }
    setBlack() {
        this.setColor(0, 0, 0);
    }
    setWhite() {
        this.setColor(255, 255, 255);
    }
    setColor(r, g, b) {
        this._red = Math.round(r || 0).clamp(0, 255);
        this._green = Math.round(g || 0).clamp(0, 255);
        this._blue = Math.round(b || 0).clamp(0, 255);
    }
    _renderSelf(ctx) {
        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = Sprite.BLEND_OPS[this.blendMode] || "source-over";
        ctx.fillStyle = Utils.rgbToCssColor(this._red, this._green, this._blue);
        ctx.fillRect(-50000, -50000, 100000, 100000);
        ctx.globalCompositeOperation = prev;
    }
};

// ToneLayer — applies a full-screen color tone to whatever was drawn beneath
// it within the same parent (replaces MZ's ColorFilter on the base layer).
var ToneLayer = class extends Container {
    initialize(width, height) {
        super.initialize();
        this._tone = [0, 0, 0, 0];
        this._flash = [0, 0, 0, 0];
        this._w = width || Graphics.width;
        this._h = height || Graphics.height;
    }
    setTone(tone) {
        this._tone = tone ? tone.slice() : [0, 0, 0, 0];
    }
    setBlendColor(color) {
        this._flash = color ? color.slice() : [0, 0, 0, 0];
    }
    _renderSelf(ctx) {
        const t = this._tone;
        if (t[0] || t[1] || t[2] || t[3]) Tint.applyScreenTone(ctx, 0, 0, this._w, this._h, t);
        const f = this._flash;
        if (f[3] > 0) {
            ctx.save();
            ctx.globalAlpha *= f[3] / 255;
            ctx.fillStyle = Utils.rgbToCssColor(f[0], f[1], f[2]);
            ctx.fillRect(0, 0, this._w, this._h);
            ctx.restore();
        }
    }
};

//-----------------------------------------------------------------------------
// TilingSprite — repeats a bitmap (parallaxes, title backgrounds)

var TilingSprite = class extends Container {
    initialize(bitmap) {
        super.initialize();
        this._bitmap = null;
        this._width = 0;
        this._height = 0;
        this.origin = new Point();
        this._pattern = null;
        this._patternKey = null;
        this.bitmap = bitmap || null;
    }
    get bitmap() {
        return this._bitmap;
    }
    set bitmap(value) {
        this._bitmap = value;
        this._pattern = null;
    }
    get width() {
        return this._width;
    }
    set width(v) {
        this._width = v;
    }
    get height() {
        return this._height;
    }
    set height(v) {
        this._height = v;
    }
    move(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        this._width = width || 0;
        this._height = height || 0;
    }
    setFrame() {}
    _renderSelf(ctx) {
        const bitmap = this._bitmap;
        if (!bitmap || !bitmap.isReady() || !bitmap.source) return;
        const bw = bitmap.width, bh = bitmap.height;
        if (bw <= 0 || bh <= 0 || this._width <= 0 || this._height <= 0) return;
        const key = bitmap._version + "|" + bitmap._url;
        if (!this._pattern || this._patternKey !== key || this._patternCtx !== ctx) {
            this._pattern = ctx.createPattern(bitmap.source, "repeat");
            this._patternKey = key;
            this._patternCtx = ctx;
        }
        const ox = (this.origin.x % bw + bw) % bw;
        const oy = (this.origin.y % bh + bh) % bh;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this._width, this._height);
        ctx.clip();
        ctx.translate(-ox, -oy);
        ctx.fillStyle = this._pattern;
        ctx.fillRect(0, 0, this._width + ox, this._height + oy);
        ctx.restore();
    }
};
