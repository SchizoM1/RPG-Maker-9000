// Usage: node tools/make-project.mjs <dir> [title] [--copy]
// Creates a starter project. RTP folders are symlinked unless --copy is given.
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { createProject } = require("../electron/lib/projectTemplate.js");

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const copy = process.argv.includes("--copy");
const dir = path.resolve(args[0] || "tests/.tmp/sample");
const title = args[1] || "Sample Game";
if (process.argv.includes("--force")) fs.rmSync(dir, { recursive: true, force: true });
await createProject(dir, { title, link: !copy });
console.log("Created project at", dir);
