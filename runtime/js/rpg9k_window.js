//=============================================================================
// rpg9k_window.js — Window and WindowLayer (MZ windowskin format)
//
// Windowskin layout (192x192):
//   (0,0,96,96)    background, stretched     (0,96,96,96)  background pattern
//   (96,0,96,96)   frame, 9-slice (24px)     (96,96,48,48) cursor, 9-slice
//   (144,96,48,48) pause sign (4 frames)     (120..,24..)  scroll arrows
//   (96,144,96,48) text colour palette
//=============================================================================
"use strict";

var Window = class extends Container {
    initialize() {
        super.initialize();
        this._isWindow = true;
        this._windowskin = null;
        this._width = 0;
        this._height = 0;
        this._cursorRect = new Rectangle();
        this._openness = 255;
        this._animationCount = 0;
        this._padding = 12;
        this._margin = 4;
        this._colorTone = [0, 0, 0, 0];
        this._innerChildren = [];
        this._bgCanvas = null;
        this._bgKey = "";
        this.contents = null;
        this.contentsBack = null;
        this.origin = new Point();
        this.active = true;
        this.frameVisible = true;
        this.cursorVisible = true;
        this.downArrowVisible = false;
        this.upArrowVisible = false;
        this.pause = false;
        this.backOpacity = 255;
        this.contentsOpacity = 255;
        this._frameOpacity = 255;
        this.contents = new Bitmap(1, 1);
        this.contentsBack = new Bitmap(1, 1);
    }

    get windowskin() {
        return this._windowskin;
    }
    set windowskin(value) {
        if (this._windowskin !== value) {
            this._windowskin = value;
            this._bgKey = "";
        }
    }

    get width() {
        return this._width;
    }
    set width(value) {
        this._width = value;
    }
    get height() {
        return this._height;
    }
    set height(value) {
        this._height = value;
    }

    get padding() {
        return this._padding;
    }
    set padding(value) {
        this._padding = value;
    }
    get margin() {
        return this._margin;
    }
    set margin(value) {
        this._margin = value;
    }

    get opacity() {
        return this._frameOpacity;
    }
    set opacity(value) {
        this._frameOpacity = Math.max(0, Math.min(255, value));
    }

    get openness() {
        return this._openness;
    }
    set openness(value) {
        this._openness = Math.max(0, Math.min(255, value));
    }

    get innerWidth() {
        return Math.max(0, this._width - this._padding * 2);
    }
    get innerHeight() {
        return Math.max(0, this._height - this._padding * 2);
    }
    get innerRect() {
        return new Rectangle(this._padding, this._padding, this.innerWidth, this.innerHeight);
    }

    get cursorRect() {
        return this._cursorRect;
    }

    update() {
        if (this.active) this._animationCount++;
        for (const child of this.children.slice()) if (child.update) child.update();
        for (const child of this._innerChildren.slice()) if (child.update) child.update();
    }

    move(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        if (width !== undefined) this._width = width;
        if (height !== undefined) this._height = height;
    }

    isOpen() {
        return this._openness >= 255;
    }
    isClosed() {
        return this._openness <= 0;
    }

    setCursorRect(x, y, width, height) {
        const r = this._cursorRect;
        r.x = Math.floor(x || 0);
        r.y = Math.floor(y || 0);
        r.width = Math.floor(width || 0);
        r.height = Math.floor(height || 0);
    }

    moveCursorBy(x, y) {
        this._cursorRect.x += x;
        this._cursorRect.y += y;
    }

    moveInnerChildrenBy(x, y) {
        for (const child of this._innerChildren) {
            child.x += x;
            child.y += y;
        }
    }

    setTone(r, g, b) {
        const tone = this._colorTone;
        if (r !== tone[0] || g !== tone[1] || b !== tone[2]) {
            this._colorTone = [r, g, b, 0];
        }
    }

    addChildToBack(child) {
        child._windowBack = true;
        return this.addChildAt(child, 0);
    }

    addInnerChild(child) {
        this._innerChildren.push(child);
        child.parent = this;
        return child;
    }

    removeInnerChild(child) {
        const i = this._innerChildren.indexOf(child);
        if (i >= 0) this._innerChildren.splice(i, 1);
    }

    destroy(options) {
        super.destroy(options);
        for (const c of this._innerChildren) if (c.destroy) c.destroy(options);
        this._innerChildren = [];
        if (this.contents) this.contents.destroy();
        if (this.contentsBack) this.contentsBack.destroy();
    }

    drawShape() {}

    render(ctx) {
        if (!this.visible || this.alpha <= 0 || this._destroyed) return;
        const w = this._width, h = this._height;
        if (w <= 0 || h <= 0) return;
        ctx.save();
        this._applyTransform(ctx);
        const skin = this._windowskin;
        const skinReady = skin && skin.isReady() && skin.source;
        const openRate = this._openness / 255;
        if (openRate > 0) {
            ctx.save();
            if (openRate < 1) {
                ctx.translate(0, (h / 2) * (1 - openRate));
                ctx.scale(1, openRate);
            }
            for (const child of this.children) if (child._windowBack) child.render(ctx);
            if (skinReady) {
                this._renderBack(ctx, skin);
                if (this.frameVisible) this._renderFrame(ctx, skin);
            }
            ctx.restore();
        }
        if (this.isOpen()) {
            this._renderClient(ctx, skinReady ? skin : null);
            if (skinReady) this._renderDecorations(ctx, skin);
        }
        for (const child of this.children) if (!child._windowBack) child.render(ctx);
        ctx.restore();
    }

    _renderBack(ctx, skin) {
        const m = this._margin;
        const w = this._width - m * 2, h = this._height - m * 2;
        if (w <= 0 || h <= 0 || this.backOpacity <= 0 || this._frameOpacity <= 0) return;
        const key = w + "," + h + "," + this._colorTone.join(",") + "," + skin._version + skin._url;
        if (this._bgKey !== key) {
            this._bgKey = key;
            if (!this._bgCanvas) this._bgCanvas = document.createElement("canvas");
            const c = this._bgCanvas;
            c.width = w;
            c.height = h;
            const bctx = c.getContext("2d");
            bctx.drawImage(skin.source, 0, 0, 95, 95, 0, 0, w, h);
            const pattern = document.createElement("canvas");
            pattern.width = 96;
            pattern.height = 96;
            pattern.getContext("2d").drawImage(skin.source, 0, 96, 96, 96, 0, 0, 96, 96);
            bctx.fillStyle = bctx.createPattern(pattern, "repeat");
            bctx.fillRect(0, 0, w, h);
            const tone = this._colorTone;
            if (tone[0] || tone[1] || tone[2]) {
                Tint.applyTone(bctx, w, h, tone);
                bctx.globalCompositeOperation = "destination-in";
                bctx.drawImage(skin.source, 0, 0, 95, 95, 0, 0, w, h);
                bctx.globalCompositeOperation = "source-over";
            }
        }
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * (this.backOpacity / 255) * (this._frameOpacity / 255);
        ctx.drawImage(this._bgCanvas, m, m);
        ctx.globalAlpha = alpha;
    }

    _renderFrame(ctx, skin) {
        if (this._frameOpacity <= 0) return;
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * (this._frameOpacity / 255);
        Window.drawNineSlice(ctx, skin.source, 96, 0, 96, 96, 24, 0, 0, this._width, this._height, false);
        ctx.globalAlpha = alpha;
    }

    _renderClient(ctx, skin) {
        const p = this._padding;
        const iw = this.innerWidth, ih = this.innerHeight;
        if (iw <= 0 || ih <= 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(p, p, iw, ih);
        ctx.clip();
        const alpha = ctx.globalAlpha;
        ctx.translate(p, p);
        // contentsBack
        if (this.contentsBack && this.contentsBack._canvas && this.contentsOpacity > 0) {
            ctx.globalAlpha = alpha * (this.contentsOpacity / 255);
            ctx.drawImage(this.contentsBack._canvas, -this.origin.x, -this.origin.y);
        }
        // cursor
        if (skin && this.cursorVisible) this._renderCursor(ctx, skin, alpha);
        // inner children (sprites drawn in client space, e.g. gauges)
        ctx.globalAlpha = alpha;
        if (this._innerChildren.length) {
            ctx.save();
            ctx.translate(-this.origin.x, -this.origin.y);
            for (const child of this._innerChildren) child.render(ctx);
            ctx.restore();
        }
        // contents
        if (this.contents && this.contents._canvas && this.contentsOpacity > 0) {
            ctx.globalAlpha = alpha * (this.contentsOpacity / 255);
            ctx.drawImage(this.contents._canvas, -this.origin.x, -this.origin.y);
        }
        ctx.restore();
    }

    _renderCursor(ctx, skin, alpha) {
        const r = this._cursorRect;
        if (r.width <= 0 || r.height <= 0) return;
        const blinkCount = this._animationCount % 40;
        let cursorOpacity = this.contentsOpacity;
        if (this.active) {
            if (blinkCount < 20) cursorOpacity -= blinkCount * 8;
            else cursorOpacity -= (40 - blinkCount) * 8;
        }
        ctx.globalAlpha = alpha * Math.max(0, cursorOpacity) / 255;
        Window.drawNineSlice(ctx, skin.source, 96, 96, 48, 48, 4, r.x - this.origin.x, r.y - this.origin.y, r.width, r.height, true);
    }

    _renderDecorations(ctx, skin) {
        const w = this._width, h = this._height;
        const p = 24, q = p / 2;
        const sx = 96 + p, sy = p;
        if (this.downArrowVisible) {
            ctx.drawImage(skin.source, sx + q, sy + q + p, p, q, (w - p) / 2, h - q, p, q);
        }
        if (this.upArrowVisible) {
            ctx.drawImage(skin.source, sx + q, sy, p, q, (w - p) / 2, 0, p, q);
        }
        if (this.pause) {
            const frame = Math.floor(this._animationCount / 16) % 4;
            const px = 144 + (frame % 2) * p;
            const py = 96 + Math.floor(frame / 2) * p;
            ctx.drawImage(skin.source, px, py, p, p, (w - p) / 2, h - p, p, p);
        }
    }

    // Draws a 9-slice region of an image.
    static drawNineSlice(ctx, img, sx, sy, sw, sh, m, dx, dy, dw, dh, drawCenter) {
        if (dw <= 0 || dh <= 0) return;
        const cm = Math.min(m, Math.floor(dw / 2), Math.floor(dh / 2));
        const iw = sw - m * 2, ih = sh - m * 2;
        const dwi = dw - cm * 2, dhi = dh - cm * 2;
        // corners
        ctx.drawImage(img, sx, sy, m, m, dx, dy, cm, cm);
        ctx.drawImage(img, sx + sw - m, sy, m, m, dx + dw - cm, dy, cm, cm);
        ctx.drawImage(img, sx, sy + sh - m, m, m, dx, dy + dh - cm, cm, cm);
        ctx.drawImage(img, sx + sw - m, sy + sh - m, m, m, dx + dw - cm, dy + dh - cm, cm, cm);
        // edges
        if (dwi > 0) {
            ctx.drawImage(img, sx + m, sy, iw, m, dx + cm, dy, dwi, cm);
            ctx.drawImage(img, sx + m, sy + sh - m, iw, m, dx + cm, dy + dh - cm, dwi, cm);
        }
        if (dhi > 0) {
            ctx.drawImage(img, sx, sy + m, m, ih, dx, dy + cm, cm, dhi);
            ctx.drawImage(img, sx + sw - m, sy + m, m, ih, dx + dw - cm, dy + cm, cm, dhi);
        }
        // centre (the cursor only; the frame's centre holds the arrow graphics)
        if (drawCenter && dwi > 0 && dhi > 0) {
            ctx.drawImage(img, sx + m, sy + m, iw, ih, dx + cm, dy + cm, dwi, dhi);
        }
    }
};

//-----------------------------------------------------------------------------
// WindowLayer — container for windows

var WindowLayer = class extends Container {
    initialize() {
        super.initialize();
    }
    update() {
        for (const child of this.children.slice()) if (child.update) child.update();
    }
};
