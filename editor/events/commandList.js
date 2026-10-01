// commandList.js — the event "Contents" list with MZ-style editing.
import { h, deepClone } from "../ui/dom.js";
import { ListBox } from "../ui/widgets.js";
import { showPopupMenu } from "../ui/menu.js";
import { commandLine, commandClass, CONTINUATION_CODES } from "./format.js";
import { blockEnd, commandDef, initialState, buildLines, readState, isEditable } from "./commands.js";
import { chooseCommand } from "./commandPalette.js";

let clipboard = null;

export class CommandList {
    constructor(ctx, list, options = {}) {
        this.ctx = ctx;
        this.list = list;
        this.options = options;
        this.history = [];
        this.future = [];
        this.listBox = new ListBox({
            multi: true,
            className: "command-list",
            onActivate: i => this.editAt(i),
            onContextMenu: (e, i) => this.showMenu(e, i),
            onKey: e => this.onKey(e)
        });
        this.el = this.listBox.el;
        this.el.style.flex = "1";
        this.render();
    }

    setList(list) {
        this.list = list;
        this.history = [];
        this.future = [];
        this.render(false);
    }

    render(keep = true) {
        const index = this.listBox.index;
        this.listBox.setItems(this.list.map(cmd => ({ label: commandLine(this.ctx, cmd), className: commandClass(cmd) })), keep);
        if (keep && index >= 0) this.listBox.select(Math.min(index, this.list.length - 1), false);
    }

    changed() {
        this.render();
        if (this.options.onChange) this.options.onChange(this.list);
    }

    snapshot() {
        this.history.push(deepClone(this.list));
        if (this.history.length > 100) this.history.shift();
        this.future = [];
    }

    replaceAll(lines) {
        this.list.splice(0, this.list.length, ...lines);
    }

    undo() {
        if (!this.history.length) return;
        this.future.push(deepClone(this.list));
        this.replaceAll(this.history.pop());
        this.changed();
    }

    redo() {
        if (!this.future.length) return;
        this.history.push(deepClone(this.list));
        this.replaceAll(this.future.pop());
        this.changed();
    }

    // Index of the command line that owns line i (for continuation lines).
    ownerOf(i) {
        const lineObj = this.list[i];
        if (!lineObj || !CONTINUATION_CODES.has(lineObj.code)) return i;
        for (let j = i - 1; j >= 0; j--) {
            if (this.list[j].indent === lineObj.indent && !CONTINUATION_CODES.has(this.list[j].code)) return j;
            if (this.list[j].indent < lineObj.indent) break;
        }
        return i;
    }

    blockRange(i) {
        const start = this.ownerOf(i);
        return [start, blockEnd(this.list, start)];
    }

    // Selected lines expanded to whole blocks, excluding structural "◆" ends.
    selectedRange() {
        const indices = this.listBox.selectedIndices().filter(i => i < this.list.length);
        if (!indices.length) return null;
        let [start] = this.blockRange(indices[0]);
        let end = this.blockRange(indices[indices.length - 1])[1];
        const indent = this.list[start].indent;
        // Clamp to the same indentation level as the first block.
        let j = start;
        let lastEnd = start;
        while (j < end && j < this.list.length && this.list[j].indent >= indent) {
            if (this.list[j].indent === indent && this.list[j].code === 0) break;
            lastEnd = blockEnd(this.list, j);
            j = lastEnd;
        }
        end = lastEnd;
        if (end <= start) return null;
        return [start, end];
    }

    async editAt(i) {
        if (i < 0 || i >= this.list.length) return;
        const owner = this.ownerOf(i);
        const cmd = this.list[owner];
        if (cmd.code === 0) return this.insertAt(owner);
        if (!isEditable(cmd.code)) return;
        const [start, end] = [owner, blockEnd(this.list, owner)];
        const block = this.list.slice(start, end);
        const def = commandDef(cmd.code);
        const state = readState(block);
        const result = await def.edit(this.ctx, state);
        if (!result) return;
        this.snapshot();
        const lines = buildLines(cmd.code, { ...state, ...result }, cmd.indent);
        this.list.splice(start, end - start, ...lines);
        this.changed();
        this.listBox.select(start);
        this.el.focus();
    }

    async insertAt(i) {
        if (i < 0) i = this.list.length - 1;
        const code = await chooseCommand(this.ctx);
        if (!code) return this.el.focus();
        const def = commandDef(code);
        let state = initialState(code);
        if (def.edit) {
            const result = await def.edit(this.ctx, state);
            if (!result) return this.el.focus();
            state = { ...state, ...result };
        }
        this.snapshot();
        const indent = this.list[i] ? this.list[i].indent : 0;
        const lines = buildLines(code, state, indent);
        this.list.splice(i, 0, ...lines);
        this.changed();
        this.listBox.select(i + lines.length);
        this.el.focus();
    }

    deleteSelection() {
        const range = this.selectedRange();
        if (!range) return;
        this.snapshot();
        this.list.splice(range[0], range[1] - range[0]);
        this.changed();
        this.listBox.select(range[0]);
    }

    copySelection() {
        const range = this.selectedRange();
        if (!range) return false;
        const lines = deepClone(this.list.slice(range[0], range[1]));
        const base = lines[0].indent;
        clipboard = lines.map(l => ({ ...l, indent: l.indent - base }));
        return true;
    }

    cutSelection() {
        if (this.copySelection()) this.deleteSelection();
    }

    paste() {
        if (!clipboard) return;
        const i = Math.max(0, this.listBox.index);
        const indent = this.list[i] ? this.list[i].indent : 0;
        this.snapshot();
        const lines = deepClone(clipboard).map(l => ({ ...l, indent: l.indent + indent }));
        this.list.splice(i, 0, ...lines);
        this.changed();
        this.listBox.select(i + lines.length);
    }

    selectAll() {
        this.listBox.selectRange(0, Math.max(0, this.list.length - 1));
    }

    onKey(e) {
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.key === "Delete") {
            e.preventDefault();
            this.deleteSelection();
        } else if (e.key === "Insert") {
            e.preventDefault();
            this.insertAt(this.listBox.index);
        } else if (ctrl && e.key.toLowerCase() === "c") {
            e.preventDefault();
            this.copySelection();
        } else if (ctrl && e.key.toLowerCase() === "x") {
            e.preventDefault();
            this.cutSelection();
        } else if (ctrl && e.key.toLowerCase() === "v") {
            e.preventDefault();
            this.paste();
        } else if (ctrl && e.key.toLowerCase() === "z") {
            e.preventDefault();
            e.stopPropagation();
            this.undo();
        } else if (ctrl && e.key.toLowerCase() === "y") {
            e.preventDefault();
            e.stopPropagation();
            this.redo();
        } else if (ctrl && e.key.toLowerCase() === "a") {
            e.preventDefault();
            this.selectAll();
        }
    }

    showMenu(e, i) {
        const has = this.selectedRange() != null;
        showPopupMenu(
            [
                { label: "Edit…", shortcut: "Space", action: () => this.editAt(i), enabled: i < this.list.length && (this.list[this.ownerOf(i)].code === 0 || isEditable(this.list[this.ownerOf(i)].code)) },
                { label: "Insert…", shortcut: "Ins", action: () => this.insertAt(i) },
                "-",
                { label: "Cut", shortcut: "Ctrl+X", action: () => this.cutSelection(), enabled: has },
                { label: "Copy", shortcut: "Ctrl+C", action: () => this.copySelection(), enabled: has },
                { label: "Paste", shortcut: "Ctrl+V", action: () => this.paste(), enabled: !!clipboard },
                { label: "Delete", shortcut: "Del", action: () => this.deleteSelection(), enabled: has },
                "-",
                { label: "Select All", shortcut: "Ctrl+A", action: () => this.selectAll() },
                { label: "Undo", shortcut: "Ctrl+Z", action: () => this.undo(), enabled: this.history.length > 0 }
            ],
            e.clientX,
            e.clientY
        );
    }
}

export function commandListStyles() {
    return h("style", {}, `
        .command-list .cmd-comment { color: #7fbf7f; }
        .command-list .cmd-script { color: #c9a0ff; }
        .command-list .cmd-flow { color: #8ab4ff; }
        .command-list .cmd-message { color: #f0f0f0; }
        .command-list .list-row.selected { color: #fff; }
    `);
}
