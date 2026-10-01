// Loads runtime classic scripts into an isolated vm context with light DOM
// stubs, so unit tests exercise the real game code headlessly.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../runtime/js");

function makeCanvasStub() {
    const ctx = new Proxy(
        { canvas: null, globalAlpha: 1, globalCompositeOperation: "source-over", measureText: t => ({ width: String(t).length * 8 }), getImageData: () => ({ data: [0, 0, 0, 255] }), createLinearGradient: () => ({ addColorStop() {} }), createPattern: () => ({}) },
        { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) }
    );
    const canvas = { width: 1, height: 1, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    ctx.canvas = canvas;
    return canvas;
}

export function createContext(extra = {}) {
    const elements = [];
    const document = {
        createElement: tag => (tag === "canvas" ? makeCanvasStub() : { style: {}, appendChild() {}, canPlayType: () => "probably", setAttribute() {} }),
        addEventListener() {},
        body: { appendChild: el => elements.push(el) },
        head: { appendChild: el => elements.push(el) },
        fonts: null
    };
    const context = {
        console,
        document,
        location: { search: "", protocol: "http:" },
        navigator: { userAgent: "node", getGamepads: () => [] },
        performance: { now: () => Date.now() },
        requestAnimationFrame: () => 0,
        setTimeout,
        clearTimeout,
        Image: class { set src(v) { this._src = v; } },
        localStorage: (() => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: k => delete s[k] }; })(),
        innerWidth: 816,
        innerHeight: 624,
        addEventListener() {},
        ...extra
    };
    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    return context;
}

export function loadRuntime(files = ["rpg9k_core.js", "rpg9k_tilemap.js"], context = createContext()) {
    for (const file of files) {
        const code = fs.readFileSync(path.join(root, file), "utf8");
        vm.runInContext(code, context, { filename: file });
    }
    return context;
}
