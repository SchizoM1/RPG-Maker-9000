// headerParser.js — parses RPG Maker MZ/MV-style plugin annotation blocks.
//
//   /*: ... */            default language block
//   /*:ja ... */          localized block (used when no default exists)
//   /*~struct~Name: ... */ structure definitions for struct<Name> params
//
// Supported tags: @target @plugindesc @author @url @help @base @orderAfter
// @orderBefore @requiredAssets @noteParam @param @text @desc @type @default
// @min @max @decimals @option @value @on @off @dir @require @parent
// @command @arg

const BLOCK_RE = /\/\*(:|~struct~([\w$]+):)([a-zA-Z_-]*)\s*\n?([\s\S]*?)\*\//g;

function stripStars(body) {
    return body
        .split(/\r?\n/)
        .map(line => line.replace(/^\s*\*\s?/, ""))
        .map(line => line.replace(/\s+$/, ""));
}

function newEntry(name) {
    return { name, text: "", desc: "", type: "string", default: "", options: [], min: null, max: null, decimals: 0, on: "", off: "", dir: "", require: false, parent: "" };
}

// Parses one annotation block body into {meta, params, commands}.
function parseBlock(lines) {
    const meta = { target: "", plugindesc: "", author: "", url: "", help: "", base: [], orderAfter: [], orderBefore: [], requiredAssets: [] };
    const params = [];
    const commands = [];
    let current = null; // param, command, or arg receiving attributes
    let currentCommand = null;
    let textTarget = null; // {obj, key} for multi-line continuation
    for (const raw of lines) {
        const m = /^@(\w+)\s*(.*)$/.exec(raw.trim());
        if (!m) {
            if (textTarget) {
                const prev = textTarget.obj[textTarget.key];
                textTarget.obj[textTarget.key] = prev ? prev + "\n" + raw : raw;
            }
            continue;
        }
        const tag = m[1];
        const value = m[2];
        textTarget = null;
        switch (tag) {
            case "target":
                meta.target = value.trim();
                break;
            case "plugindesc":
                meta.plugindesc = value;
                break;
            case "author":
                meta.author = value;
                break;
            case "url":
                meta.url = value.trim();
                break;
            case "help":
                meta.help = value;
                textTarget = { obj: meta, key: "help" };
                current = null;
                currentCommand = null;
                break;
            case "base":
                meta.base.push(value.trim());
                break;
            case "orderAfter":
                meta.orderAfter.push(value.trim());
                break;
            case "orderBefore":
                meta.orderBefore.push(value.trim());
                break;
            case "requiredAssets":
                meta.requiredAssets.push(value.trim());
                break;
            case "param":
                current = newEntry(value.trim());
                params.push(current);
                currentCommand = null;
                break;
            case "command":
                currentCommand = { name: value.trim(), text: "", desc: "", args: [] };
                commands.push(currentCommand);
                current = currentCommand;
                break;
            case "arg":
                if (currentCommand) {
                    current = newEntry(value.trim());
                    currentCommand.args.push(current);
                }
                break;
            case "text":
                if (current) current.text = value;
                break;
            case "desc":
                if (current) {
                    current.desc = value;
                    textTarget = { obj: current, key: "desc" };
                }
                break;
            case "type":
                if (current) current.type = value.trim();
                break;
            case "default":
                if (current) current.default = value;
                break;
            case "min":
                if (current) current.min = Number(value);
                break;
            case "max":
                if (current) current.max = Number(value);
                break;
            case "decimals":
                if (current) current.decimals = Number(value) || 0;
                break;
            case "option":
                if (current) current.options.push({ label: value, value: value });
                break;
            case "value":
                if (current && current.options.length) current.options[current.options.length - 1].value = value;
                break;
            case "on":
                if (current) current.on = value;
                break;
            case "off":
                if (current) current.off = value;
                break;
            case "dir":
                if (current) current.dir = value.trim().replace(/\/?$/, "/");
                break;
            case "require":
                if (current) current.require = value.trim() !== "0";
                break;
            case "parent":
                if (current) current.parent = value.trim();
                break;
        }
    }
    // Trim trailing blank lines of help/desc.
    meta.help = meta.help.replace(/\s+$/, "");
    for (const p of params) p.desc = p.desc.replace(/\s+$/, "");
    return { meta, params, commands };
}

// Parses a whole plugin file. Returns null if it has no annotation block.
export function parsePluginHeader(source, name = "") {
    const blocks = { main: {}, structs: {} };
    let match;
    BLOCK_RE.lastIndex = 0;
    while ((match = BLOCK_RE.exec(source))) {
        const lang = match[3] || "";
        const lines = stripStars(match[4]);
        if (match[2]) {
            if (!blocks.structs[match[2]]) blocks.structs[match[2]] = {};
            blocks.structs[match[2]][lang] = parseBlock(lines).params;
        } else {
            blocks.main[lang] = parseBlock(lines);
        }
    }
    const langs = Object.keys(blocks.main);
    if (!langs.length) return null;
    const pick = obj => (obj[""] !== undefined ? obj[""] : obj[Object.keys(obj)[0]]);
    const main = pick(blocks.main);
    const structs = {};
    for (const [structName, byLang] of Object.entries(blocks.structs)) structs[structName] = pick(byLang);
    return {
        name,
        target: main.meta.target,
        description: main.meta.plugindesc,
        author: main.meta.author,
        url: main.meta.url,
        help: main.meta.help,
        base: main.meta.base,
        orderAfter: main.meta.orderAfter,
        orderBefore: main.meta.orderBefore,
        requiredAssets: main.meta.requiredAssets,
        params: main.params,
        commands: main.commands,
        structs
    };
}

// Type helpers --------------------------------------------------------------

export function parseType(type) {
    let t = (type || "string").trim();
    let array = 0;
    while (t.endsWith("[]")) {
        array++;
        t = t.slice(0, -2);
    }
    const struct = /^struct<([\w$]+)>$/.exec(t);
    return { base: struct ? "struct" : t, struct: struct ? struct[1] : null, array };
}

// Default parameter values as the MZ editor stores them (all strings).
export function defaultParameters(entries) {
    const out = {};
    for (const p of entries || []) out[p.name] = p.default != null ? String(p.default) : "";
    return out;
}

// Fills in missing parameters with defaults and drops unknown ones only if
// they aren't declared (kept, since plugins may read them directly).
export function mergeParameters(entries, current) {
    const merged = defaultParameters(entries);
    for (const [k, v] of Object.entries(current || {})) merged[k] = v;
    return merged;
}

// Builds a parameter tree using @parent for display grouping.
export function parameterTree(entries) {
    const byName = new Map(entries.map(p => [p.name, { param: p, children: [] }]));
    const roots = [];
    for (const node of byName.values()) {
        const parent = node.param.parent && byName.get(node.param.parent);
        if (parent && parent !== node) parent.children.push(node);
        else roots.push(node);
    }
    return roots;
}

// Display text for a stored value.
export function displayValue(entry, value, lookup) {
    const { base, array } = parseType(entry.type);
    if (array) {
        try {
            const arr = JSON.parse(value || "[]");
            return "[" + arr.length + " item" + (arr.length === 1 ? "" : "s") + "]";
        } catch (e) {
            return value;
        }
    }
    if (base === "struct") return value ? "{…}" : "";
    if (base === "boolean") {
        const on = value === "true";
        return on ? entry.on || "true" : entry.off || "false";
    }
    if (base === "select") {
        const opt = entry.options.find(o => o.value === value);
        return opt ? opt.label : value;
    }
    if (base === "note" || base === "multiline_string") {
        let text = value;
        if (base === "note") {
            try {
                text = JSON.parse(value);
            } catch (e) {
                // raw
            }
        }
        return String(text).split("\n")[0] + (String(text).includes("\n") ? " …" : "");
    }
    if (lookup && ["actor", "class", "skill", "item", "weapon", "armor", "enemy", "troop", "state", "animation", "tileset", "common_event", "switch", "variable"].includes(base)) {
        return lookup(base, Number(value)) || value;
    }
    return value;
}

// Dependency/order warnings for a plugin list (array of {name,status,...})
// with parsed headers in `headers` (name -> header).
export function checkPluginOrder(list, headers) {
    const warnings = [];
    const enabled = list.filter(p => p.status);
    const index = new Map(enabled.map((p, i) => [p.name, i]));
    for (const p of enabled) {
        const hdr = headers[p.name];
        if (!hdr) continue;
        for (const base of hdr.base) {
            if (!index.has(base)) warnings.push({ plugin: p.name, message: 'Requires "' + base + '", which is missing or disabled.' });
            else if (index.get(base) > index.get(p.name)) warnings.push({ plugin: p.name, message: 'Must be placed below "' + base + '".' });
        }
        for (const after of hdr.orderAfter) {
            if (index.has(after) && index.get(after) > index.get(p.name)) warnings.push({ plugin: p.name, message: 'Should be placed below "' + after + '".' });
        }
        for (const before of hdr.orderBefore) {
            if (index.has(before) && index.get(before) < index.get(p.name)) warnings.push({ plugin: p.name, message: 'Should be placed above "' + before + '".' });
        }
    }
    return warnings;
}
