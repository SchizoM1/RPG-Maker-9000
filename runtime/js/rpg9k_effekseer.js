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
        const gl = this._canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true });
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
        const handle = this._context.play(holder.effect, 0, 0, 0);
        const self = this;
        return {
            _handle: handle,
            _mirror: false,
            get exists() {
                return handle.exists;
            },
            setGeometry(x, y, scale, mirror, rx, ry, rz, speed) {
                this._mirror = mirror < 0;
                handle.setLocation(0, 0, 0);
                handle.setScale(scale, scale, scale);
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

    // Same camera as MZ: a perspective projection over a VIEWPORT-sized GL
    // viewport centred on the effect, so 1 world unit ≈ screen height / 20 px.
    // The effect is drawn into a screen-sized WebGL canvas, then copied onto
    // the 2D canvas. ctx2d's transform gives the effect's screen position.
    VIEWPORT: 4096,

    _renderHandle(ctx2d, h) {
        const gl = this._gl;
        const canvas = this._canvas;
        const w = Graphics.width, hgt = Graphics.height;
        if (canvas.width !== w || canvas.height !== hgt) {
            canvas.width = w;
            canvas.height = hgt;
        }
        const t = ctx2d.getTransform();
        const v = this.VIEWPORT;
        // GL viewports are measured from the bottom edge.
        gl.viewport(t.e - v / 2, hgt - t.f - v / 2, v, v);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const x = h._mirror ? -1 : 1;
        const p = -(v / hgt);
        this._context.setProjectionMatrix([x, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, p, 0, 0, 0, 1]);
        this._context.setCameraMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
        // drawHandle draws nothing outside a beginDraw/endDraw pair.
        if (this._context.beginDraw) this._context.beginDraw();
        this._context.drawHandle(h._handle);
        if (this._context.endDraw) this._context.endDraw();
        gl.flush();
        ctx2d.save();
        ctx2d.setTransform(1, 0, 0, 1, 0, 0);
        ctx2d.drawImage(canvas, 0, 0);
        ctx2d.restore();
    }
};
