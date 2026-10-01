// images.js — loads project images as runtime Bitmaps (shared with the
// runtime's Tilemap drawing code), with cache busting after imports.
import { projectUrl } from "./api.js";

const cache = new Map();
let version = 0;
const listeners = new Set();

export function loadImage(folder, name) {
    if (!name) return null;
    const rel = "img/" + folder + "/" + name + ".png";
    const key = rel + "?" + version;
    if (!cache.has(key)) {
        const url = projectUrl(rel) + "?v=" + version;
        const fallback = window.Fallbacks ? window.Fallbacks.forUrl(rel) : null;
        const bitmap = window.Bitmap.load(url, fallback);
        bitmap.addLoadListener(() => listeners.forEach(fn => fn(bitmap)));
        cache.set(key, bitmap);
    }
    return cache.get(key);
}

// Resolves when the bitmap is ready (or failed).
export function whenReady(bitmap) {
    return new Promise(resolve => {
        if (!bitmap) return resolve(null);
        bitmap.addLoadListener(() => resolve(bitmap));
    });
}

export function onImageLoaded(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function invalidateImages() {
    version++;
    cache.clear();
}

export function tilesetBitmaps(tileset) {
    if (!tileset) return [];
    return tileset.tilesetNames.map(name => (name ? loadImage("tilesets", name) : null));
}

// Returns a canvas with the character's standing frame (direction/pattern).
export function characterFrame(name, index, direction = 2, pattern = 1) {
    const bitmap = loadImage("characters", name);
    if (!bitmap || !bitmap.isReady() || !bitmap.source) return null;
    const big = /^[!$]*\$/.test(name) || (name.match(/^[!$]+/) || [""])[0].includes("$");
    const pw = bitmap.width / (big ? 3 : 12);
    const ph = bitmap.height / (big ? 4 : 8);
    const n = big ? 0 : index;
    const sx = ((n % 4) * 3 + pattern) * pw;
    const sy = (Math.floor(n / 4) * 4 + (direction - 2) / 2) * ph;
    return { source: bitmap.source, sx, sy, sw: pw, sh: ph };
}
