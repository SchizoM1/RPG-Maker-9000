//=============================================================================
// rpg9k_effekseer.js — optional Effekseer bridge for MZ-format animations.
// If js/libs/effekseer.min.js and effekseer.wasm are present, effects are
// rendered on an offscreen WebGL canvas and composited into the 2D canvas.
// Otherwise Sprite_Animation falls back to sound/flash timings only.
//=============================================================================
"use strict";

var EffekseerRenderer = {
    _ready: false,
    _context: null,
    _canvas: null,
    _gl: null,
    _effects: {},

    // Resolves once the runtime is available (or determined missing).
    initialize() {
        if (typeof document === "undefined") return Promise.resolve();
        // WebAssembly can't be fetched from file:// pages; skip Effekseer there.
        if (Utils.isLocal()) return Promise.resolve();
        return this._loadScript("js/libs/effekseer.min.js")
            .then(() => this._initRuntime())
            .then(() => this._createContext())
            .catch(() => {
                this._ready = false;
            });
    },

    isReady() {
        return this._ready;
    },

    _loadScript(url) {
        return new Promise((resolve, reject) => {
            if (typeof effekseer !== "undefined") return resolve();
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Effekseer runtime not found"));
            document.body.appendChild(script);
        });
    },

    _initRuntime() {
        return new Promise((resolve, reject) => {
            if (typeof effekseer === "undefined") return reject(new Error("no effekseer"));
            effekseer.initRuntime("js/libs/effekseer.wasm", resolve, reject);
        });
    },

    _createContext() {
        this._canvas = document.createElement("canvas");
        this._canvas.width = Graphics.width;
        this._canvas.height = Graphics.height;
        const gl = this._canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, preserveDrawingBuffer: true });
        if (!gl) throw new Error("WebGL unavailable");
        this._gl = gl;
        this._context = effekseer.createContext();
        this._context.init(gl);
        this._ready = true;
    },

    loadEffect(url) {
        if (!this._ready) return null;
        const holder = { isLoaded: false, effect: null, url: url };
        holder.effect = this._context.loadEffect(
            url,
            1,
            () => (holder.isLoaded = true),
            () => (holder.isLoaded = false)
        );
        this._effects[url] = holder;
        return holder;
    },

    isEffectsReady(cache) {
        return true;
    },

    update() {
        if (this._ready) this._context.update();
    },

    // Returns a handle-like object used by Sprite_Animation.
    play(holder, sprite) {
        if (!this._ready || !holder || !holder.effect) return null;
        const ctx = this._context;
        const handle = ctx.play(holder.effect, 0, 0, 0);
        const self = this;
        return {
            _handle: handle,
            _x: 0,
            _y: 0,
            get exists() {
                return handle.exists;
            },
            setGeometry(x, y, scale, mirror, rx, ry, rz, speed) {
                this._x = x;
                this._y = y;
                handle.setScale(scale * mirror, scale, scale);
                handle.setRotation(rx, ry, rz);
                handle.setSpeed(speed);
            },
            stop() {
                handle.stop();
            },
            render(ctx2d) {
                self._renderHandle(ctx2d, this);
            }
        };
    },

    _renderHandle(ctx2d, h) {
        const gl = this._gl;
        const canvas = this._canvas;
        if (canvas.width !== Graphics.width || canvas.height !== Graphics.height) {
            canvas.width = Graphics.width;
            canvas.height = Graphics.height;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const w = canvas.width, hgt = canvas.height;
        // Orthographic projection in pixel units, origin at the effect.
        const sx = 2 / w, sy = 2 / hgt;
        this._context.setProjectionMatrix([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, -0.001, 0, 0, 0, 0, 1]);
        this._context.setCameraMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
        this._context.drawHandle ? this._context.drawHandle(h._handle) : this._context.draw();
        ctx2d.save();
        ctx2d.drawImage(canvas, -w / 2, -hgt / 2);
        ctx2d.restore();
    }
};
