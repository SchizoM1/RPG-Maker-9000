// dom.js — tiny DOM construction helpers.

export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (value === undefined || value === null || value === false) continue;
            if (key === "class") el.className = value;
            else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
            else if (key === "dataset") Object.assign(el.dataset, value);
            else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
            else if (key === "html") el.innerHTML = value;
            else if (key in el && typeof value !== "string") el[key] = value;
            else el.setAttribute(key, value === true ? "" : value);
        }
    }
    append(el, children);
    return el;
}

export function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

export function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
}

export function svg(markup, cls = "") {
    const span = document.createElement("span");
    span.innerHTML = markup;
    const el = span.firstElementChild;
    if (cls) el.classList.add(cls);
    return el;
}

export function pad(n, width = 4) {
    return String(n).padStart(width, "0");
}

export function idName(id, name) {
    return pad(id) + ": " + (name || "");
}

// Makes an element draggable by a handle (used for dialog title bars).
export function makeDraggable(el, handle) {
    let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
    handle.addEventListener("mousedown", e => {
        if (e.button !== 0 || e.target.closest("button")) return;
        dragging = true;
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origX = rect.left;
        origY = rect.top;
        el.style.position = "fixed";
        el.style.left = origX + "px";
        el.style.top = origY + "px";
        el.style.margin = "0";
        e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
        if (!dragging) return;
        el.style.left = Math.max(0, origX + e.clientX - startX) + "px";
        el.style.top = Math.max(0, origY + e.clientY - startY) + "px";
    });
    window.addEventListener("mouseup", () => (dragging = false));
}

export function debounce(fn, ms) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

export function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
