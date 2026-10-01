// widgets.js — list box, tree, tabs, form fields, split panes.
import { h, clear } from "./dom.js";

//-----------------------------------------------------------------------------
// ListBox: keyboard-navigable single/multi select list.
// items: array of {label, value?, dim?, className?}, or {cells: [...]} with
// options.columns = [widths] (last column takes the rest) and an optional
// options.header = [titles].

export class ListBox {
    constructor(options = {}) {
        this.options = options;
        this.items = [];
        this.index = -1;
        this.anchor = -1;
        this.selection = new Set();
        this.el = h("div", { class: "listbox " + (options.className || ""), tabIndex: 0 });
        if (options.height) this.el.style.height = options.height + "px";
        this.el.addEventListener("keydown", e => this.onKey(e));
    }

    setItems(items, keepIndex = true) {
        this.items = items;
        if (!keepIndex) this.index = items.length ? 0 : -1;
        this.index = Math.min(this.index, items.length - 1);
        if (this.index < 0 && items.length && this.options.autoSelect !== false) this.index = 0;
        this.selection = new Set(this.index >= 0 ? [this.index] : []);
        this.render();
    }

    renderCells(cells) {
        const widths = this.options.columns || [];
        return cells.map((c, j) => h("span", { class: "cell", style: j < widths.length && j < cells.length - 1 ? { width: widths[j] + "px" } : { flex: "1" } }, c));
    }

    render() {
        clear(this.el);
        if (this.options.header) this.el.appendChild(h("div", { class: "list-header" }, this.renderCells(this.options.header)));
        this.rows = this.items.map((item, i) => {
            const row = h(
                "div",
                {
                    class: "list-row" + (item.dim ? " dim" : "") + (item.className ? " " + item.className : "") + (this.selection.has(i) ? " selected" : ""),
                    dataset: { index: i }
                },
                item.cells ? this.renderCells(item.cells) : item.label
            );
            row.addEventListener("mousedown", e => this.onMouseDown(e, i));
            row.addEventListener("dblclick", () => this.options.onActivate && this.options.onActivate(i, this.items[i]));
            row.addEventListener("contextmenu", e => {
                e.preventDefault();
                if (!this.selection.has(i)) this.select(i);
                if (this.options.onContextMenu) this.options.onContextMenu(e, i);
            });
            return row;
        });
        this.rows.forEach(r => this.el.appendChild(r));
        if (this.options.trailingRow) {
            const trailing = h("div", { class: "list-row dim", dataset: { index: this.items.length } }, this.options.trailingRow);
            trailing.addEventListener("dblclick", () => this.options.onActivate && this.options.onActivate(this.items.length, null));
            trailing.addEventListener("mousedown", () => this.select(this.items.length));
            this.el.appendChild(trailing);
            this.rows.push(trailing);
        }
        this.updateSelectionClasses();
    }

    updateSelectionClasses() {
        (this.rows || []).forEach((row, i) => row.classList.toggle("selected", this.selection.has(i)));
    }

    onMouseDown(e, i) {
        if (e.button === 2 && this.selection.has(i)) return;
        if (this.options.multi && e.shiftKey && this.anchor >= 0) {
            this.selectRange(this.anchor, i);
        } else if (this.options.multi && (e.ctrlKey || e.metaKey)) {
            if (this.selection.has(i)) this.selection.delete(i);
            else this.selection.add(i);
            this.index = i;
            this.updateSelectionClasses();
            this.fireChange();
        } else {
            this.select(i);
        }
    }

    select(i, scroll = true) {
        const max = this.rows ? this.rows.length - 1 : this.items.length - 1;
        if (max < 0) return;
        i = Math.max(0, Math.min(max, i));
        this.index = i;
        this.anchor = i;
        this.selection = new Set([i]);
        this.updateSelectionClasses();
        if (scroll && this.rows && this.rows[i]) this.rows[i].scrollIntoView({ block: "nearest" });
        this.fireChange();
    }

    selectRange(a, b) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        this.selection = new Set();
        for (let i = lo; i <= hi; i++) this.selection.add(i);
        this.index = b;
        this.updateSelectionClasses();
        this.fireChange();
    }

    selectedIndices() {
        return [...this.selection].sort((a, b) => a - b);
    }

    fireChange() {
        if (this.options.onChange) this.options.onChange(this.index, this.items[this.index]);
    }

    onKey(e) {
        const count = this.rows ? this.rows.length : this.items.length;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (e.shiftKey && this.options.multi) this.selectRange(this.anchor, Math.min(count - 1, this.index + 1));
            else this.select(this.index + 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (e.shiftKey && this.options.multi) this.selectRange(this.anchor, Math.max(0, this.index - 1));
            else this.select(this.index - 1);
        } else if (e.key === "Home") {
            e.preventDefault();
            this.select(0);
        } else if (e.key === "End") {
            e.preventDefault();
            this.select(count - 1);
        } else if (e.key === "PageDown") {
            e.preventDefault();
            this.select(this.index + 10);
        } else if (e.key === "PageUp") {
            e.preventDefault();
            this.select(this.index - 10);
        } else if ((e.key === "Enter" || e.key === " ") && this.options.onActivate) {
            e.preventDefault();
            e.stopPropagation();
            this.options.onActivate(this.index, this.items[this.index]);
        } else if (this.options.onKey) {
            this.options.onKey(e);
        }
    }
}

//-----------------------------------------------------------------------------
// Tree: nodes {id, label, icon, children, expanded}

export class Tree {
    constructor(options = {}) {
        this.options = options;
        this.roots = [];
        this.selectedId = null;
        this.el = h("div", { class: "tree", tabIndex: 0 });
        this.el.addEventListener("keydown", e => this.onKey(e));
        this._drag = null;
    }

    setRoots(roots) {
        this.roots = roots;
        this.render();
    }

    flatten() {
        const out = [];
        const walk = (nodes, depth) => {
            for (const node of nodes) {
                out.push({ node, depth });
                if (node.children && node.children.length && node.expanded) walk(node.children, depth + 1);
            }
        };
        walk(this.roots, 0);
        return out;
    }

    findNode(id, nodes = this.roots) {
        for (const n of nodes) {
            if (n.id === id) return n;
            const f = n.children ? this.findNode(id, n.children) : null;
            if (f) return f;
        }
        return null;
    }

    render() {
        clear(this.el);
        for (const { node, depth } of this.flatten()) {
            const hasChildren = node.children && node.children.length > 0;
            const row = h(
                "div",
                {
                    class: "tree-row" + (node.id === this.selectedId ? " selected" : ""),
                    style: { paddingLeft: depth * 14 + 2 + "px" },
                    dataset: { id: node.id },
                    draggable: this.options.draggable && node.draggable !== false ? "true" : null
                },
                h("span", { class: "twisty" }, hasChildren ? (node.expanded ? "▾" : "▸") : ""),
                node.icon ? node.icon.cloneNode(true) : null,
                h("span", { class: "label" }, node.label)
            );
            if (node.icon) row.children[1].classList.add("icon");
            row.querySelector(".twisty").addEventListener("mousedown", e => {
                if (hasChildren) {
                    e.stopPropagation();
                    node.expanded = !node.expanded;
                    if (this.options.onToggle) this.options.onToggle(node);
                    this.render();
                }
            });
            row.addEventListener("mousedown", e => {
                if (e.button === 0 || e.button === 2) this.select(node.id);
            });
            row.addEventListener("dblclick", () => this.options.onActivate && this.options.onActivate(node));
            row.addEventListener("contextmenu", e => {
                e.preventDefault();
                if (this.options.onContextMenu) this.options.onContextMenu(e, node);
            });
            if (this.options.draggable) this.attachDrag(row, node);
            this.el.appendChild(row);
        }
    }

    attachDrag(row, node) {
        row.addEventListener("dragstart", e => {
            this._drag = node;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(node.id));
        });
        row.addEventListener("dragover", e => {
            if (!this._drag || this._drag === node) return;
            e.preventDefault();
            const r = row.getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height;
            const where = y < 0.25 ? "before" : y > 0.75 ? "after" : "into";
            row.classList.remove("drop-before", "drop-after", "drop-into");
            row.classList.add("drop-" + where);
            row._dropWhere = where;
        });
        row.addEventListener("dragleave", () => row.classList.remove("drop-before", "drop-after", "drop-into"));
        row.addEventListener("drop", e => {
            e.preventDefault();
            row.classList.remove("drop-before", "drop-after", "drop-into");
            if (this._drag && this._drag !== node && this.options.onDrop) this.options.onDrop(this._drag, node, row._dropWhere || "into");
            this._drag = null;
        });
        row.addEventListener("dragend", () => (this._drag = null));
    }

    select(id, notify = true) {
        this.selectedId = id;
        for (const row of this.el.children) row.classList.toggle("selected", row.dataset.id === String(id));
        const row = [...this.el.children].find(r => r.dataset.id === String(id));
        if (row) row.scrollIntoView({ block: "nearest" });
        if (notify && this.options.onSelect) this.options.onSelect(this.findNode(id));
    }

    onKey(e) {
        const flat = this.flatten();
        const i = flat.findIndex(f => f.node.id === this.selectedId);
        if (e.key === "ArrowDown" && i < flat.length - 1) {
            e.preventDefault();
            this.select(flat[i + 1].node.id);
        } else if (e.key === "ArrowUp" && i > 0) {
            e.preventDefault();
            this.select(flat[i - 1].node.id);
        } else if (e.key === "ArrowRight" && i >= 0) {
            const node = flat[i].node;
            if (node.children && node.children.length && !node.expanded) {
                node.expanded = true;
                if (this.options.onToggle) this.options.onToggle(node);
                this.render();
            }
        } else if (e.key === "ArrowLeft" && i >= 0) {
            const node = flat[i].node;
            if (node.expanded) {
                node.expanded = false;
                if (this.options.onToggle) this.options.onToggle(node);
                this.render();
            }
        } else if (e.key === "Enter" && i >= 0 && this.options.onActivate) {
            this.options.onActivate(flat[i].node);
        } else if (this.options.onKey) {
            this.options.onKey(e, i >= 0 ? flat[i].node : null);
        }
    }
}

//-----------------------------------------------------------------------------
// TabView

export class TabView {
    // tabs: [{id, label, build: () => Node}]
    constructor(tabs, options = {}) {
        this.tabs = tabs;
        this.options = options;
        this.bar = h("div", { class: "tabbar" });
        this.content = h("div", { class: "tab-content", style: { flex: "1", minHeight: "0", display: "flex", flexDirection: "column" } });
        this.el = h("div", { class: "tabview", style: { display: "flex", flexDirection: "column", minHeight: "0", flex: options.flex || "1" } }, this.bar, this.content);
        this.cache = new Map();
        this.current = null;
        this.renderBar();
        if (tabs.length) this.show(options.initial || tabs[0].id);
    }

    renderBar() {
        clear(this.bar);
        for (const tab of this.tabs) {
            const el = h("div", { class: "tab" + (tab.id === this.current ? " active" : "") + (tab.disabled ? " disabled" : ""), dataset: { tab: tab.id } }, tab.label);
            el.addEventListener("mousedown", () => this.show(tab.id));
            this.bar.appendChild(el);
        }
    }

    show(id) {
        const tab = this.tabs.find(t => t.id === id);
        if (!tab) return;
        this.current = id;
        clear(this.content);
        let node = this.options.noCache ? null : this.cache.get(id);
        if (!node) {
            node = tab.build();
            if (!this.options.noCache) this.cache.set(id, node);
        }
        this.content.appendChild(node);
        this.renderBar();
        if (this.options.onChange) this.options.onChange(id);
    }
}

//-----------------------------------------------------------------------------
// Form fields

export function field(label, control, options = {}) {
    const el = h("div", { class: "field" + (options.grow ? " grow" : "") }, label ? h("label", {}, label) : null, control);
    if (options.width) el.style.width = options.width + "px";
    return el;
}

export function textInput(value, onChange, options = {}) {
    const el = h("input", { type: "text", value: value == null ? "" : value, placeholder: options.placeholder || "" });
    if (options.width) el.style.width = options.width + "px";
    el.addEventListener("input", () => onChange && onChange(el.value));
    return el;
}

export function textArea(value, onChange, options = {}) {
    const el = h("textarea", { rows: options.rows || 4, spellcheck: false });
    el.value = value == null ? "" : value;
    if (options.width) el.style.width = options.width + "px";
    el.addEventListener("input", () => onChange && onChange(el.value));
    return el;
}

export function numberInput(value, onChange, options = {}) {
    const el = h("input", {
        type: "number",
        value: value == null ? 0 : value,
        min: options.min != null ? options.min : null,
        max: options.max != null ? options.max : null,
        step: options.step || 1
    });
    el.style.width = (options.width || 80) + "px";
    const commit = () => {
        let v = options.float ? parseFloat(el.value) : parseInt(el.value, 10);
        if (isNaN(v)) v = options.min != null ? options.min : 0;
        if (options.min != null) v = Math.max(options.min, v);
        if (options.max != null) v = Math.min(options.max, v);
        if (onChange) onChange(v);
    };
    el.addEventListener("input", commit);
    el.addEventListener("change", () => {
        commit();
        let v = options.float ? parseFloat(el.value) : parseInt(el.value, 10);
        if (isNaN(v)) v = options.min != null ? options.min : 0;
        if (options.min != null) v = Math.max(options.min, v);
        if (options.max != null) v = Math.min(options.max, v);
        el.value = v;
    });
    return el;
}

// options: array of [value, label] or strings
export function selectInput(value, options, onChange, extra = {}) {
    const el = h("select");
    for (const opt of options) {
        const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
        el.appendChild(h("option", { value: String(v) }, label));
    }
    el.value = String(value);
    if (extra.width) el.style.width = extra.width + "px";
    el.addEventListener("change", () => {
        const raw = el.value;
        const match = options.find(o => String(Array.isArray(o) ? o[0] : o) === raw);
        const v = match ? (Array.isArray(match) ? match[0] : match) : raw;
        if (onChange) onChange(v);
    });
    return el;
}

export function checkbox(checked, label, onChange) {
    const input = h("input", { type: "checkbox", checked: !!checked });
    input.addEventListener("change", () => onChange && onChange(input.checked));
    const el = h("label", { class: "check-label" }, input, label);
    el.input = input;
    return el;
}

export function radioGroup(value, options, onChange, extra = {}) {
    const name = "rg" + Math.random().toString(36).slice(2);
    const el = h("div", { class: extra.vertical ? "col" : "row center", style: { gap: extra.vertical ? "2px" : "10px", flexWrap: "wrap" } });
    for (const [v, label] of options) {
        const input = h("input", { type: "radio", name, value: String(v), checked: v === value });
        input.addEventListener("change", () => input.checked && onChange && onChange(v));
        el.appendChild(h("label", { class: "check-label" }, input, label));
    }
    return el;
}

export function button(label, onClick, options = {}) {
    const el = h("button", { class: "btn" + (options.small ? " small" : "") + (options.primary ? " primary" : ""), title: options.title || null }, label);
    el.addEventListener("click", e => {
        e.preventDefault();
        onClick(e);
    });
    return el;
}

export function pickerButton(text, onClick, options = {}) {
    const value = h("span", { class: "value" }, text);
    const el = h("button", { class: "picker-btn" }, value, h("span", { class: "dots" }, "…"));
    if (options.width) el.style.width = options.width + "px";
    el.addEventListener("click", e => {
        e.preventDefault();
        onClick();
    });
    el.setText = t => (value.textContent = t);
    return el;
}

export function fieldset(legend, ...children) {
    return h("fieldset", {}, h("legend", {}, legend), ...children);
}

//-----------------------------------------------------------------------------
// Splitters

export function vSplitter(target, options = {}) {
    const el = h("div", { class: "splitter-v" });
    el.addEventListener("mousedown", e => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = target.getBoundingClientRect().width;
        const move = ev => {
            const w = Math.max(options.min || 150, Math.min(options.max || 900, startW + (ev.clientX - startX) * (options.invert ? -1 : 1)));
            target.style.width = w + "px";
            if (options.onResize) options.onResize(w);
        };
        const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            if (options.onEnd) options.onEnd();
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    });
    return el;
}

export function hSplitter(target, options = {}) {
    const el = h("div", { class: "splitter-h" });
    el.addEventListener("mousedown", e => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = target.getBoundingClientRect().height;
        const move = ev => {
            const hgt = Math.max(options.min || 80, Math.min(options.max || 1200, startH + (ev.clientY - startY)));
            target.style.height = hgt + "px";
            target.style.flex = "none";
            if (options.onResize) options.onResize(hgt);
        };
        const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            if (options.onEnd) options.onEnd();
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    });
    return el;
}
