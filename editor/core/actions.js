// actions.js — named editor actions shared by menus, toolbar and shortcuts.
export class ActionRegistry {
    constructor() {
        this.actions = new Map();
        this.shortcuts = new Map();
    }

    // def: {id, label, shortcut ("Ctrl+S", "F9"), run(), enabled(), checked(), icon}
    register(def) {
        this.actions.set(def.id, def);
        if (def.shortcut) this.shortcuts.set(normalizeShortcut(def.shortcut), def.id);
        return def;
    }

    get(id) {
        return this.actions.get(id);
    }

    run(id) {
        const a = this.actions.get(id);
        if (a && this.isEnabled(id)) return a.run();
    }

    isEnabled(id) {
        const a = this.actions.get(id);
        return !!a && (!a.enabled || a.enabled());
    }

    isChecked(id) {
        const a = this.actions.get(id);
        return !!a && !!a.checked && a.checked();
    }

    menuItem(id, overrides = {}) {
        const a = this.actions.get(id);
        return {
            id,
            label: a.label,
            shortcut: a.shortcut,
            action: () => this.run(id),
            enabled: () => this.isEnabled(id),
            checked: a.checked ? () => a.checked() : undefined,
            ...overrides
        };
    }

    handleKey(e) {
        const key = eventToShortcut(e);
        const id = this.shortcuts.get(key);
        if (id) {
            e.preventDefault();
            this.run(id);
            return true;
        }
        return false;
    }
}

export function normalizeShortcut(s) {
    const parts = s.split("+").map(p => p.trim());
    const key = parts.pop();
    const mods = parts.map(p => p.toLowerCase()).sort();
    return [...mods, key.length === 1 ? key.toUpperCase() : key].join("+");
}

export function eventToShortcut(e) {
    const mods = [];
    if (e.altKey) mods.push("alt");
    if (e.ctrlKey || e.metaKey) mods.push("ctrl");
    if (e.shiftKey) mods.push("shift");
    let key = e.key;
    if (key === " ") key = "Space";
    if (key.length === 1) key = key.toUpperCase();
    return [...mods.sort(), key].join("+");
}
