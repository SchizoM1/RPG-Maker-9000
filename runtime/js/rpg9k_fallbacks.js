//=============================================================================
// rpg9k_fallbacks.js — procedural stand-ins for missing system graphics.
// A project with no art (or a missing file) still runs: windows, icons,
// shadows, balloons and damage digits are drawn here, and missing character,
// face, battler and tileset images become clearly-marked placeholders.
//=============================================================================
"use strict";

var Fallbacks = {
    TEXT_COLORS: [
        "#ffffff", "#20a0d6", "#ff784c", "#66cc40", "#99ccff", "#ccc0ff", "#ffffa0", "#808080",
        "#c0c0c0", "#2080cc", "#ff3810", "#00a010", "#3e9ade", "#a098ff", "#ffcc20", "#000000",
        "#84aaff", "#ffff40", "#ff2020", "#202040", "#e08040", "#f0c040", "#4080c0", "#40c0f0",
        "#80ff80", "#c08080", "#8080ff", "#ff80ff", "#00a040", "#00e060", "#a060e0", "#c080ff"
    ],

    _canvas(w, h) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
    },

    // Chooses a fallback for an image path such as "img/system/Window.png".
    forUrl(url) {
        const m = /img\/([^/]+)\/(.+?)\.png$/.exec(decodeURIComponent(url || ""));
        if (!m) return null;
        const folder = m[1], name = m[2];
        if (folder === "system") {
            switch (name) {
                case "Window": return () => this.windowskin();
                case "IconSet": return () => this.iconSet();
                case "Shadow1": return () => this.shadow(48, 48);
                case "Shadow2": return () => this.shadow(48, 48);
                case "Balloon": return () => this.balloon();
                case "Damage": return () => this.damage();
                case "States": return () => this.blank(96, 96);
                case "ButtonSet": return () => this.blank(48, 48);
                case "Weapons1": case "Weapons2": case "Weapons3": return () => this.blank(576, 384);
                default: return () => this.blank(1, 1);
            }
        }
        if (folder === "characters") return () => this.character(name);
        if (folder === "faces") return () => this.faces(name);
        if (folder === "sv_actors") return () => this.svActor(name);
        if (folder === "tilesets") return () => this.tileset(name);
        if (folder === "enemies" || folder === "sv_enemies") return () => this.battler(name);
        return () => this.blank(1, 1);
    },

    blank(w, h) {
        return this._canvas(w, h);
    },

    windowskin() {
        const c = this._canvas(192, 192);
        const ctx = c.getContext("2d");
        // Background (stretched) — dark blue gradient
        const g = ctx.createLinearGradient(0, 0, 0, 96);
        g.addColorStop(0, "#1a2a50");
        g.addColorStop(1, "#0c1430");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 96, 96);
        // Frame
        ctx.strokeStyle = "#e8ecff";
        ctx.lineWidth = 2;
        this._roundRect(ctx, 96 + 3, 3, 90, 90, 6);
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        this._roundRect(ctx, 96 + 5.5, 5.5, 85, 85, 4);
        ctx.stroke();
        // Cursor
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1;
        ctx.fillRect(97, 97, 46, 46);
        ctx.strokeRect(96.5, 96.5, 47, 47);
        // Arrows (up at 132,24; down at 132,60)
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(144, 26);
        ctx.lineTo(154, 34);
        ctx.lineTo(134, 34);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(134, 62);
        ctx.lineTo(154, 62);
        ctx.lineTo(144, 70);
        ctx.fill();
        // Pause sign: 4 frames at (144,96) 24x24
        for (let i = 0; i < 4; i++) {
            const x = 144 + (i % 2) * 24, y = 96 + Math.floor(i / 2) * 24;
            const o = [0, 2, 4, 2][i];
            ctx.beginPath();
            ctx.moveTo(x + 6, y + 8 + o);
            ctx.lineTo(x + 18, y + 8 + o);
            ctx.lineTo(x + 12, y + 16 + o);
            ctx.fill();
        }
        // Text colours palette at (96,144), 12px cells
        this.TEXT_COLORS.forEach((color, n) => {
            ctx.fillStyle = color;
            ctx.fillRect(96 + (n % 8) * 12, 144 + Math.floor(n / 8) * 12, 12, 12);
        });
        return c;
    },

    iconSet() {
        const size = 32, cols = 16, rows = 20;
        const c = this._canvas(size * cols, size * rows);
        const ctx = c.getContext("2d");
        for (let i = 1; i < cols * rows; i++) {
            const x = (i % cols) * size, y = Math.floor(i / cols) * size;
            const hue = (i * 47) % 360;
            ctx.fillStyle = "hsl(" + hue + ",60%,55%)";
            this._roundRect(ctx, x + 5, y + 5, size - 10, size - 10, 4);
            ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(String(i), x + size / 2, y + size / 2 + 4);
        }
        return c;
    },

    shadow(w, h) {
        const c = this._canvas(w, h);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.ellipse(w / 2, h - 6, w / 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        return c;
    },

    balloon() {
        const c = this._canvas(48 * 8, 48 * 10);
        const ctx = c.getContext("2d");
        const glyphs = ["!", "?", "♪", "♥", "ǃ", "…", "#", "…", "Z", "…"];
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 8; col++) {
                const x = col * 48, y = row * 48;
                const scale = Math.min(1, (col + 2) / 4);
                ctx.fillStyle = "white";
                ctx.strokeStyle = "black";
                ctx.beginPath();
                ctx.ellipse(x + 24, y + 22, 18 * scale, 15 * scale, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                if (col >= 2) {
                    ctx.fillStyle = "black";
                    ctx.font = "bold 18px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(glyphs[row], x + 24, y + 29);
                }
            }
        }
        return c;
    },

    damage() {
        // 10 digits per row, rows: HP damage, HP recover, MP damage, MP recover, miss
        const c = this._canvas(24 * 10, 32 * 5);
        const ctx = c.getContext("2d");
        const colors = ["#ffffff", "#b9ffb5", "#ffff90", "#80b0ff", "#ffffff"];
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "black";
        for (let row = 0; row < 4; row++) {
            for (let d = 0; d < 10; d++) {
                ctx.fillStyle = colors[row];
                ctx.strokeText(String(d), d * 24 + 12, row * 32 + 26);
                ctx.fillText(String(d), d * 24 + 12, row * 32 + 26);
            }
        }
        ctx.fillStyle = "white";
        ctx.strokeText("Miss", 48, 4 * 32 + 26);
        ctx.fillText("Miss", 48, 4 * 32 + 26);
        return c;
    },

    character(name) {
        const big = /^[!$]*\$/.test(name);
        const cw = 48, ch = 48;
        const sheets = big ? 1 : 8;
        const c = this._canvas(big ? cw * 3 : cw * 12, big ? ch * 4 : ch * 8);
        const ctx = c.getContext("2d");
        for (let n = 0; n < sheets; n++) {
            const bx = (n % 4) * cw * 3, by = Math.floor(n / 4) * ch * 4;
            const hue = (this._hash(name) + n * 45) % 360;
            for (let dir = 0; dir < 4; dir++) {
                for (let pat = 0; pat < 3; pat++) {
                    const x = bx + pat * cw, y = by + dir * ch;
                    const bob = pat === 1 ? 0 : 1;
                    ctx.fillStyle = "hsl(" + hue + ",55%,45%)";
                    this._roundRect(ctx, x + 14, y + 20 + bob, 20, 22, 5);
                    ctx.fill();
                    ctx.fillStyle = "#f2d0b0";
                    ctx.beginPath();
                    ctx.arc(x + 24, y + 14 + bob, 9, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = "#222";
                    const eyeDx = [0, -4, 4, 0][dir];
                    if (dir !== 3) {
                        ctx.fillRect(x + 20 + eyeDx, y + 13 + bob, 2, 3);
                        ctx.fillRect(x + 26 + eyeDx, y + 13 + bob, 2, 3);
                    }
                }
            }
        }
        return c;
    },

    faces(name) {
        const size = 144;
        const c = this._canvas(size * 4, size * 2);
        const ctx = c.getContext("2d");
        for (let i = 0; i < 8; i++) {
            const x = (i % 4) * size, y = Math.floor(i / 4) * size;
            const hue = (this._hash(name) + i * 45) % 360;
            ctx.fillStyle = "hsl(" + hue + ",40%,30%)";
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = "#f2d0b0";
            ctx.beginPath();
            ctx.arc(x + 72, y + 70, 42, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#222";
            ctx.fillRect(x + 55, y + 62, 6, 10);
            ctx.fillRect(x + 83, y + 62, 6, 10);
        }
        return c;
    },

    svActor(name) {
        const c = this._canvas(64 * 9, 64 * 6);
        const ctx = c.getContext("2d");
        const hue = this._hash(name) % 360;
        for (let i = 0; i < 54; i++) {
            const x = (i % 9) * 64, y = Math.floor(i / 9) * 64;
            ctx.fillStyle = "hsl(" + hue + ",55%,45%)";
            this._roundRect(ctx, x + 22, y + 26, 20, 30, 5);
            ctx.fill();
            ctx.fillStyle = "#f2d0b0";
            ctx.beginPath();
            ctx.arc(x + 32, y + 18, 10, 0, Math.PI * 2);
            ctx.fill();
        }
        return c;
    },

    battler(name) {
        const c = this._canvas(160, 160);
        const ctx = c.getContext("2d");
        const hue = this._hash(name) % 360;
        ctx.fillStyle = "hsl(" + hue + ",50%,40%)";
        ctx.beginPath();
        ctx.ellipse(80, 95, 60, 55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(60, 80, 10, 0, Math.PI * 2);
        ctx.arc(100, 80, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(62, 82, 4, 0, Math.PI * 2);
        ctx.arc(102, 82, 4, 0, Math.PI * 2);
        ctx.fill();
        return c;
    },

    // Placeholder tileset: each 48px cell gets a colour with a border, laid out
    // so autotile blocks render sensible edges.
    tileset(name) {
        const slot = (/_(A[1-5]|[B-E])$/.exec(name) || [])[1] || "B";
        const sizes = { A1: [768, 576], A2: [768, 576], A3: [768, 384], A4: [768, 720], A5: [384, 768] };
        const [w, h] = sizes[slot] || [768, 768];
        const c = this._canvas(w, h);
        const ctx = c.getContext("2d");
        const base = this._hash(name) % 360;
        if (slot === "A1" || slot === "A2" || slot === "A4") {
            const blockH = slot === "A4" ? null : 144;
            const blocks = [];
            if (blockH) {
                for (let by = 0; by < h; by += 144) for (let bx = 0; bx < w; bx += 96) blocks.push([bx, by, 96, 144, "floor"]);
            } else {
                let y = 0;
                let row = 0;
                while (y < h) {
                    const bh = row % 2 === 0 ? 144 : 96;
                    for (let bx = 0; bx < w; bx += 96) blocks.push([bx, y, 96, bh, row % 2 === 0 ? "floor" : "wall"]);
                    y += bh;
                    row++;
                }
            }
            blocks.forEach(([bx, by, bw, bh, type], i) => this._autotileBlock(ctx, bx, by, bw, bh, (base + i * 23) % 360, type));
        } else if (slot === "A3") {
            for (let by = 0; by < h; by += 96)
                for (let bx = 0; bx < w; bx += 96) this._autotileBlock(ctx, bx, by, 96, 96, (base + bx + by) % 360, "wall");
        } else {
            for (let y = 0; y < h; y += 48) {
                for (let x = 0; x < w; x += 48) {
                    if (slot !== "A5" && x === 0 && y === 0) continue; // B tile 0 is empty
                    const hue = (base + (x / 48) * 13 + (y / 48) * 29) % 360;
                    ctx.fillStyle = "hsla(" + hue + ",45%,50%,0.9)";
                    ctx.fillRect(x + 6, y + 6, 36, 36);
                    ctx.strokeStyle = "rgba(0,0,0,0.5)";
                    ctx.strokeRect(x + 6.5, y + 6.5, 35, 35);
                }
            }
        }
        return c;
    },

    _autotileBlock(ctx, bx, by, bw, bh, hue, type) {
        const fill = "hsl(" + hue + ",40%,48%)";
        const edge = "hsl(" + hue + ",40%,28%)";
        if (type === "floor") {
            // preview tile (top-left)
            ctx.fillStyle = fill;
            ctx.fillRect(bx, by, 48, 48);
            ctx.strokeStyle = edge;
            ctx.lineWidth = 4;
            ctx.strokeRect(bx + 2, by + 2, 44, 44);
            // inner corners tile (top-right): interior fill with corner notches
            ctx.fillStyle = fill;
            ctx.fillRect(bx + 48, by, 48, 48);
            ctx.fillStyle = edge;
            ctx.fillRect(bx + 48, by, 4, 4);
            ctx.fillRect(bx + 92, by, 4, 4);
            ctx.fillRect(bx + 48, by + 44, 4, 4);
            ctx.fillRect(bx + 92, by + 44, 4, 4);
            // 2x2 edge region
            ctx.fillStyle = fill;
            ctx.fillRect(bx, by + 48, 96, 96);
            ctx.strokeStyle = edge;
            ctx.strokeRect(bx + 2, by + 50, 92, 92);
        } else {
            ctx.fillStyle = fill;
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = edge;
            ctx.lineWidth = 4;
            ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
        }
        ctx.lineWidth = 1;
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    _hash(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }
};
