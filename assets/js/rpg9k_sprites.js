//=============================================================================
// rpg9k_sprites.js — game sprites and spritesets (MZ-compatible)
//=============================================================================
"use strict";

//-----------------------------------------------------------------------------
// Sprite_Clickable

var Sprite_Clickable = class extends Sprite {
    initialize(bitmap) {
        super.initialize(bitmap);
        this._pressed = false;
        this._hovered = false;
    }

    update() {
        super.update();
        this.processTouch();
    }

    processTouch() {
        if (this.isClickEnabled()) {
            if (this.isBeingTouched()) {
                if (!this._hovered && TouchInput.isHovered()) {
                    this._hovered = true;
                    this.onMouseEnter();
                }
                if (TouchInput.isTriggered()) {
                    this._pressed = true;
                    this.onPress();
                }
            } else {
                if (this._hovered) this.onMouseExit();
                this._pressed = false;
                this._hovered = false;
            }
            if (this._pressed && TouchInput.isReleased()) {
                this._pressed = false;
                this.onClick();
            }
        } else {
            this._pressed = false;
            this._hovered = false;
        }
    }

    isPressed() {
        return this._pressed;
    }

    isClickEnabled() {
        return this.worldVisible;
    }

    isBeingTouched() {
        const touchPos = new Point(TouchInput.x, TouchInput.y);
        const localPos = this.worldTransform.applyInverse(touchPos);
        return this.hitTest(localPos.x, localPos.y);
    }

    // Local-coordinate hit test (MZ semantics).
    hitTest(x, y) {
        const rect = new Rectangle(
            -this.anchor.x * this._frame.width,
            -this.anchor.y * this._frame.height,
            this._frame.width,
            this._frame.height
        );
        return rect.contains(x, y);
    }

    onMouseEnter() {}
    onMouseExit() {}
    onPress() {}
    onClick() {}
};

//-----------------------------------------------------------------------------
// Sprite_Button — touch UI buttons from img/system/ButtonSet.png

var Sprite_Button = class extends Sprite_Clickable {
    initialize(buttonType) {
        super.initialize();
        this._buttonType = buttonType;
        this._clickHandler = null;
        this._coldFrame = null;
        this._hotFrame = null;
        this.setupFrames();
    }

    setupFrames() {
        const data = this.buttonData();
        const x = data.x * this.blockWidth();
        const width = data.w * this.blockWidth();
        const height = this.blockHeight();
        this.loadButtonImage();
        this.setColdFrame(x, 0, width, height);
        this.setHotFrame(x, height, width, height);
        this.updateFrame();
        this.updateOpacity();
    }

    blockWidth() {
        return 48;
    }

    blockHeight() {
        return 48;
    }

    loadButtonImage() {
        this.bitmap = ImageManager.loadSystem("ButtonSet");
    }

    buttonData() {
        const buttonTable = {
            cancel: { x: 0, w: 2 },
            pageup: { x: 2, w: 1 },
            pagedown: { x: 3, w: 1 },
            down: { x: 4, w: 1 },
            up: { x: 5, w: 1 },
            down2: { x: 6, w: 1 },
            up2: { x: 7, w: 1 },
            ok: { x: 8, w: 2 },
            menu: { x: 10, w: 1 }
        };
        return buttonTable[this._buttonType];
    }

    update() {
        super.update();
        this.updateFrame();
        this.updateOpacity();
    }

    updateFrame() {
        const frame = this.isPressed() ? this._hotFrame : this._coldFrame;
        if (frame) this.setFrame(frame.x, frame.y, frame.width, frame.height);
    }

    updateOpacity() {
        this.opacity = this._pressed ? 255 : 192;
    }

    setColdFrame(x, y, width, height) {
        this._coldFrame = new Rectangle(x, y, width, height);
    }

    setHotFrame(x, y, width, height) {
        this._hotFrame = new Rectangle(x, y, width, height);
    }

    setClickHandler(method) {
        this._clickHandler = method;
    }

    onClick() {
        if (this._clickHandler) this._clickHandler();
        else Input.virtualClick(this._buttonType);
    }
};

//-----------------------------------------------------------------------------
// Sprite_Character

var Sprite_Character = class extends Sprite {
    initialize(character) {
        super.initialize();
        this.initMembers();
        this.setCharacter(character);
    }

    initMembers() {
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this._character = null;
        this._balloonDuration = 0;
        this._tilesetId = 0;
        this._upperBody = null;
        this._lowerBody = null;
        this._bushDepth = 0;
    }

    setCharacter(character) {
        this._character = character;
    }

    checkCharacter(character) {
        return this._character === character;
    }

    update() {
        super.update();
        this.updateBitmap();
        this.updateFrame();
        this.updatePosition();
        this.updateOther();
        this.updateVisibility();
    }

    updateVisibility() {
        super.updateVisibility();
        if (this.isEmptyCharacter() || this._character.isTransparent()) this.visible = false;
    }

    isTile() {
        return this._character.isTile();
    }

    isObjectCharacter() {
        return this._character.isObjectCharacter();
    }

    isEmptyCharacter() {
        return this._tileId === 0 && !this._characterName;
    }

    tilesetBitmap(tileId) {
        const tileset = $gameMap.tileset();
        const setNumber = 5 + Math.floor(tileId / 256);
        return ImageManager.loadTileset(tileset.tilesetNames[setNumber]);
    }

    updateBitmap() {
        if (this.isImageChanged()) {
            this._tilesetId = $gameMap.tilesetId();
            this._tileId = this._character.tileId();
            this._characterName = this._character.characterName();
            this._characterIndex = this._character.characterIndex();
            if (this._tileId > 0) this.setTileBitmap();
            else this.setCharacterBitmap();
        }
    }

    isImageChanged() {
        return (
            this._tilesetId !== $gameMap.tilesetId() ||
            this._tileId !== this._character.tileId() ||
            this._characterName !== this._character.characterName() ||
            this._characterIndex !== this._character.characterIndex()
        );
    }

    setTileBitmap() {
        this.bitmap = this.tilesetBitmap(this._tileId);
    }

    setCharacterBitmap() {
        this.bitmap = ImageManager.loadCharacter(this._characterName);
        this._isBigCharacter = ImageManager.isBigCharacter(this._characterName);
    }

    updateFrame() {
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (this._tileId > 0) this.updateTileFrame();
        else this.updateCharacterFrame();
    }

    updateTileFrame() {
        const tileId = this._tileId;
        const pw = this.patternWidth();
        const ph = this.patternHeight();
        const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * pw;
        const sy = (Math.floor((tileId % 256) / 8) % 16) * ph;
        this.setFrame(sx, sy, pw, ph);
    }

    updateCharacterFrame() {
        const pw = this.patternWidth();
        const ph = this.patternHeight();
        const sx = (this.characterBlockX() + this.characterPatternX()) * pw;
        const sy = (this.characterBlockY() + this.characterPatternY()) * ph;
        this.updateHalfBodySprites();
        if (this._bushDepth > 0) {
            const d = this._bushDepth;
            this._upperBody.setFrame(sx, sy, pw, ph - d);
            this._lowerBody.setFrame(sx, sy + ph - d, pw, d);
            this.setFrame(sx, sy, 0, ph);
        } else {
            this.setFrame(sx, sy, pw, ph);
        }
    }

    characterBlockX() {
        if (this._isBigCharacter) return 0;
        const index = this._character.characterIndex();
        return (index % 4) * 3;
    }

    characterBlockY() {
        if (this._isBigCharacter) return 0;
        const index = this._character.characterIndex();
        return Math.floor(index / 4) * 4;
    }

    characterPatternX() {
        return this._character.pattern();
    }

    characterPatternY() {
        return (this._character.direction() - 2) / 2;
    }

    patternWidth() {
        if (this._tileId > 0) return $gameMap.tileWidth();
        if (this._isBigCharacter) return this.bitmap.width / 3;
        return this.bitmap.width / 12;
    }

    patternHeight() {
        if (this._tileId > 0) return $gameMap.tileHeight();
        if (this._isBigCharacter) return this.bitmap.height / 4;
        return this.bitmap.height / 8;
    }

    updateHalfBodySprites() {
        if (this._bushDepth > 0) {
            this.createHalfBodySprites();
            this._upperBody.bitmap = this.bitmap;
            this._upperBody.visible = true;
            this._upperBody.y = -this._bushDepth;
            this._lowerBody.bitmap = this.bitmap;
            this._lowerBody.visible = true;
            this._upperBody.setBlendColor(this.getBlendColor());
            this._lowerBody.setBlendColor(this.getBlendColor());
            this._upperBody.setColorTone(this.getColorTone());
            this._lowerBody.setColorTone(this.getColorTone());
            this._upperBody.blendMode = this.blendMode;
            this._lowerBody.blendMode = this.blendMode;
        } else if (this._upperBody) {
            this._upperBody.visible = false;
            this._lowerBody.visible = false;
        }
    }

    createHalfBodySprites() {
        if (!this._upperBody) {
            this._upperBody = new Sprite();
            this._upperBody.anchor.x = 0.5;
            this._upperBody.anchor.y = 1;
            this.addChild(this._upperBody);
        }
        if (!this._lowerBody) {
            this._lowerBody = new Sprite();
            this._lowerBody.anchor.x = 0.5;
            this._lowerBody.anchor.y = 1;
            this._lowerBody.opacity = 128;
            this.addChild(this._lowerBody);
        }
    }

    updatePosition() {
        this.x = this._character.screenX();
        this.y = this._character.screenY();
        this.z = this._character.screenZ();
    }

    updateOther() {
        this.opacity = this._character.opacity();
        this.blendMode = this._character.blendMode();
        this._bushDepth = this._character.bushDepth();
    }
};

//-----------------------------------------------------------------------------
// Sprite_Battler

var Sprite_Battler = class extends Sprite_Clickable {
    initialize(battler) {
        super.initialize();
        this.initMembers();
        this.setBattler(battler);
    }

    initMembers() {
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this._battler = null;
        this._damages = [];
        this._homeX = 0;
        this._homeY = 0;
        this._offsetX = 0;
        this._offsetY = 0;
        this._targetOffsetX = NaN;
        this._targetOffsetY = NaN;
        this._movementDuration = 0;
        this._selectionEffectCount = 0;
    }

    setBattler(battler) {
        this._battler = battler;
    }

    checkBattler(battler) {
        return this._battler === battler;
    }

    mainSprite() {
        return this;
    }

    setHome(x, y) {
        this._homeX = x;
        this._homeY = y;
        this.updatePosition();
    }

    update() {
        super.update();
        if (this._battler) {
            this.updateMain();
            this.updateDamagePopup();
            this.updateSelectionEffect();
            this.updateVisibility();
        } else {
            this.bitmap = null;
        }
    }

    updateVisibility() {
        super.updateVisibility();
        if (!this._battler || !this._battler.isSpriteVisible()) this.visible = false;
    }

    updateMain() {
        if (this._battler.isSpriteVisible()) {
            this.updateBitmap();
            this.updateFrame();
        }
        this.updateMove();
        this.updatePosition();
    }

    updateBitmap() {}

    updateFrame() {}

    updateMove() {
        if (this._movementDuration > 0) {
            const d = this._movementDuration;
            this._offsetX = (this._offsetX * (d - 1) + this._targetOffsetX) / d;
            this._offsetY = (this._offsetY * (d - 1) + this._targetOffsetY) / d;
            this._movementDuration--;
            if (this._movementDuration === 0) this.onMoveEnd();
        }
    }

    updatePosition() {
        this.x = this._homeX + this._offsetX;
        this.y = this._homeY + this._offsetY;
    }

    updateDamagePopup() {
        this.setupDamagePopup();
        if (this._damages.length > 0) {
            for (const damage of this._damages) damage.update();
            if (!this._damages[0].isPlaying()) this.destroyDamageSprite(this._damages[0]);
        }
    }

    updateSelectionEffect() {
        const target = this.mainSprite();
        if (this._battler.isSelected()) {
            this._selectionEffectCount++;
            if (this._selectionEffectCount % 30 < 15) target.setBlendColor([255, 255, 255, 64]);
            else target.setBlendColor([0, 0, 0, 0]);
        } else if (this._selectionEffectCount > 0) {
            this._selectionEffectCount = 0;
            target.setBlendColor([0, 0, 0, 0]);
        }
    }

    setupDamagePopup() {
        if (this._battler.isDamagePopupRequested()) {
            if (this._battler.isSpriteVisible()) this.createDamageSprite();
            this._battler.clearDamagePopup();
            this._battler.clearResult();
        }
    }

    createDamageSprite() {
        const last = this._damages[this._damages.length - 1];
        const sprite = new Sprite_Damage();
        if (last) {
            sprite.x = last.x + 8;
            sprite.y = last.y - 16;
        } else {
            sprite.x = this.x + this.damageOffsetX();
            sprite.y = this.y + this.damageOffsetY();
        }
        sprite.setup(this._battler);
        this._damages.push(sprite);
        this.parent.addChild(sprite);
    }

    destroyDamageSprite(sprite) {
        this.parent.removeChild(sprite);
        this._damages.remove(sprite);
        sprite.destroy();
    }

    damageOffsetX() {
        return 0;
    }

    damageOffsetY() {
        return 0;
    }

    startMove(x, y, duration) {
        if (this._targetOffsetX !== x || this._targetOffsetY !== y) {
            this._targetOffsetX = x;
            this._targetOffsetY = y;
            this._movementDuration = duration;
            if (duration === 0) {
                this._offsetX = x;
                this._offsetY = y;
            }
        }
    }

    onMoveEnd() {}

    isEffecting() {
        return false;
    }

    isMoving() {
        return this._movementDuration > 0;
    }

    inHomePosition() {
        return this._offsetX === 0 && this._offsetY === 0;
    }

    onMouseEnter() {
        $gameTemp.setTouchState(this._battler, "select");
    }

    onPress() {
        $gameTemp.setTouchState(this._battler, "select");
    }

    onClick() {
        $gameTemp.setTouchState(this._battler, "click");
    }
};

//-----------------------------------------------------------------------------
// Sprite_Actor — side-view actor (img/sv_actors, 9x6 motion sheet)

var Sprite_Actor = class extends Sprite_Battler {
    initialize(battler) {
        super.initialize(battler);
        this.moveToStartPosition();
    }

    initMembers() {
        super.initMembers();
        this._battlerName = "";
        this._motion = null;
        this._motionCount = 0;
        this._pattern = 0;
        this.createShadowSprite();
        this.createWeaponSprite();
        this.createMainSprite();
        this.createStateSprite();
    }

    mainSprite() {
        return this._mainSprite;
    }

    createMainSprite() {
        this._mainSprite = new Sprite();
        this._mainSprite.anchor.x = 0.5;
        this._mainSprite.anchor.y = 1;
        this.addChild(this._mainSprite);
    }

    createShadowSprite() {
        this._shadowSprite = new Sprite();
        this._shadowSprite.bitmap = ImageManager.loadSystem("Shadow2");
        this._shadowSprite.anchor.x = 0.5;
        this._shadowSprite.anchor.y = 0.5;
        this._shadowSprite.y = -2;
        this.addChild(this._shadowSprite);
    }

    createWeaponSprite() {
        this._weaponSprite = new Sprite_Weapon();
        this.addChild(this._weaponSprite);
    }

    createStateSprite() {
        this._stateSprite = new Sprite_StateOverlay();
        this.addChild(this._stateSprite);
    }

    setBattler(battler) {
        super.setBattler(battler);
        if (battler !== this._actor) {
            this._actor = battler;
            if (battler) {
                this.setActorHome(battler.index());
            } else {
                this._mainSprite.bitmap = null;
                this._battlerName = "";
            }
            this.startEntryMotion();
            this._stateSprite.setup(battler);
        }
    }

    moveToStartPosition() {
        this.startMove(300, 0, 0);
    }

    setActorHome(index) {
        this.setHome(600 + index * 32, 280 + index * 48);
    }

    update() {
        super.update();
        this.updateShadow();
        if (this._actor) this.updateMotion();
    }

    updateShadow() {
        this._shadowSprite.visible = !!this._actor;
    }

    updateMain() {
        super.updateMain();
        if (this._actor.isSpriteVisible() && !this.isMoving()) this.updateTargetPosition();
    }

    setupMotion() {
        if (this._actor.isMotionRequested()) {
            this.startMotion(this._actor.motionType());
            this._actor.clearMotion();
        }
    }

    setupWeaponAnimation() {
        if (this._actor.isWeaponAnimationRequested()) {
            this._weaponSprite.setup(this._actor.weaponImageId());
            this._actor.clearWeaponAnimation();
        }
    }

    startMotion(motionType) {
        const newMotion = Sprite_Actor.MOTIONS[motionType];
        if (this._motion !== newMotion) {
            this._motion = newMotion;
            this._motionCount = 0;
            this._pattern = 0;
        }
    }

    updateTargetPosition() {
        if (this._actor.canMove() && BattleManager.isEscaped()) this.retreat();
        else if (this.shouldStepForward()) this.stepForward();
        else if (!this.inHomePosition()) this.stepBack();
    }

    shouldStepForward() {
        return this._actor.isInputting() || this._actor.isActing();
    }

    updateBitmap() {
        super.updateBitmap();
        const name = this._actor.battlerName();
        if (this._battlerName !== name) {
            this._battlerName = name;
            this._mainSprite.bitmap = ImageManager.loadSvActor(name);
        }
    }

    updateFrame() {
        super.updateFrame();
        const bitmap = this._mainSprite.bitmap;
        if (bitmap && bitmap.isReady()) {
            const motionIndex = this._motion ? this._motion.index : 0;
            const pattern = this._pattern < 3 ? this._pattern : 1;
            const cw = bitmap.width / 9;
            const ch = bitmap.height / 6;
            const cx = Math.floor(motionIndex / 6) * 3 + pattern;
            const cy = motionIndex % 6;
            this._mainSprite.setFrame(cx * cw, cy * ch, cw, ch);
            this.setFrame(0, 0, cw, ch);
        }
    }

    updateMove() {
        const bitmap = this._mainSprite.bitmap;
        if (!bitmap || bitmap.isReady()) super.updateMove();
    }

    updateMotion() {
        this.setupMotion();
        this.setupWeaponAnimation();
        if (this._actor.isMotionRefreshRequested()) {
            this.refreshMotion();
            this._actor.clearMotion();
        }
        this.updateMotionCount();
    }

    updateMotionCount() {
        if (this._motion && ++this._motionCount >= this.motionSpeed()) {
            if (this._motion.loop) this._pattern = (this._pattern + 1) % 4;
            else if (this._pattern < 2) this._pattern++;
            else this.refreshMotion();
            this._motionCount = 0;
        }
    }

    motionSpeed() {
        return 12;
    }

    refreshMotion() {
        const actor = this._actor;
        const stateMotion = actor.stateMotionIndex();
        if (actor.isInputting() || actor.isActing()) this.startMotion("walk");
        else if (stateMotion === 3) this.startMotion("dead");
        else if (stateMotion === 2) this.startMotion("sleep");
        else if (actor.isChanting()) this.startMotion("chant");
        else if (actor.isGuard() || actor.isGuardWaiting()) this.startMotion("guard");
        else if (stateMotion === 1) this.startMotion("abnormal");
        else if (actor.isDying()) this.startMotion("dying");
        else if (actor.isUndecided()) this.startMotion("walk");
        else this.startMotion("wait");
    }

    startEntryMotion() {
        if (this._actor && this._actor.canMove()) {
            this.startMotion("walk");
            this.startMove(0, 0, 30);
        } else if (!this.isMoving()) {
            if (this._actor) this.refreshMotion();
            this.startMove(0, 0, 0);
        }
    }

    stepForward() {
        this.startMove(-48, 0, 12);
    }

    stepBack() {
        this.startMove(0, 0, 12);
    }

    retreat() {
        this.startMove(300, 0, 30);
    }

    onMoveEnd() {
        super.onMoveEnd();
        if (!BattleManager.isBattleEnd()) this.refreshMotion();
    }

    damageOffsetX() {
        return -32;
    }

    damageOffsetY() {
        return 0;
    }
};

Sprite_Actor.MOTIONS = {
    walk: { index: 0, loop: true },
    wait: { index: 1, loop: true },
    chant: { index: 2, loop: true },
    guard: { index: 3, loop: true },
    damage: { index: 4, loop: false },
    evade: { index: 5, loop: false },
    thrust: { index: 6, loop: false },
    swing: { index: 7, loop: false },
    missile: { index: 8, loop: false },
    skill: { index: 9, loop: false },
    spell: { index: 10, loop: false },
    item: { index: 11, loop: false },
    escape: { index: 12, loop: true },
    victory: { index: 13, loop: true },
    dying: { index: 14, loop: true },
    abnormal: { index: 15, loop: true },
    sleep: { index: 16, loop: true },
    dead: { index: 17, loop: true }
};

//-----------------------------------------------------------------------------
// Sprite_Enemy

var Sprite_Enemy = class extends Sprite_Battler {
    initMembers() {
        super.initMembers();
        this._enemy = null;
        this._appeared = false;
        this._battlerName = null;
        this._battlerHue = 0;
        this._effectType = null;
        this._effectDuration = 0;
        this._shake = 0;
        this.createStateIconSprite();
    }

    createStateIconSprite() {
        this._stateIconSprite = new Sprite_StateIcon();
        this.addChild(this._stateIconSprite);
    }

    setBattler(battler) {
        super.setBattler(battler);
        this._enemy = battler;
        this.setHome(battler.screenX(), battler.screenY());
        this._stateIconSprite.setup(battler);
    }

    update() {
        super.update();
        if (this._enemy) {
            this.updateEffect();
            this.updateStateSprite();
        }
    }

    updateBitmap() {
        super.updateBitmap();
        const name = this._enemy.battlerName();
        const hue = this._enemy.battlerHue();
        if (this._battlerName !== name || this._battlerHue !== hue) {
            this._battlerName = name;
            this._battlerHue = hue;
            this.loadBitmap(name);
            this.setHue(hue);
            this.initVisibility();
        }
    }

    loadBitmap(name) {
        if ($gameSystem.isSideView()) this.bitmap = ImageManager.loadSvEnemy(name);
        else this.bitmap = ImageManager.loadEnemy(name);
    }

    setHue(hue) {
        super.setHue(hue);
        for (const child of this.children) {
            if (child.setHue) child.setHue(-hue);
        }
    }

    updateFrame() {
        super.updateFrame();
        if (!this.bitmap || !this.bitmap.isReady()) return;
        if (this._effectType === "bossCollapse") this.setFrame(0, 0, this.bitmap.width, this._effectDuration);
        else this.setFrame(0, 0, this.bitmap.width, this.bitmap.height);
    }

    updatePosition() {
        super.updatePosition();
        this.x += this._shake;
    }

    updateStateSprite() {
        const h = this.bitmap ? this.bitmap.height : 0;
        this._stateIconSprite.y = -Math.round((h + 40) * 0.9);
        if (this._stateIconSprite.y < 20 - this.y) this._stateIconSprite.y = 20 - this.y;
    }

    initVisibility() {
        this._appeared = this._enemy.isAlive();
        if (!this._appeared) this.opacity = 0;
    }

    setupEffect() {
        if (this._appeared && this._enemy.isEffectRequested()) {
            this.startEffect(this._enemy.effectType());
            this._enemy.clearEffect();
        }
        if (!this._appeared && this._enemy.isAlive()) this.startEffect("appear");
        else if (this._appeared && this._enemy.isHidden()) this.startEffect("disappear");
    }

    startEffect(effectType) {
        this._effectType = effectType;
        switch (this._effectType) {
            case "appear":
                this.startAppear();
                break;
            case "disappear":
                this.startDisappear();
                break;
            case "whiten":
                this.startWhiten();
                break;
            case "blink":
                this.startBlink();
                break;
            case "collapse":
                this.startCollapse();
                break;
            case "bossCollapse":
                this.startBossCollapse();
                break;
            case "instantCollapse":
                this.startInstantCollapse();
                break;
        }
        this.revertToNormal();
    }

    startAppear() {
        this._effectDuration = 16;
        this._appeared = true;
    }

    startDisappear() {
        this._effectDuration = 32;
        this._appeared = false;
    }

    startWhiten() {
        this._effectDuration = 16;
    }

    startBlink() {
        this._effectDuration = 20;
    }

    startCollapse() {
        this._effectDuration = 32;
        this._appeared = false;
    }

    startBossCollapse() {
        this._effectDuration = this.bitmap.height;
        this._appeared = false;
    }

    startInstantCollapse() {
        this._effectDuration = 16;
        this._appeared = false;
    }

    updateEffect() {
        this.setupEffect();
        if (this._effectDuration > 0) {
            this._effectDuration--;
            switch (this._effectType) {
                case "whiten":
                    this.updateWhiten();
                    break;
                case "blink":
                    this.updateBlink();
                    break;
                case "appear":
                    this.updateAppear();
                    break;
                case "disappear":
                    this.updateDisappear();
                    break;
                case "collapse":
                    this.updateCollapse();
                    break;
                case "bossCollapse":
                    this.updateBossCollapse();
                    break;
                case "instantCollapse":
                    this.updateInstantCollapse();
                    break;
            }
            if (this._effectDuration === 0) this._effectType = null;
        }
    }

    isEffecting() {
        return this._effectType !== null;
    }

    revertToNormal() {
        this._shake = 0;
        this.blendMode = 0;
        this.opacity = 255;
        this.setBlendColor([0, 0, 0, 0]);
    }

    updateWhiten() {
        const alpha = 128 - (16 - this._effectDuration) * 8;
        this.setBlendColor([255, 255, 255, alpha]);
    }

    updateBlink() {
        this.opacity = this._effectDuration % 10 < 5 ? 255 : 0;
    }

    updateAppear() {
        this.opacity = (16 - this._effectDuration) * 16;
    }

    updateDisappear() {
        this.opacity = 256 - (32 - this._effectDuration) * 10;
    }

    updateCollapse() {
        this.blendMode = 1;
        this.setBlendColor([255, 128, 128, 128]);
        this.opacity *= this._effectDuration / (this._effectDuration + 1);
    }

    updateBossCollapse() {
        this._shake = (this._effectDuration % 2) * 4 - 2;
        this.blendMode = 1;
        this.opacity *= this._effectDuration / (this._effectDuration + 1);
        this.setBlendColor([255, 255, 255, 255 - this.opacity]);
        if (this._effectDuration % 20 === 19) SoundManager.playBossCollapse2();
    }

    updateInstantCollapse() {
        this.opacity = 0;
    }

    damageOffsetX() {
        return 0;
    }

    damageOffsetY() {
        return -8;
    }
};

//-----------------------------------------------------------------------------
// Sprite_Animation — MZ-format animation (Effekseer). When the Effekseer
// runtime is available the effect is rendered through EffekseerRenderer;
// otherwise sound/flash timings still play with a simple built-in burst.

var Sprite_Animation = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
    }

    initMembers() {
        this._targets = [];
        this._animation = null;
        this._mirror = false;
        this._delay = 0;
        this._previous = null;
        this._effect = null;
        this._handle = null;
        this._playing = false;
        this._started = false;
        this._frameIndex = 0;
        this._maxTimingFrames = 0;
        this._flashColor = [0, 0, 0, 0];
        this._flashDuration = 0;
        this._burst = [];
        this.z = 8;
    }

    destroy(options) {
        super.destroy(options);
        if (this._handle && this._handle.stop) this._handle.stop();
        this._handle = null;
    }

    setup(targets, animation, mirror, delay, previous) {
        this._targets = targets;
        this._animation = animation;
        this._mirror = mirror;
        this._delay = delay;
        this._previous = previous;
        this._effect = EffectManager.load(animation.effectName);
        this._playing = true;
        const timings = (animation.soundTimings || []).concat(animation.flashTimings || []);
        for (const timing of timings) {
            if (timing.frame > this._maxTimingFrames) this._maxTimingFrames = timing.frame;
        }
        // Without Effekseer, give the fallback burst some visible length.
        if (!this._effect) this._maxTimingFrames = Math.max(this._maxTimingFrames, 24);
    }

    update() {
        super.update();
        if (this._delay > 0) {
            this._delay--;
        } else if (this._playing) {
            if (!this._started && this.canStart()) {
                if (this._effect) {
                    if (this._effect.isLoaded) {
                        this._handle = EffekseerRenderer.play(this._effect, this);
                        this._started = true;
                    }
                } else {
                    this._started = true;
                    this.startBurst();
                }
            }
            if (this._started) {
                this.updateEffectGeometry();
                this.updateMain();
                this.updateFlash();
                this.updateBurst();
            }
        }
    }

    canStart() {
        if (this._previous && this.shouldWaitForPrevious()) return !this._previous.isPlaying();
        return true;
    }

    shouldWaitForPrevious() {
        return false;
    }

    updateEffectGeometry() {
        const pos = this.targetPosition();
        this.x = pos.x;
        this.y = pos.y;
        if (this._handle && this._handle.setGeometry) {
            const scale = this._animation.scale / 100;
            const r = Math.PI / 180;
            const rx = this._animation.rotation.x * r;
            const ry = this._animation.rotation.y * r;
            const rz = this._animation.rotation.z * r;
            this._handle.setGeometry(pos.x, pos.y, scale, this._mirror ? -1 : 1, rx, ry, rz, this._animation.speed / 100);
        }
    }

    targetPosition() {
        const pos = new Point();
        if (this._animation.displayType === 2) {
            pos.x = Graphics.boxWidth / 2 + this._animation.offsetX;
            pos.y = Graphics.boxHeight / 2 + this._animation.offsetY;
        } else {
            for (const target of this._targets) {
                const tpos = this.targetSpritePosition(target);
                pos.x += tpos.x;
                pos.y += tpos.y;
            }
            pos.x /= Math.max(1, this._targets.length);
            pos.y /= Math.max(1, this._targets.length);
        }
        return pos;
    }

    targetSpritePosition(sprite) {
        const point = new Point(0, -sprite.height / 2);
        if (this._animation.alignBottom) point.y = 0;
        const g = sprite.toGlobal(point.x, point.y);
        const local = this.parent ? this.parent.toLocal(g) : g;
        local.x += this._animation.offsetX || 0;
        local.y += this._animation.offsetY || 0;
        return local;
    }

    updateMain() {
        this.processSoundTimings();
        this.processFlashTimings();
        this._frameIndex++;
        this.checkEnd();
    }

    processSoundTimings() {
        for (const timing of this._animation.soundTimings || []) {
            if (timing.frame === this._frameIndex) AudioManager.playSe(timing.se);
        }
    }

    processFlashTimings() {
        for (const timing of this._animation.flashTimings || []) {
            if (timing.frame === this._frameIndex) {
                this._flashColor = timing.color.clone();
                this._flashDuration = timing.duration;
            }
        }
    }

    checkEnd() {
        if (
            this._frameIndex > this._maxTimingFrames &&
            this._flashDuration === 0 &&
            !(this._handle && this._handle.exists)
        ) {
            this._playing = false;
        }
    }

    updateFlash() {
        if (this._flashDuration > 0) {
            const d = this._flashDuration--;
            this._flashColor[3] *= (d - 1) / d;
            for (const target of this._targets) target.setBlendColor(this._flashColor);
        }
    }

    // Fallback visual: a short ring of sparks at the target position.
    startBurst() {
        const n = 10;
        for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2;
            this._burst.push({ angle, dist: 4, life: 20 });
        }
    }

    updateBurst() {
        for (const p of this._burst) {
            p.dist += 3;
            p.life--;
        }
        this._burst = this._burst.filter(p => p.life > 0);
    }

    _renderSelf(ctx) {
        if (this._handle && this._handle.render) {
            this._handle.render(ctx);
            return;
        }
        if (this._burst.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const p of this._burst) {
            ctx.globalAlpha = Math.max(0, p.life / 20);
            ctx.fillStyle = "#fff4c0";
            ctx.beginPath();
            ctx.arc(Math.cos(p.angle) * p.dist, Math.sin(p.angle) * p.dist, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    isPlaying() {
        return this._playing;
    }
};

//-----------------------------------------------------------------------------
// Sprite_AnimationMV — frame-based animations (192px cells, 5 per row)

var Sprite_AnimationMV = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
    }

    initMembers() {
        this._targets = [];
        this._animation = null;
        this._mirror = false;
        this._delay = 0;
        this._rate = 4;
        this._duration = 0;
        this._flashColor = [0, 0, 0, 0];
        this._flashDuration = 0;
        this._screenFlashDuration = 0;
        this._hidingDuration = 0;
        this._hue1 = 0;
        this._hue2 = 0;
        this._bitmap1 = null;
        this._bitmap2 = null;
        this._cellSprites = [];
        this._screenFlashSprite = null;
        this.z = 8;
    }

    setup(targets, animation, mirror, delay) {
        this._targets = targets;
        this._animation = animation;
        this._mirror = mirror;
        this._delay = delay;
        if (this._animation) {
            this.setupRate();
            this.setupDuration();
            this.loadBitmaps();
            this.createCellSprites();
            this.createScreenFlashSprite();
        }
    }

    setupRate() {
        this._rate = 4;
    }

    setupDuration() {
        this._duration = this._animation.frames.length * this._rate + 1;
    }

    update() {
        super.update();
        this.updateMain();
        this.updateFlash();
        this.updateScreenFlash();
        this.updateHiding();
    }

    updateFlash() {
        if (this._flashDuration > 0) {
            const d = this._flashDuration--;
            this._flashColor[3] *= (d - 1) / d;
            for (const target of this._targets) target.setBlendColor(this._flashColor);
        }
    }

    updateScreenFlash() {
        if (this._screenFlashDuration > 0) {
            const d = this._screenFlashDuration--;
            if (this._screenFlashSprite) {
                this._screenFlashSprite.opacity *= (d - 1) / d;
                this._screenFlashSprite.visible = this._screenFlashDuration > 0;
            }
        }
    }

    updateHiding() {
        if (this._hidingDuration > 0) {
            this._hidingDuration--;
            if (this._hidingDuration === 0) {
                for (const target of this._targets) target.show();
            }
        }
    }

    isPlaying() {
        return this._duration > 0;
    }

    loadBitmaps() {
        this._bitmap1 = ImageManager.loadAnimation(this._animation.animation1Name);
        this._bitmap2 = ImageManager.loadAnimation(this._animation.animation2Name);
    }

    isReady() {
        const ok = b => !b || b.isReady() || b.isError();
        return ok(this._bitmap1) && ok(this._bitmap2);
    }

    createCellSprites() {
        this._cellSprites = [];
        for (let i = 0; i < 16; i++) {
            const sprite = new Sprite();
            sprite.anchor.x = 0.5;
            sprite.anchor.y = 0.5;
            this._cellSprites.push(sprite);
            this.addChild(sprite);
        }
    }

    createScreenFlashSprite() {
        this._screenFlashSprite = new ScreenSprite();
        this._screenFlashSprite.visible = false;
        this.addChild(this._screenFlashSprite);
    }

    updateMain() {
        if (this.isPlaying() && this.isReady()) {
            if (this._delay > 0) {
                this._delay--;
            } else {
                this._duration--;
                this.updatePosition();
                if (this._duration % this._rate === 0) this.updateFrame();
            }
        }
    }

    updatePosition() {
        if (this._animation.position === 3) {
            this.x = Graphics.width / 2;
            this.y = Graphics.height / 2;
            if (this.parent) {
                const p = this.parent.toLocal(new Point(this.x, this.y));
                this.x = p.x;
                this.y = p.y;
            }
        } else if (this._targets.length > 0) {
            const target = this._targets[0];
            const g = target.toGlobal(0, 0);
            const p = this.parent ? this.parent.toLocal(g) : g;
            this.x = p.x;
            this.y = p.y;
            if (this._animation.position === 0) this.y -= target.height;
            else if (this._animation.position === 1) this.y -= target.height / 2;
        }
    }

    updateFrame() {
        if (this._duration > 0) {
            const frameIndex = this.currentFrameIndex();
            this.updateAllCellSprites(this._animation.frames[frameIndex]);
            for (const timing of this._animation.timings) {
                if (timing.frame === frameIndex) this.processTimingData(timing);
            }
        }
    }

    currentFrameIndex() {
        return this._animation.frames.length - Math.floor((this._duration + this._rate - 1) / this._rate);
    }

    updateAllCellSprites(frame) {
        if (this._targets.length > 0 && frame) {
            for (let i = 0; i < this._cellSprites.length; i++) {
                const sprite = this._cellSprites[i];
                if (i < frame.length) this.updateCellSprite(sprite, frame[i]);
                else sprite.visible = false;
            }
        }
    }

    updateCellSprite(sprite, cell) {
        const pattern = cell[0];
        if (pattern >= 0) {
            const sx = (pattern % 5) * 192;
            const sy = Math.floor((pattern % 100) / 5) * 192;
            const mirror = this._mirror;
            sprite.bitmap = pattern < 100 ? this._bitmap1 : this._bitmap2;
            sprite.setHue(pattern < 100 ? this._animation.animation1Hue : this._animation.animation2Hue);
            sprite.setFrame(sx, sy, 192, 192);
            sprite.x = cell[1];
            sprite.y = cell[2];
            sprite.rotation = (cell[4] * Math.PI) / 180;
            sprite.scale.x = cell[3] / 100;
            if (cell[5]) sprite.scale.x *= -1;
            if (mirror) {
                sprite.x *= -1;
                sprite.rotation *= -1;
                sprite.scale.x *= -1;
            }
            sprite.scale.y = cell[3] / 100;
            sprite.opacity = cell[6];
            sprite.blendMode = cell[7];
            sprite.visible = true;
        } else {
            sprite.visible = false;
        }
    }

    processTimingData(timing) {
        const duration = timing.flashDuration * this._rate;
        switch (timing.flashScope) {
            case 1:
                this.startFlash(timing.flashColor, duration);
                break;
            case 2:
                this.startScreenFlash(timing.flashColor, duration);
                break;
            case 3:
                this.startHiding(duration);
                break;
        }
        if (timing.se) AudioManager.playSe(timing.se);
    }

    startFlash(color, duration) {
        this._flashColor = color.clone();
        this._flashDuration = duration;
    }

    startScreenFlash(color, duration) {
        this._screenFlashDuration = duration;
        if (this._screenFlashSprite) {
            this._screenFlashSprite.setColor(color[0], color[1], color[2]);
            this._screenFlashSprite.opacity = color[3];
            this._screenFlashSprite.visible = true;
        }
    }

    startHiding(duration) {
        this._hidingDuration = duration;
        for (const target of this._targets) target.hide();
    }
};

//-----------------------------------------------------------------------------
// Sprite_Damage

var Sprite_Damage = class extends Sprite {
    initialize() {
        super.initialize();
        this._duration = 90;
        this._flashColor = [0, 0, 0, 0];
        this._flashDuration = 0;
        this._colorType = 0;
    }

    destroy(options) {
        for (const child of this.children) {
            if (child.bitmap) child.bitmap.destroy();
        }
        super.destroy(options);
    }

    setup(target) {
        const result = target.result();
        if (result.missed || result.evaded) {
            this._colorType = 0;
            this.createMiss();
        } else if (result.hpAffected) {
            this._colorType = result.hpDamage >= 0 ? 0 : 1;
            this.createDigits(result.hpDamage);
        } else if (target.isAlive() && result.mpDamage !== 0) {
            this._colorType = result.mpDamage >= 0 ? 2 : 3;
            this.createDigits(result.mpDamage);
        }
        if (result.critical) this.setupCriticalEffect();
    }

    setupCriticalEffect() {
        this._flashColor = [255, 0, 0, 160];
        this._flashDuration = 60;
    }

    fontFace() {
        return $gameSystem.numberFontFace();
    }

    fontSize() {
        return $gameSystem.mainFontSize() + 4;
    }

    damageColor() {
        return ColorManager.damageColor(this._colorType);
    }

    outlineColor() {
        return "rgba(0, 0, 0, 0.7)";
    }

    outlineWidth() {
        return 4;
    }

    createMiss() {
        const h = this.fontSize();
        const w = Math.floor(h * 3.0);
        const sprite = this.createChildSprite(w, h);
        sprite.bitmap.drawText("Miss", 0, 0, w, h, "center");
        sprite.dy = 0;
    }

    createDigits(value) {
        const string = Math.abs(value).toString();
        const h = this.fontSize();
        const w = Math.floor(h * 0.75);
        for (let i = 0; i < string.length; i++) {
            const sprite = this.createChildSprite(w, h);
            sprite.bitmap.drawText(string[i], 0, 0, w, h, "center");
            sprite.x = (i - (string.length - 1) / 2) * w;
            sprite.dy = -i;
        }
    }

    createChildSprite(width, height) {
        const sprite = new Sprite();
        sprite.bitmap = this.createBitmap(width, height);
        sprite.anchor.x = 0.5;
        sprite.anchor.y = 1;
        sprite.y = -40;
        sprite.ry = sprite.y;
        this.addChild(sprite);
        return sprite;
    }

    createBitmap(width, height) {
        const bitmap = new Bitmap(width, height);
        bitmap.fontFace = this.fontFace();
        bitmap.fontSize = this.fontSize();
        bitmap.textColor = this.damageColor();
        bitmap.outlineColor = this.outlineColor();
        bitmap.outlineWidth = this.outlineWidth();
        return bitmap;
    }

    update() {
        super.update();
        if (this._duration > 0) {
            this._duration--;
            for (const child of this.children) this.updateChild(child);
        }
        this.updateFlash();
        this.updateOpacity();
    }

    updateChild(sprite) {
        sprite.dy += 0.5;
        sprite.ry += sprite.dy;
        if (sprite.ry >= 0) {
            sprite.ry = 0;
            sprite.dy *= -0.6;
        }
        sprite.y = Math.round(sprite.ry);
        sprite.setBlendColor(this._flashColor);
    }

    updateFlash() {
        if (this._flashDuration > 0) {
            const d = this._flashDuration--;
            this._flashColor[3] *= (d - 1) / d;
        }
    }

    updateOpacity() {
        if (this._duration < 10) this.opacity = (255 * this._duration) / 10;
    }

    isPlaying() {
        return this._duration > 0;
    }
};

//-----------------------------------------------------------------------------
// Sprite_StateIcon / Sprite_StateOverlay / Sprite_Weapon

var Sprite_StateIcon = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
        this.loadBitmap();
    }

    initMembers() {
        this._battler = null;
        this._iconIndex = 0;
        this._animationCount = 0;
        this._animationIndex = 0;
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
    }

    loadBitmap() {
        this.bitmap = ImageManager.loadSystem("IconSet");
        this.setFrame(0, 0, 0, 0);
    }

    setup(battler) {
        if (this._battler !== battler) {
            this._battler = battler;
            this._animationCount = this.animationWait();
        }
    }

    update() {
        super.update();
        this._animationCount++;
        if (this._animationCount >= this.animationWait()) {
            this.updateIcon();
            this.updateFrame();
            this._animationCount = 0;
        }
    }

    animationWait() {
        return 40;
    }

    updateIcon() {
        const icons = [];
        if (this.shouldDisplay()) icons.push(...this._battler.allIcons());
        if (icons.length > 0) {
            this._animationIndex++;
            if (this._animationIndex >= icons.length) this._animationIndex = 0;
            this._iconIndex = icons[this._animationIndex];
        } else {
            this._animationIndex = 0;
            this._iconIndex = 0;
        }
    }

    shouldDisplay() {
        const battler = this._battler;
        return battler && (battler.isActor() || battler.isAlive());
    }

    updateFrame() {
        const pw = ImageManager.iconWidth;
        const ph = ImageManager.iconHeight;
        const sx = (this._iconIndex % 16) * pw;
        const sy = Math.floor(this._iconIndex / 16) * ph;
        if (this._iconIndex > 0) this.setFrame(sx, sy, pw, ph);
        else this.setFrame(0, 0, 0, 0);
    }
};

var Sprite_StateOverlay = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
        this.loadBitmap();
    }

    initMembers() {
        this._battler = null;
        this._overlayIndex = 0;
        this._animationCount = 0;
        this._pattern = 0;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
    }

    loadBitmap() {
        this.bitmap = ImageManager.loadSystem("States");
        this.setFrame(0, 0, 0, 0);
    }

    setup(battler) {
        this._battler = battler;
    }

    update() {
        super.update();
        this._animationCount++;
        if (this._animationCount >= this.animationWait()) {
            this.updatePattern();
            this.updateFrame();
            this._animationCount = 0;
        }
    }

    animationWait() {
        return 8;
    }

    updatePattern() {
        this._pattern++;
        this._pattern %= 8;
        this._overlayIndex = this._battler ? this._battler.stateOverlayIndex() : 0;
    }

    updateFrame() {
        if (this._overlayIndex > 0) {
            const w = 96;
            const h = 96;
            const sx = this._pattern * w;
            const sy = (this._overlayIndex - 1) * h;
            this.setFrame(sx, sy, w, h);
        } else {
            this.setFrame(0, 0, 0, 0);
        }
    }
};

var Sprite_Weapon = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
    }

    initMembers() {
        this._weaponImageId = 0;
        this._animationCount = 0;
        this._pattern = 0;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this.x = -16;
    }

    setup(weaponImageId) {
        this._weaponImageId = weaponImageId;
        this._animationCount = 0;
        this._pattern = 0;
        this.loadBitmap();
        this.updateFrame();
    }

    update() {
        super.update();
        this._animationCount++;
        if (this._animationCount >= this.animationWait()) {
            this.updatePattern();
            this.updateFrame();
            this._animationCount = 0;
        }
    }

    animationWait() {
        return 12;
    }

    updatePattern() {
        this._pattern++;
        if (this._pattern >= 3) this._weaponImageId = 0;
    }

    loadBitmap() {
        const pageId = Math.floor((this._weaponImageId - 1) / 12) + 1;
        if (pageId >= 1) this.bitmap = ImageManager.loadSystem("Weapons" + pageId);
        else this.bitmap = ImageManager.loadSystem("");
    }

    updateFrame() {
        if (this._weaponImageId > 0) {
            const index = (this._weaponImageId - 1) % 12;
            const w = 96;
            const h = 64;
            const sx = (Math.floor(index / 6) * 3 + this._pattern) * w;
            const sy = Math.floor(index % 6) * h;
            this.setFrame(sx, sy, w, h);
        } else {
            this.setFrame(0, 0, 0, 0);
        }
    }

    isPlaying() {
        return this._weaponImageId > 0;
    }
};

//-----------------------------------------------------------------------------
// Sprite_Balloon

var Sprite_Balloon = class extends Sprite {
    initialize() {
        super.initialize();
        this.initMembers();
        this.loadBitmap();
    }

    initMembers() {
        this._target = null;
        this._balloonId = 0;
        this._duration = 0;
        this.anchor.x = 0.5;
        this.anchor.y = 1;
        this.z = 7;
    }

    loadBitmap() {
        this.bitmap = ImageManager.loadSystem("Balloon");
        this.setFrame(0, 0, 0, 0);
    }

    setup(targetSprite, balloonId) {
        this._target = targetSprite;
        this._balloonId = balloonId;
        this._duration = 8 * this.speed() + this.waitTime();
    }

    update() {
        super.update();
        if (this._duration > 0) {
            this._duration--;
            if (this._duration > 0) this.updateFrame();
        }
        this.updatePosition();
    }

    updatePosition() {
        this.x = this._target.x;
        this.y = this._target.y - this._target.height;
    }

    updateFrame() {
        const w = 48;
        const h = 48;
        const sx = this.frameIndex() * w;
        const sy = (this._balloonId - 1) * h;
        this.setFrame(sx, sy, w, h);
    }

    speed() {
        return 8;
    }

    waitTime() {
        return 12;
    }

    frameIndex() {
        const index = (this._duration - this.waitTime()) / this.speed();
        return 7 - Math.max(Math.floor(index), 0);
    }

    isPlaying() {
        return this._duration > 0;
    }
};

//-----------------------------------------------------------------------------
// Sprite_Picture

var Sprite_Picture = class extends Sprite_Clickable {
    initialize(pictureId) {
        super.initialize();
        this._pictureId = pictureId;
        this._pictureName = "";
        this.update();
    }

    picture() {
        return $gameScreen.picture(this._pictureId);
    }

    update() {
        super.update();
        this.updateBitmap();
        if (this.visible) {
            this.updateOrigin();
            this.updatePosition();
            this.updateScale();
            this.updateTone();
            this.updateOther();
        }
    }

    updateBitmap() {
        const picture = this.picture();
        if (picture) {
            const pictureName = picture.name();
            if (this._pictureName !== pictureName) {
                this._pictureName = pictureName;
                this.loadBitmap();
            }
            this.visible = true;
        } else {
            this._pictureName = "";
            this.bitmap = null;
            this.visible = false;
        }
    }

    updateOrigin() {
        const picture = this.picture();
        if (picture.origin() === 0) {
            this.anchor.x = 0;
            this.anchor.y = 0;
        } else {
            this.anchor.x = 0.5;
            this.anchor.y = 0.5;
        }
    }

    updatePosition() {
        const picture = this.picture();
        this.x = Math.round(picture.x());
        this.y = Math.round(picture.y());
    }

    updateScale() {
        const picture = this.picture();
        this.scale.x = picture.scaleX() / 100;
        this.scale.y = picture.scaleY() / 100;
    }

    updateTone() {
        const picture = this.picture();
        if (picture.tone()) this.setColorTone(picture.tone());
        else this.setColorTone([0, 0, 0, 0]);
    }

    updateOther() {
        const picture = this.picture();
        this.opacity = picture.opacity();
        this.blendMode = picture.blendMode();
        this.rotation = (picture.angle() * Math.PI) / 180;
    }

    loadBitmap() {
        this.bitmap = ImageManager.loadPicture(this._pictureName);
        if (this.bitmap) this.bitmap.smooth = true;
    }

    isClickEnabled() {
        return false;
    }
};

//-----------------------------------------------------------------------------
// Sprite_Timer

var Sprite_Timer = class extends Sprite {
    initialize() {
        super.initialize();
        this._seconds = 0;
        this.createBitmap();
        this.update();
    }

    destroy(options) {
        if (this.bitmap) this.bitmap.destroy();
        super.destroy(options);
    }

    createBitmap() {
        this.bitmap = new Bitmap(96, 48);
        this.bitmap.fontFace = this.fontFace();
        this.bitmap.fontSize = this.fontSize();
        this.bitmap.outlineColor = ColorManager.outlineColor();
    }

    fontFace() {
        return $gameSystem.numberFontFace();
    }

    fontSize() {
        return $gameSystem.mainFontSize() + 8;
    }

    update() {
        super.update();
        this.updateBitmap();
        this.updatePosition();
        this.updateVisibility();
    }

    updateBitmap() {
        if (this._seconds !== $gameTimer.seconds()) {
            this._seconds = $gameTimer.seconds();
            this.redraw();
        }
    }

    redraw() {
        const text = this.timerText();
        const width = this.bitmap.width;
        const height = this.bitmap.height;
        this.bitmap.clear();
        this.bitmap.drawText(text, 0, 0, width, height, "center");
    }

    timerText() {
        const min = Math.floor(this._seconds / 60) % 60;
        const sec = this._seconds % 60;
        return min.padZero(2) + ":" + sec.padZero(2);
    }

    updatePosition() {
        this.x = (Graphics.width - this.bitmap.width) / 2;
        this.y = 0;
    }

    updateVisibility() {
        this.visible = $gameTimer.isWorking();
    }
};

//-----------------------------------------------------------------------------
// Sprite_Destination — touch-move target marker

var Sprite_Destination = class extends Sprite {
    initialize() {
        super.initialize();
        this.createBitmap();
        this._frameCount = 0;
    }

    destroy(options) {
        if (this.bitmap) this.bitmap.destroy();
        super.destroy(options);
    }

    update() {
        super.update();
        if ($gameTemp.isDestinationValid()) {
            this.updatePosition();
            this.updateAnimation();
            this.visible = true;
        } else {
            this._frameCount = 0;
            this.visible = false;
        }
    }

    createBitmap() {
        const tileWidth = $gameMap.tileWidth();
        const tileHeight = $gameMap.tileHeight();
        this.bitmap = new Bitmap(tileWidth, tileHeight);
        this.bitmap.fillAll("white");
        this.anchor.x = 0.5;
        this.anchor.y = 0.5;
        this.blendMode = 1;
    }

    updatePosition() {
        const tileWidth = $gameMap.tileWidth();
        const tileHeight = $gameMap.tileHeight();
        const x = $gameTemp.destinationX();
        const y = $gameTemp.destinationY();
        this.x = ($gameMap.adjustX(x) + 0.5) * tileWidth;
        this.y = ($gameMap.adjustY(y) + 0.5) * tileHeight;
    }

    updateAnimation() {
        this._frameCount++;
        this._frameCount %= 20;
        this.opacity = (20 - this._frameCount) * 6;
        this.scale.x = 1 + this._frameCount / 20;
        this.scale.y = this.scale.x;
    }
};

//-----------------------------------------------------------------------------
// Sprite_Battleback

var Sprite_Battleback = class extends TilingSprite {
    initialize(type) {
        super.initialize();
        if (type === 0) this.bitmap = this.battleback1Bitmap();
        else this.bitmap = this.battleback2Bitmap();
    }

    adjustPosition() {
        this.width = Math.floor((1000 * Graphics.width) / 816);
        this.height = Math.floor((740 * Graphics.height) / 624);
        this.x = (Graphics.width - this.width) / 2;
        if ($gameSystem.isSideView()) this.y = Graphics.height - this.height;
        else this.y = 0;
        const bw = this.bitmap && this.bitmap.width ? this.bitmap.width : this.width;
        const bh = this.bitmap && this.bitmap.height ? this.bitmap.height : this.height;
        const ratioX = this.width / bw;
        const ratioY = this.height / bh;
        const scale = Math.max(ratioX, ratioY, 1.0);
        this.scale.x = scale;
        this.scale.y = scale;
        // Keep the visible area centred after scaling.
        this.width = this.width / scale;
        this.height = this.height / scale;
        this.x = (Graphics.width - this.width * scale) / 2;
        if ($gameSystem.isSideView()) this.y = Graphics.height - this.height * scale;
    }

    battleback1Bitmap() {
        return ImageManager.loadBattleback1(this.battleback1Name());
    }

    battleback2Bitmap() {
        return ImageManager.loadBattleback2(this.battleback2Name());
    }

    battleback1Name() {
        if (BattleManager.isBattleTest()) return $dataSystem.battleback1Name;
        if ($gameMap.battleback1Name() !== null) return $gameMap.battleback1Name();
        if ($gameMap.isOverworld()) return this.overworldBattleback1Name();
        return "";
    }

    battleback2Name() {
        if (BattleManager.isBattleTest()) return $dataSystem.battleback2Name;
        if ($gameMap.battleback2Name() !== null) return $gameMap.battleback2Name();
        if ($gameMap.isOverworld()) return this.overworldBattleback2Name();
        return "";
    }

    overworldBattleback1Name() {
        if ($gamePlayer.isInVehicle()) return this.shipBattleback1Name();
        return this.normalBattleback1Name();
    }

    overworldBattleback2Name() {
        if ($gamePlayer.isInVehicle()) return this.shipBattleback2Name();
        return this.normalBattleback2Name();
    }

    normalBattleback1Name() {
        return (
            this.terrainBattleback1Name(this.autotileType(1)) ||
            this.terrainBattleback1Name(this.autotileType(0)) ||
            this.defaultBattleback1Name()
        );
    }

    normalBattleback2Name() {
        return (
            this.terrainBattleback2Name(this.autotileType(1)) ||
            this.terrainBattleback2Name(this.autotileType(0)) ||
            this.defaultBattleback2Name()
        );
    }

    terrainBattleback1Name(type) {
        switch (type) {
            case 24:
            case 25:
                return "Wasteland";
            case 26:
            case 27:
                return "DirtField";
            case 32:
            case 33:
                return "Desert";
            case 34:
                return "Lava1";
            case 35:
                return "Lava2";
            case 40:
            case 41:
                return "Snowfield";
            case 42:
                return "Clouds";
            case 4:
            case 5:
                return "PoisonSwamp";
            default:
                return null;
        }
    }

    terrainBattleback2Name(type) {
        switch (type) {
            case 20:
            case 21:
                return "Forest";
            case 22:
            case 30:
            case 38:
                return "Cliff";
            case 24:
            case 25:
            case 26:
            case 27:
                return "Wasteland";
            case 32:
            case 33:
                return "Desert";
            case 34:
            case 35:
                return "Lava";
            case 40:
            case 41:
                return "Snowfield";
            case 42:
                return "Clouds";
            case 4:
            case 5:
                return "PoisonSwamp";
            default:
                return null;
        }
    }

    defaultBattleback1Name() {
        return "Grassland";
    }

    defaultBattleback2Name() {
        return "Grassland";
    }

    shipBattleback1Name() {
        return "Ship";
    }

    shipBattleback2Name() {
        return "Ship";
    }

    autotileType(z) {
        return $gameMap.autotileType($gamePlayer.x, $gamePlayer.y, z);
    }
};

//-----------------------------------------------------------------------------
// ToneSprite — container that applies the screen colour tone to its
// contents after they are drawn (replaces MZ's base ColorFilter).

var ToneSprite = class extends Sprite {
    initialize() {
        super.initialize();
        this._tone = [0, 0, 0, 0];
    }
    setTone(tone) {
        this._tone = tone ? tone.slice() : [0, 0, 0, 0];
    }
    render(ctx) {
        super.render(ctx);
        const t = this._tone;
        if (this.visible && (t[0] || t[1] || t[2] || t[3])) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            Tint.applyScreenTone(ctx, 0, 0, Graphics.width, Graphics.height, t);
            ctx.restore();
        }
    }
};

// OverallFilterSprite — flash colour and brightness over the whole spriteset.
var OverallFilterSprite = class extends Container {
    initialize() {
        super.initialize();
        this._blendColor = [0, 0, 0, 0];
        this._brightness = 255;
    }
    setBlendColor(color) {
        this._blendColor = color ? color.slice() : [0, 0, 0, 0];
    }
    setBrightness(brightness) {
        this._brightness = brightness;
    }
    render(ctx) {
        const c = this._blendColor;
        const b = this._brightness;
        if (c[3] <= 0 && b >= 255) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (c[3] > 0) {
            ctx.globalAlpha = c[3] / 255;
            ctx.fillStyle = Utils.rgbToCssColor(c[0], c[1], c[2]);
            ctx.fillRect(0, 0, Graphics.width, Graphics.height);
        }
        if (b < 255) {
            ctx.globalAlpha = 1 - Math.max(0, b) / 255;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, Graphics.width, Graphics.height);
        }
        ctx.restore();
    }
};

//-----------------------------------------------------------------------------
// Spriteset_Base

var Spriteset_Base = class extends Sprite {
    initialize() {
        super.initialize();
        this.setFrame(0, 0, Graphics.width, Graphics.height);
        this.loadSystemImages();
        this.createLowerLayer();
        this.createUpperLayer();
        this._animationSprites = [];
    }

    destroy(options) {
        this.removeAllAnimations();
        super.destroy(options);
    }

    loadSystemImages() {}

    createLowerLayer() {
        this.createBaseSprite();
        this.createBaseFilters();
    }

    createUpperLayer() {
        this.createPictures();
        this.createTimer();
        this.createOverallFilters();
    }

    update() {
        super.update();
        this.updateBaseFilters();
        this.updateOverallFilters();
        this.updatePosition();
        this.updateAnimations();
    }

    createBaseSprite() {
        this._baseSprite = new ToneSprite();
        this._blackScreen = new ScreenSprite();
        this._blackScreen.opacity = 255;
        this.addChild(this._baseSprite);
        this._baseSprite.addChild(this._blackScreen);
    }

    createBaseFilters() {
        this._baseColorFilter = this._baseSprite;
    }

    createPictures() {
        const rect = this.pictureContainerRect();
        this._pictureContainer = new Sprite();
        this._pictureContainer.setFrame(rect.x, rect.y, rect.width, rect.height);
        for (let i = 1; i <= $gameScreen.maxPictures(); i++) {
            this._pictureContainer.addChild(new Sprite_Picture(i));
        }
        this.addChild(this._pictureContainer);
    }

    pictureContainerRect() {
        return new Rectangle(0, 0, Graphics.width, Graphics.height);
    }

    createTimer() {
        this._timerSprite = new Sprite_Timer();
        this.addChild(this._timerSprite);
    }

    createOverallFilters() {
        this._overallColorFilter = new OverallFilterSprite();
        this.addChild(this._overallColorFilter);
    }

    updateBaseFilters() {
        this._baseColorFilter.setTone($gameScreen.tone());
    }

    updateOverallFilters() {
        const filter = this._overallColorFilter;
        filter.setBlendColor($gameScreen.flashColor());
        filter.setBrightness($gameScreen.brightness());
    }

    updatePosition() {
        const screen = $gameScreen;
        const scale = screen.zoomScale();
        this.scale.x = scale;
        this.scale.y = scale;
        this.x = Math.round(-screen.zoomX() * (scale - 1));
        this.y = Math.round(-screen.zoomY() * (scale - 1));
        this.x += Math.round(screen.shake());
    }

    findTargetSprite(/* target */) {
        return null;
    }

    updateAnimations() {
        for (const sprite of this._animationSprites.slice()) {
            if (!sprite.isPlaying()) this.removeAnimation(sprite);
        }
        this.processAnimationRequests();
    }

    processAnimationRequests() {
        for (;;) {
            const request = $gameTemp.retrieveAnimation();
            if (request) this.createAnimation(request);
            else break;
        }
    }

    createAnimation(request) {
        const animation = $dataAnimations[request.animationId];
        const targets = request.targets;
        const mirror = request.mirror;
        let delay = this.animationBaseDelay();
        const nextDelay = this.animationNextDelay();
        if (this.isAnimationForEach(animation)) {
            for (const target of targets) {
                this.createAnimationSprite([target], animation, mirror, delay);
                delay += nextDelay;
            }
        } else {
            this.createAnimationSprite(targets, animation, mirror, delay);
        }
    }

    createAnimationSprite(targets, animation, mirror, delay) {
        const mv = this.isMVAnimation(animation);
        const sprite = new (mv ? Sprite_AnimationMV : Sprite_Animation)();
        const targetSprites = this.makeTargetSprites(targets);
        const baseDelay = this.animationBaseDelay();
        const previous = delay > baseDelay ? this.lastAnimationSprite() : null;
        if (this.animationShouldMirror(targets[0])) mirror = !mirror;
        sprite.targetObjects = targets;
        sprite.setup(targetSprites, animation, mirror, delay, previous);
        this._effectsContainer.addChild(sprite);
        this._animationSprites.push(sprite);
    }

    isMVAnimation(animation) {
        return !!animation.frames;
    }

    makeTargetSprites(targets) {
        const targetSprites = [];
        for (const target of targets) {
            const targetSprite = this.findTargetSprite(target);
            if (targetSprite) targetSprites.push(targetSprite);
        }
        return targetSprites;
    }

    lastAnimationSprite() {
        return this._animationSprites[this._animationSprites.length - 1];
    }

    isAnimationForEach(animation) {
        const mv = this.isMVAnimation(animation);
        return mv ? animation.position !== 3 : animation.displayType === 0;
    }

    animationBaseDelay() {
        return 0;
    }

    animationNextDelay() {
        return 0;
    }

    animationShouldMirror(/* target */) {
        return false;
    }

    removeAnimation(sprite) {
        this._animationSprites.remove(sprite);
        this._effectsContainer.removeChild(sprite);
        for (const target of sprite.targetObjects) {
            if (target.endAnimation) target.endAnimation();
        }
        sprite.destroy();
    }

    removeAllAnimations() {
        for (const sprite of (this._animationSprites || []).slice()) this.removeAnimation(sprite);
    }

    isAnimationPlaying() {
        return this._animationSprites.length > 0;
    }
};

//-----------------------------------------------------------------------------
// Spriteset_Map

var Spriteset_Map = class extends Spriteset_Base {
    initialize() {
        super.initialize();
        this._balloonSprites = [];
    }

    destroy(options) {
        this.removeAllBalloons();
        super.destroy(options);
    }

    loadSystemImages() {
        super.loadSystemImages();
        ImageManager.loadSystem("Balloon");
        ImageManager.loadSystem("Shadow1");
    }

    createLowerLayer() {
        super.createLowerLayer();
        this.createParallax();
        this.createTilemap();
        this.createCharacters();
        this.createShadow();
        this.createDestination();
        this.createWeather();
    }

    update() {
        super.update();
        this.updateTileset();
        this.updateParallax();
        this.updateTilemap();
        this.updateShadow();
        this.updateWeather();
        this.updateBalloons();
    }

    hideCharacters() {
        for (const sprite of this._characterSprites) {
            if (!sprite.isTile() && !sprite.isObjectCharacter()) sprite.hide();
        }
    }

    createParallax() {
        this._parallax = new TilingSprite();
        this._parallax.move(0, 0, Graphics.width, Graphics.height);
        this._baseSprite.addChild(this._parallax);
    }

    createTilemap() {
        const tilemap = new Tilemap();
        tilemap.tileWidth = $gameMap.tileWidth();
        tilemap.tileHeight = $gameMap.tileHeight();
        tilemap.setData($gameMap.width(), $gameMap.height(), $gameMap.data());
        tilemap.horizontalWrap = $gameMap.isLoopHorizontal();
        tilemap.verticalWrap = $gameMap.isLoopVertical();
        this._baseSprite.addChild(tilemap);
        this._effectsContainer = tilemap;
        this._tilemap = tilemap;
        this.loadTileset();
    }

    loadTileset() {
        this._tileset = $gameMap.tileset();
        if (this._tileset) {
            const bitmaps = [];
            const tilesetNames = this._tileset.tilesetNames;
            for (const name of tilesetNames) bitmaps.push(ImageManager.loadTileset(name));
            this._tilemap.setBitmaps(bitmaps);
            this._tilemap.flags = $gameMap.tilesetFlags();
        }
    }

    createCharacters() {
        this._characterSprites = [];
        for (const event of $gameMap.events()) this._characterSprites.push(new Sprite_Character(event));
        for (const vehicle of $gameMap.vehicles()) this._characterSprites.push(new Sprite_Character(vehicle));
        for (const follower of $gamePlayer.followers().reverseData()) {
            this._characterSprites.push(new Sprite_Character(follower));
        }
        this._characterSprites.push(new Sprite_Character($gamePlayer));
        for (const sprite of this._characterSprites) this._tilemap.addChild(sprite);
    }

    createShadow() {
        this._shadowSprite = new Sprite();
        this._shadowSprite.bitmap = ImageManager.loadSystem("Shadow1");
        this._shadowSprite.anchor.x = 0.5;
        this._shadowSprite.anchor.y = 1;
        this._shadowSprite.z = 6;
        this._tilemap.addChild(this._shadowSprite);
    }

    createDestination() {
        this._destinationSprite = new Sprite_Destination();
        this._destinationSprite.z = 9;
        this._tilemap.addChild(this._destinationSprite);
    }

    createWeather() {
        this._weather = new Weather();
        this.addChild(this._weather);
    }

    updateTileset() {
        if (this._tileset !== $gameMap.tileset()) this.loadTileset();
    }

    updateParallax() {
        if (this._parallaxName !== $gameMap.parallaxName()) {
            this._parallaxName = $gameMap.parallaxName();
            this._parallax.bitmap = ImageManager.loadParallax(this._parallaxName);
        }
        if (this._parallax.bitmap && this._parallax.bitmap.width > 0) {
            const bitmap = this._parallax.bitmap;
            this._parallax.origin.x = $gameMap.parallaxOx() % bitmap.width;
            this._parallax.origin.y = $gameMap.parallaxOy() % bitmap.height;
        }
    }

    updateTilemap() {
        this._tilemap.origin.x = $gameMap.displayX() * $gameMap.tileWidth();
        this._tilemap.origin.y = $gameMap.displayY() * $gameMap.tileHeight();
    }

    updateShadow() {
        const airship = $gameMap.airship();
        this._shadowSprite.x = airship.shadowX();
        this._shadowSprite.y = airship.shadowY();
        this._shadowSprite.opacity = airship.shadowOpacity();
    }

    updateWeather() {
        this._weather.type = $gameScreen.weatherType();
        this._weather.power = $gameScreen.weatherPower();
        this._weather.origin.x = $gameMap.displayX() * $gameMap.tileWidth();
        this._weather.origin.y = $gameMap.displayY() * $gameMap.tileHeight();
    }

    updateBalloons() {
        for (const sprite of this._balloonSprites.slice()) {
            if (!sprite.isPlaying()) this.removeBalloon(sprite);
        }
        this.processBalloonRequests();
    }

    processBalloonRequests() {
        for (;;) {
            const request = $gameTemp.retrieveBalloon();
            if (request) this.createBalloon(request);
            else break;
        }
    }

    createBalloon(request) {
        const targetSprite = this.findTargetSprite(request.target);
        if (targetSprite) {
            const sprite = new Sprite_Balloon();
            sprite.targetObject = request.target;
            sprite.setup(targetSprite, request.balloonId);
            this._effectsContainer.addChild(sprite);
            this._balloonSprites.push(sprite);
        }
    }

    removeBalloon(sprite) {
        this._balloonSprites.remove(sprite);
        this._effectsContainer.removeChild(sprite);
        if (sprite.targetObject.endBalloon) sprite.targetObject.endBalloon();
        sprite.destroy();
    }

    removeAllBalloons() {
        for (const sprite of (this._balloonSprites || []).slice()) this.removeBalloon(sprite);
    }

    findTargetSprite(target) {
        return this._characterSprites.find(sprite => sprite.checkCharacter(target));
    }

    animationBaseDelay() {
        return 0;
    }
};

//-----------------------------------------------------------------------------
// Spriteset_Battle

var Spriteset_Battle = class extends Spriteset_Base {
    initialize() {
        super.initialize();
        this._battlebackLocated = false;
    }

    loadSystemImages() {
        super.loadSystemImages();
        ImageManager.loadSystem("Shadow2");
        ImageManager.loadSystem("Weapons1");
        ImageManager.loadSystem("Weapons2");
        ImageManager.loadSystem("Weapons3");
    }

    createLowerLayer() {
        super.createLowerLayer();
        this.createBackground();
        this.createBattleback();
        this.createBattleField();
        this.createEnemies();
        this.createActors();
    }

    createBackground() {
        this._backgroundSprite = new Sprite();
        const snap = SceneManager.backgroundBitmap();
        if (snap) {
            // Blur the map snapshot like MZ's BlurFilter.
            const bitmap = new Bitmap(snap.width, snap.height);
            const ctx = bitmap.context;
            try {
                ctx.filter = "blur(4px)";
            } catch (e) {
                // unsupported
            }
            ctx.drawImage(snap.source, 0, 0);
            ctx.filter = "none";
            bitmap.touch();
            this._backgroundSprite.bitmap = bitmap;
        }
        this._baseSprite.addChild(this._backgroundSprite);
    }

    createBattleback() {
        this._back1Sprite = new Sprite_Battleback(0);
        this._back2Sprite = new Sprite_Battleback(1);
        this._baseSprite.addChild(this._back1Sprite);
        this._baseSprite.addChild(this._back2Sprite);
    }

    createBattleField() {
        const width = Graphics.boxWidth;
        const height = Graphics.boxHeight;
        const x = (Graphics.width - width) / 2;
        const y = (Graphics.height - height) / 2;
        this._battleField = new Sprite();
        this._battleField.setFrame(0, 0, width, height);
        this._battleField.x = x;
        this._battleField.y = y - this.battleFieldOffsetY();
        this._baseSprite.addChild(this._battleField);
        this._effectsContainer = this._battleField;
    }

    battleFieldOffsetY() {
        return 24;
    }

    update() {
        super.update();
        this.updateActors();
        this.updateBattleback();
    }

    updateBattleback() {
        if (!this._battlebackLocated) {
            this._back1Sprite.adjustPosition();
            this._back2Sprite.adjustPosition();
            this._battlebackLocated = true;
        }
    }

    createEnemies() {
        const enemies = $gameTroop.members();
        const sprites = [];
        for (const enemy of enemies) sprites.push(new Sprite_Enemy(enemy));
        sprites.sort(this.compareEnemySprite.bind(this));
        for (const sprite of sprites) this._battleField.addChild(sprite);
        this._enemySprites = sprites;
    }

    compareEnemySprite(a, b) {
        if (a.y !== b.y) return a.y - b.y;
        return b.spriteId - a.spriteId;
    }

    createActors() {
        this._actorSprites = [];
        if ($gameSystem.isSideView()) {
            for (let i = 0; i < $gameParty.maxBattleMembers(); i++) {
                const sprite = new Sprite_Actor();
                this._actorSprites.push(sprite);
                this._battleField.addChild(sprite);
            }
        }
    }

    updateActors() {
        const members = $gameParty.battleMembers();
        for (let i = 0; i < this._actorSprites.length; i++) this._actorSprites[i].setBattler(members[i]);
    }

    findTargetSprite(target) {
        return this.battlerSprites().find(sprite => sprite.checkBattler(target));
    }

    battlerSprites() {
        return this._enemySprites.concat(this._actorSprites);
    }

    isEffecting() {
        return this.battlerSprites().some(sprite => sprite.isEffecting());
    }

    isAnyoneMoving() {
        return this.battlerSprites().some(sprite => sprite.isMoving());
    }

    isBusy() {
        return this.isAnimationPlaying() || this.isAnyoneMoving();
    }

    animationBaseDelay() {
        return 8;
    }

    animationNextDelay() {
        return 12;
    }

    animationShouldMirror(target) {
        return target && target.isActor();
    }
};
