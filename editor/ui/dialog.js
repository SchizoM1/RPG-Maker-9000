// dialog.js — modal dialogs with OK / Cancel / Apply, stacked.
import { h, makeDraggable } from "./dom.js";

const stack = [];

export function isDialogOpen() {
    return stack.length > 0;
}

export class Dialog {
    // options: {title, width, height, body (Node), buttons: ["ok","cancel","apply"],
    //           onOk() -> bool|Promise, onApply(), okLabel, leftButtons:[Node]}
    constructor(options) {
        this.options = options;
        this.result = null;
        this._resolve = null;
        this.body = h("div", { class: "dialog-body" });
        if (options.body) this.body.appendChild(options.body);
        const buttons = options.buttons || ["ok", "cancel"];
        this.buttonsEl = h("div", { class: "dialog-buttons" });
        this.buttonsEl.appendChild(h("div", { class: "left" }, options.leftButtons || []));
        this.buttonEls = {};
        const labels = { ok: options.okLabel || "OK", cancel: options.cancelLabel || "Cancel", apply: "Apply", close: "Close" };
        for (const b of buttons) {
            const el = h("button", { class: "btn" + (b === "ok" ? " primary" : ""), dataset: { button: b } }, labels[b] || b);
            el.addEventListener("click", () => this.onButton(b));
            this.buttonEls[b] = el;
            this.buttonsEl.appendChild(el);
        }
        const title = h(
            "div",
            { class: "dialog-title" },
            h("span", { class: "title-text" }, options.title || ""),
            h("button", { class: "close", title: "Close", onclick: () => this.cancel() }, "×")
        );
        this.el = h("div", { class: "dialog", role: "dialog", dataset: { dialog: options.id || options.title || "" } }, title, this.body, this.buttonsEl);
        if (options.width) this.el.style.width = options.width + "px";
        if (options.height) this.el.style.height = options.height + "px";
        this.backdrop = h("div", { class: "modal-backdrop" }, this.el);
        makeDraggable(this.el, title);
        this._onKey = e => this.onKey(e);
    }

    open() {
        document.body.appendChild(this.backdrop);
        stack.push(this);
        window.addEventListener("keydown", this._onKey, true);
        setTimeout(() => {
            const first = this.body.querySelector("[autofocus], input, select, textarea, .listbox, button");
            if (first && !this.options.noAutoFocus) first.focus();
        }, 0);
        if (this.options.onOpen) this.options.onOpen(this);
        return new Promise(resolve => (this._resolve = resolve));
    }

    onKey(e) {
        if (stack[stack.length - 1] !== this) return;
        if (document.querySelector(".menu-popup")) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.cancel();
        } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === "TEXTAREA" || tag === "BUTTON") return;
            if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".listbox") && this.options.enterInLists === false) return;
            if (this.buttonEls.ok && !this.options.noEnterOk) {
                e.preventDefault();
                e.stopPropagation();
                this.onButton("ok");
            }
        }
    }

    async onButton(b) {
        if (b === "cancel" || b === "close") return this.cancel();
        if (b === "apply") {
            if (this.options.onApply) await this.options.onApply(this);
            return;
        }
        if (b === "ok") {
            if (this.options.onOk) {
                const ok = await this.options.onOk(this);
                if (ok === false) return;
            }
            this.close(this.result === null ? true : this.result);
        } else if (this.options.onButton) {
            this.options.onButton(b, this);
        }
    }

    cancel() {
        if (this.options.onCancel && this.options.onCancel(this) === false) return;
        this.close(null);
    }

    close(result) {
        window.removeEventListener("keydown", this._onKey, true);
        this.backdrop.remove();
        const i = stack.indexOf(this);
        if (i >= 0) stack.splice(i, 1);
        if (this._resolve) this._resolve(result);
        if (this.options.onClose) this.options.onClose(result);
    }
}

export function openDialog(options) {
    return new Dialog(options).open();
}

export async function alertDialog(message, title = "RPG Maker 9000") {
    await openDialog({ title, body: h("div", { style: { whiteSpace: "pre-wrap", maxWidth: "520px" } }, message), buttons: ["ok"] });
}

export async function confirmDialog(message, title = "RPG Maker 9000", okLabel = "OK") {
    const r = await openDialog({ title, okLabel, body: h("div", { style: { whiteSpace: "pre-wrap", maxWidth: "520px" } }, message) });
    return !!r;
}

// Returns "yes" | "no" | null (cancel).
export async function yesNoCancel(message, title = "RPG Maker 9000") {
    let answer = null;
    const r = await openDialog({
        title,
        body: h("div", { style: { whiteSpace: "pre-wrap", maxWidth: "520px" } }, message),
        buttons: ["yes", "no", "cancel"],
        onButton: (b, d) => {
            answer = b;
            d.close(b);
        }
    });
    return r || answer;
}

export async function promptDialog(message, value = "", title = "RPG Maker 9000") {
    const input = h("input", { type: "text", value, style: { width: "320px" }, autofocus: true });
    let result = null;
    const r = await openDialog({
        title,
        body: h("div", { class: "col" }, h("div", {}, message), input),
        onOk: () => {
            result = input.value;
        }
    });
    return r ? result : null;
}

let toastArea = null;
export function toast(message, type = "info", ms = 3500) {
    if (!toastArea) {
        toastArea = h("div", { class: "toast-area" });
        document.body.appendChild(toastArea);
    }
    const el = h("div", { class: "toast " + type }, message);
    toastArea.appendChild(el);
    setTimeout(() => el.remove(), ms);
}
