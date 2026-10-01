// Builds templates/data from the RTP (assets/) so new projects get real
// tileset passability flags and the stock animation list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "assets", "data");
const dst = path.join(root, "templates", "data");
fs.mkdirSync(dst, { recursive: true });

const tilesets = JSON.parse(fs.readFileSync(path.join(src, "Tilesets.json"), "utf8"));
// Keep the stock RTP tilesets only (1-6).
const stock = [null, ...tilesets.slice(1, 7).map((t, i) => ({ ...t, id: i + 1, note: "" }))];
fs.writeFileSync(path.join(dst, "Tilesets.json"), JSON.stringify(stock));

const animations = JSON.parse(fs.readFileSync(path.join(src, "Animations.json"), "utf8"));
fs.writeFileSync(path.join(dst, "Animations.json"), JSON.stringify(animations));

console.log("templates: %d tilesets, %d animations", stock.length - 1, animations.length - 1);
