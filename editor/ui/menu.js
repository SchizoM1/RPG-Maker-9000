// menu.js — menu bar and context/popup menus.
import { h, clear } from "./dom.js";

let openPopup = null;

export function closeMenus() {
    if (openPopup) {
        openPopup.close();
        openPopup = null;
    }
}

// items: [{label, shortcut, action, enabled, checked, submenu:[...]} | "-"]
export function showPopupMenu(items, x, y, options = {}) {
    closeMenus();
    const popups = [];
    const buildPopup = (list, px, py) => {
        const el = h("div", { class: "menu-popup" });
        for (const item of list) {
            if (item === "-" || item === null) {
                el.appendChild(h("div", { class: "menu-sep" }));
                continue;
            }
            const enabled = typeof item.enabled === "function" ? item.enabled() : item.enabled !== false;
            const checked = typeof item.checked === "function" ? item.checked() : item.checked;
            const entry = h(
                "div",
                { class: "menu-entry" + (enabled ? "" : " disabled"), dataset: { action: item.id || "" } },
                h("span", { class: "check" }, checked ? "✓" : ""),
                h("span", { class: "label" }, item.label),
                item.shortcut ? h("span", { class: "shortcut" }, item.shortcut) : null,
                item.submenu ? h("span", { class: "submenu-arrow" }, "▶") : null
            );
            if (item.submenu) {
                entry.addEventListener("mouseenter", () => {
                    while (popups.length > 1 && popups[popups.length - 1] !== el) popups.pop().remove();
                    const r = entry.getBoundingClientRect();
                    const sub = buildPopup(item.submenu, r.right, r.top);
                    popups.push(sub);
                });
            } else {
                entry.addEventListener("mouseenter", () => {
                    while (popups.length > 1 && popups[popups.length - 1] !== el && popups.indexOf(el) < popups.length - 1) popups.pop().remove();
                });
                entry.addEventListener("mouseup", e => {
                    e.stopPropagation();
                    if (!enabled) return;
                    closeMenus();
                    if (item.action) item.action();
                });
            }
            el.appendChild(entry);
        }
        document.body.appendChild(el);
        const rect = el.getBoundingClientRect();
        el.style.left = Math.min(px, window.innerWidth - rect.width - 4) + "px";
        el.style.top = Math.min(py, window.innerHeight - rect.height - 4) + "px";
        return el;
    };
    popups.push(buildPopup(items, x, y));
    const onDown = e => {
        if (!popups.some(p => p.contains(e.target)) && !(options.owner && options.owner.contains(e.target))) closeMenus();
    };
    const onKey = e => {
        if (e.key === "Escape") closeMenus();
    };
    setTimeout(() => window.addEventListener("mousedown", onDown, true), 0);
    window.addEventListener("keydown", onKey, true);
    openPopup = {
        close() {
            popups.forEach(p => p.remove());
            window.removeEventListener("mousedown", onDown, true);
            window.removeEventListener("keydown", onKey, true);
            if (options.onClose) options.onClose();
        }
    };
    return openPopup;
}

export class MenuBar {
    constructor(menus) {
        this.menus = menus; // [{label, items}]
        this.el = h("div", { class: "menubar" });
        this.openIndex = -1;
        this.render();
    }

    render() {
        clear(this.el);
        this.menus.forEach((menu, index) => {
            const item = h("div", { class: "menubar-item", dataset: { menu: menu.label } }, menu.label);
            item.addEventListener("mousedown", e => {
                e.preventDefault();
                if (this.openIndex === index) {
                    closeMenus();
                    return;
                }
                this.open(index, item);
            });
            item.addEventListener("mouseenter", () => {
                if (this.openIndex >= 0 && this.openIndex !== index) this.open(index, item);
            });
            this.el.appendChild(item);
        });
    }

    open(index, itemEl) {
        const r = itemEl.getBoundingClientRect();
        [...this.el.children].forEach(c => c.classList.remove("open"));
        itemEl.classList.add("open");
        this.openIndex = index;
        const items = typeof this.menus[index].items === "function" ? this.menus[index].items() : this.menus[index].items;
        showPopupMenu(items, r.left, r.bottom, {
            owner: this.el,
            onClose: () => {
                itemEl.classList.remove("open");
                if (this.openIndex === index) this.openIndex = -1;
            }
        });
        this.openIndex = index;
    }
}
