//=============================================================================
// rpg9k_objects.js — Game_Temp, Game_System, Game_Timer, Game_Message,
// Game_Switches, Game_Variables, Game_SelfSwitches, Game_Screen,
// Game_Picture, Game_Map, Game_CommonEvent, Game_CharacterBase,
// Game_Character, Game_Player, Game_Follower, Game_Followers, Game_Vehicle,
// Game_Event
//=============================================================================
"use strict";

//-----------------------------------------------------------------------------
// Game_Temp — temporary data not included in save files

var Game_Temp = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this._isPlaytest = Utils.isOptionValid("test");
        this._destinationX = null;
        this._destinationY = null;
        this._touchTarget = null;
        this._touchState = "";
        this._needsBattleRefresh = false;
        this._commonEventQueue = [];
        this._animationQueue = [];
        this._balloonQueue = [];
        this._lastActionData = [0, 0, 0, 0, 0, 0];
    }

    isPlaytest() {
        return this._isPlaytest;
    }

    setDestination(x, y) {
        this._destinationX = x;
        this._destinationY = y;
    }

    clearDestination() {
        this._destinationX = null;
        this._destinationY = null;
    }

    isDestinationValid() {
        return this._destinationX !== null;
    }

    destinationX() {
        return this._destinationX;
    }

    destinationY() {
        return this._destinationY;
    }

    setTouchState(target, state) {
        this._touchTarget = target;
        this._touchState = state;
    }

    clearTouchState() {
        this._touchTarget = null;
        this._touchState = "";
    }

    touchTarget() {
        return this._touchTarget;
    }

    touchState() {
        return this._touchState;
    }

    requestBattleRefresh() {
        if ($gameParty.inBattle()) this._needsBattleRefresh = true;
    }

    clearBattleRefreshRequest() {
        this._needsBattleRefresh = false;
    }

    isBattleRefreshRequested() {
        return this._needsBattleRefresh;
    }

    reserveCommonEvent(commonEventId) {
        this._commonEventQueue.push(commonEventId);
    }

    retrieveCommonEvent() {
        return $dataCommonEvents[this._commonEventQueue.shift()];
    }

    clearCommonEventReservation() {
        this._commonEventQueue.length = 0;
    }

    isCommonEventReserved() {
        return this._commonEventQueue.length > 0;
    }

    requestAnimation(targets, animationId, mirror = false) {
        if ($dataAnimations[animationId]) {
            const request = { targets: targets, animationId: animationId, mirror: mirror };
            this._animationQueue.push(request);
            for (const target of targets) {
                if (target.startAnimation) target.startAnimation();
            }
        }
    }

    retrieveAnimation() {
        return this._animationQueue.shift();
    }

    requestBalloon(target, balloonId) {
        const request = { target: target, balloonId: balloonId };
        this._balloonQueue.push(request);
        if (target.startBalloon) target.startBalloon();
    }

    retrieveBalloon() {
        return this._balloonQueue.shift();
    }

    lastActionData(type) {
        return this._lastActionData[type] || 0;
    }

    setLastActionData(type, value) {
        this._lastActionData[type] = value;
    }

    setLastUsedSkillId(skillID) {
        this.setLastActionData(0, skillID);
    }

    setLastUsedItemId(itemID) {
        this.setLastActionData(1, itemID);
    }

    setLastSubjectActorId(actorID) {
        this.setLastActionData(2, actorID);
    }

    setLastSubjectEnemyIndex(enemyIndex) {
        this.setLastActionData(3, enemyIndex);
    }

    setLastTargetActorId(actorID) {
        this.setLastActionData(4, actorID);
    }

    setLastTargetEnemyIndex(enemyIndex) {
        this.setLastActionData(5, enemyIndex);
    }
};

//-----------------------------------------------------------------------------
// Game_System

var Game_System = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this._saveEnabled = true;
        this._menuEnabled = true;
        this._encounterEnabled = true;
        this._formationEnabled = true;
        this._battleCount = 0;
        this._winCount = 0;
        this._escapeCount = 0;
        this._saveCount = 0;
        this._versionId = 0;
        this._savefileId = 0;
        this._framesOnSave = 0;
        this._bgmOnSave = null;
        this._bgsOnSave = null;
        this._windowTone = null;
        this._battleBgm = null;
        this._victoryMe = null;
        this._defeatMe = null;
        this._savedBgm = null;
        this._walkingBgm = null;
    }

    isJapanese() {
        return $dataSystem.locale.match(/^ja/);
    }
    isChinese() {
        return $dataSystem.locale.match(/^zh/);
    }
    isKorean() {
        return $dataSystem.locale.match(/^ko/);
    }
    isCJK() {
        return $dataSystem.locale.match(/^(ja|zh|ko)/);
    }
    isRussian() {
        return $dataSystem.locale.match(/^ru/);
    }
    isSideView() {
        return $dataSystem.optSideView;
    }
    isAutosaveEnabled() {
        return $dataSystem.optAutosave;
    }
    isMessageSkipEnabled() {
        return $dataSystem.optMessageSkip;
    }
    isSaveEnabled() {
        return this._saveEnabled;
    }
    disableSave() {
        this._saveEnabled = false;
    }
    enableSave() {
        this._saveEnabled = true;
    }
    isMenuEnabled() {
        return this._menuEnabled;
    }
    disableMenu() {
        this._menuEnabled = false;
    }
    enableMenu() {
        this._menuEnabled = true;
    }
    isEncounterEnabled() {
        return this._encounterEnabled;
    }
    disableEncounter() {
        this._encounterEnabled = false;
    }
    enableEncounter() {
        this._encounterEnabled = true;
    }
    isFormationEnabled() {
        return this._formationEnabled;
    }
    disableFormation() {
        this._formationEnabled = false;
    }
    enableFormation() {
        this._formationEnabled = true;
    }
    battleCount() {
        return this._battleCount;
    }
    winCount() {
        return this._winCount;
    }
    escapeCount() {
        return this._escapeCount;
    }
    saveCount() {
        return this._saveCount;
    }
    versionId() {
        return this._versionId;
    }
    savefileId() {
        return this._savefileId || 0;
    }
    setSavefileId(savefileId) {
        this._savefileId = savefileId;
    }
    windowTone() {
        return this._windowTone || $dataSystem.windowTone;
    }
    setWindowTone(value) {
        this._windowTone = value;
    }
    battleBgm() {
        return this._battleBgm || $dataSystem.battleBgm;
    }
    setBattleBgm(value) {
        this._battleBgm = value;
    }
    victoryMe() {
        return this._victoryMe || $dataSystem.victoryMe;
    }
    setVictoryMe(value) {
        this._victoryMe = value;
    }
    defeatMe() {
        return this._defeatMe || $dataSystem.defeatMe;
    }
    setDefeatMe(value) {
        this._defeatMe = value;
    }
    onBattleStart() {
        this._battleCount++;
    }
    onBattleWin() {
        this._winCount++;
    }
    onBattleEscape() {
        this._escapeCount++;
    }

    onBeforeSave() {
        this._saveCount++;
        this._versionId = $dataSystem.versionId;
        this._framesOnSave = Graphics.frameCount;
        this._bgmOnSave = AudioManager.saveBgm();
        this._bgsOnSave = AudioManager.saveBgs();
    }

    onAfterLoad() {
        Graphics.frameCount = this._framesOnSave;
        AudioManager.playBgm(this._bgmOnSave);
        AudioManager.playBgs(this._bgsOnSave);
    }

    playtime() {
        return Math.floor(Graphics.frameCount / 60);
    }

    playtimeText() {
        const hour = Math.floor(this.playtime() / 60 / 60);
        const min = Math.floor(this.playtime() / 60) % 60;
        const sec = this.playtime() % 60;
        return hour.padZero(2) + ":" + min.padZero(2) + ":" + sec.padZero(2);
    }

    saveBgm() {
        this._savedBgm = AudioManager.saveBgm();
    }

    replayBgm() {
        if (this._savedBgm) AudioManager.replayBgm(this._savedBgm);
    }

    saveWalkingBgm() {
        this._walkingBgm = AudioManager.saveBgm();
    }

    replayWalkingBgm() {
        if (this._walkingBgm) AudioManager.playBgm(this._walkingBgm);
    }

    saveWalkingBgm2() {
        this._walkingBgm = $dataMap.bgm;
    }

    mainFontFace() {
        return "rmmz-mainfont, " + ($dataSystem.advanced.fallbackFonts || "sans-serif");
    }

    numberFontFace() {
        return "rmmz-numberfont, " + this.mainFontFace();
    }

    mainFontSize() {
        return $dataSystem.advanced.fontSize || 26;
    }

    windowPadding() {
        return 12;
    }

    windowOpacity() {
        const advanced = $dataSystem.advanced;
        return "windowOpacity" in advanced ? advanced.windowOpacity : 192;
    }
};

//-----------------------------------------------------------------------------
// Game_Timer

var Game_Timer = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this._frames = 0;
        this._working = false;
    }
    update(sceneActive) {
        if (sceneActive && this._working && this._frames > 0) {
            this._frames--;
            if (this._frames === 0) this.onExpire();
        }
    }
    start(count) {
        this._frames = count;
        this._working = true;
    }
    stop() {
        this._working = false;
    }
    isWorking() {
        return this._working;
    }
    seconds() {
        return Math.floor(this._frames / 60);
    }
    frames() {
        return this._frames;
    }
    onExpire() {
        BattleManager.abort();
    }
};

//-----------------------------------------------------------------------------
// Game_Message

var Game_Message = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this.clear();
    }

    clear() {
        this._texts = [];
        this._choices = [];
        this._speakerName = "";
        this._faceName = "";
        this._faceIndex = 0;
        this._background = 0;
        this._positionType = 2;
        this._choiceDefaultType = 0;
        this._choiceCancelType = 0;
        this._choiceBackground = 0;
        this._choicePositionType = 2;
        this._numInputVariableId = 0;
        this._numInputMaxDigits = 0;
        this._itemChoiceVariableId = 0;
        this._itemChoiceItypeId = 0;
        this._scrollMode = false;
        this._scrollSpeed = 2;
        this._scrollNoFast = false;
        this._choiceCallback = null;
    }

    choices() {
        return this._choices;
    }
    speakerName() {
        return this._speakerName;
    }
    faceName() {
        return this._faceName;
    }
    faceIndex() {
        return this._faceIndex;
    }
    background() {
        return this._background;
    }
    positionType() {
        return this._positionType;
    }
    choiceDefaultType() {
        return this._choiceDefaultType;
    }
    choiceCancelType() {
        return this._choiceCancelType;
    }
    choiceBackground() {
        return this._choiceBackground;
    }
    choicePositionType() {
        return this._choicePositionType;
    }
    numInputVariableId() {
        return this._numInputVariableId;
    }
    numInputMaxDigits() {
        return this._numInputMaxDigits;
    }
    itemChoiceVariableId() {
        return this._itemChoiceVariableId;
    }
    itemChoiceItypeId() {
        return this._itemChoiceItypeId;
    }
    scrollMode() {
        return this._scrollMode;
    }
    scrollSpeed() {
        return this._scrollSpeed;
    }
    scrollNoFast() {
        return this._scrollNoFast;
    }
    add(text) {
        this._texts.push(text);
    }
    setSpeakerName(speakerName) {
        this._speakerName = speakerName ? speakerName : "";
    }
    setFaceImage(faceName, faceIndex) {
        this._faceName = faceName;
        this._faceIndex = faceIndex;
    }
    setBackground(background) {
        this._background = background;
    }
    setPositionType(positionType) {
        this._positionType = positionType;
    }
    setChoices(choices, defaultType, cancelType) {
        this._choices = choices;
        this._choiceDefaultType = defaultType;
        this._choiceCancelType = cancelType;
    }
    setChoiceBackground(background) {
        this._choiceBackground = background;
    }
    setChoicePositionType(positionType) {
        this._choicePositionType = positionType;
    }
    setNumberInput(variableId, maxDigits) {
        this._numInputVariableId = variableId;
        this._numInputMaxDigits = maxDigits;
    }
    setItemChoice(variableId, itemType) {
        this._itemChoiceVariableId = variableId;
        this._itemChoiceItypeId = itemType;
    }
    setScroll(speed, noFast) {
        this._scrollMode = true;
        this._scrollSpeed = speed;
        this._scrollNoFast = noFast;
    }
    setChoiceCallback(callback) {
        this._choiceCallback = callback;
    }
    onChoice(n) {
        if (this._choiceCallback) {
            this._choiceCallback(n);
            this._choiceCallback = null;
        }
    }
    hasText() {
        return this._texts.length > 0;
    }
    isChoice() {
        return this._choices.length > 0;
    }
    isNumberInput() {
        return this._numInputVariableId > 0;
    }
    isItemChoice() {
        return this._itemChoiceVariableId > 0;
    }
    isBusy() {
        return this.hasText() || this.isChoice() || this.isNumberInput() || this.isItemChoice();
    }
    newPage() {
        if (this._texts.length > 0) this._texts[this._texts.length - 1] += "\f";
    }
    allText() {
        return this._texts.join("\n");
    }
    isRTL() {
        return Utils.containsArabic(this.allText());
    }
};

//-----------------------------------------------------------------------------
// Game_Switches / Game_Variables / Game_SelfSwitches

var Game_Switches = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this.clear();
    }
    clear() {
        this._data = [];
    }
    value(switchId) {
        return !!this._data[switchId];
    }
    setValue(switchId, value) {
        if (switchId > 0 && switchId < $dataSystem.switches.length) {
            this._data[switchId] = value;
            this.onChange();
        }
    }
    onChange() {
        $gameMap.requestRefresh();
    }
};

var Game_Variables = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this.clear();
    }
    clear() {
        this._data = [];
    }
    value(variableId) {
        return this._data[variableId] || 0;
    }
    setValue(variableId, value) {
        if (variableId > 0 && variableId < $dataSystem.variables.length) {
            if (typeof value === "number") value = Math.floor(value);
            this._data[variableId] = value;
            this.onChange();
        }
    }
    onChange() {
        $gameMap.requestRefresh();
    }
};

var Game_SelfSwitches = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this.clear();
    }
    clear() {
        this._data = {};
    }
    value(key) {
        return !!this._data[key];
    }
    setValue(key, value) {
        if (value) this._data[key] = true;
        else delete this._data[key];
        this.onChange();
    }
    onChange() {
        $gameMap.requestRefresh();
    }
};

//-----------------------------------------------------------------------------
// Game_Screen

var Game_Screen = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this.clear();
    }

    clear() {
        this.clearFade();
        this.clearTone();
        this.clearFlash();
        this.clearShake();
        this.clearZoom();
        this.clearWeather();
        this.clearPictures();
    }

    onBattleStart() {
        this.clearFade();
        this.clearFlash();
        this.clearShake();
        this.clearZoom();
        this.eraseBattlePictures();
    }

    brightness() {
        return this._brightness;
    }
    tone() {
        return this._tone;
    }
    flashColor() {
        return this._flashColor;
    }
    shake() {
        return this._shake;
    }
    zoomX() {
        return this._zoomX;
    }
    zoomY() {
        return this._zoomY;
    }
    zoomScale() {
        return this._zoomScale;
    }
    weatherType() {
        return this._weatherType;
    }
    weatherPower() {
        return this._weatherPower;
    }

    picture(pictureId) {
        const realPictureId = this.realPictureId(pictureId);
        return this._pictures[realPictureId];
    }

    realPictureId(pictureId) {
        if ($gameParty.inBattle()) return pictureId + this.maxPictures();
        return pictureId;
    }

    clearFade() {
        this._brightness = 255;
        this._fadeOutDuration = 0;
        this._fadeInDuration = 0;
    }

    clearTone() {
        this._tone = [0, 0, 0, 0];
        this._toneTarget = [0, 0, 0, 0];
        this._toneDuration = 0;
    }

    clearFlash() {
        this._flashColor = [0, 0, 0, 0];
        this._flashDuration = 0;
    }

    clearShake() {
        this._shakePower = 0;
        this._shakeSpeed = 0;
        this._shakeDuration = 0;
        this._shakeDirection = 1;
        this._shake = 0;
    }

    clearZoom() {
        this._zoomX = 0;
        this._zoomY = 0;
        this._zoomScale = 1;
        this._zoomScaleTarget = 1;
        this._zoomDuration = 0;
    }

    clearWeather() {
        this._weatherType = "none";
        this._weatherPower = 0;
        this._weatherPowerTarget = 0;
        this._weatherDuration = 0;
    }

    clearPictures() {
        this._pictures = [];
    }

    eraseBattlePictures() {
        this._pictures = this._pictures.slice(0, this.maxPictures() + 1);
    }

    maxPictures() {
        return ($dataSystem && $dataSystem.advanced && $dataSystem.advanced.picturesUpperLimit) || 100;
    }

    startFadeOut(duration) {
        this._fadeOutDuration = duration;
        this._fadeInDuration = 0;
    }

    startFadeIn(duration) {
        this._fadeInDuration = duration;
        this._fadeOutDuration = 0;
    }

    startTint(tone, duration) {
        this._toneTarget = tone.clone();
        this._toneDuration = duration;
        if (this._toneDuration === 0) this._tone = this._toneTarget.clone();
    }

    startFlash(color, duration) {
        this._flashColor = color.clone();
        this._flashDuration = duration;
    }

    startShake(power, speed, duration) {
        this._shakePower = power;
        this._shakeSpeed = speed;
        this._shakeDuration = duration;
    }

    setZoom(x, y, scale) {
        this._zoomX = x;
        this._zoomY = y;
        this._zoomScale = scale;
    }

    startZoom(x, y, scale, duration) {
        this._zoomX = x;
        this._zoomY = y;
        this._zoomScaleTarget = scale;
        this._zoomDuration = duration;
    }

    changeWeather(type, power, duration) {
        if (type !== "none" || duration === 0) this._weatherType = type;
        this._weatherPowerTarget = type === "none" ? 0 : power;
        this._weatherDuration = duration;
        if (duration === 0) this._weatherPower = this._weatherPowerTarget;
    }

    update() {
        this.updateFadeOut();
        this.updateFadeIn();
        this.updateTone();
        this.updateFlash();
        this.updateShake();
        this.updateZoom();
        this.updateWeather();
        this.updatePictures();
    }

    updateFadeOut() {
        if (this._fadeOutDuration > 0) {
            const d = this._fadeOutDuration;
            this._brightness = (this._brightness * (d - 1)) / d;
            this._fadeOutDuration--;
        }
    }

    updateFadeIn() {
        if (this._fadeInDuration > 0) {
            const d = this._fadeInDuration;
            this._brightness = (this._brightness * (d - 1) + 255) / d;
            this._fadeInDuration--;
        }
    }

    updateTone() {
        if (this._toneDuration > 0) {
            const d = this._toneDuration;
            for (let i = 0; i < 4; i++) this._tone[i] = (this._tone[i] * (d - 1) + this._toneTarget[i]) / d;
            this._toneDuration--;
        }
    }

    updateFlash() {
        if (this._flashDuration > 0) {
            const d = this._flashDuration;
            this._flashColor[3] *= (d - 1) / d;
            this._flashDuration--;
        }
    }

    updateShake() {
        if (this._shakeDuration > 0 || this._shake !== 0) {
            const delta = (this._shakePower * this._shakeSpeed * this._shakeDirection) / 10;
            if (this._shakeDuration <= 1 && this._shake * (this._shake + delta) < 0) {
                this._shake = 0;
            } else {
                this._shake += delta;
            }
            if (this._shake > this._shakePower * 2) this._shakeDirection = -1;
            if (this._shake < -this._shakePower * 2) this._shakeDirection = 1;
            this._shakeDuration--;
        }
    }

    updateZoom() {
        if (this._zoomDuration > 0) {
            const d = this._zoomDuration;
            const t = this._zoomScaleTarget;
            this._zoomScale = (this._zoomScale * (d - 1) + t) / d;
            this._zoomDuration--;
        }
    }

    updateWeather() {
        if (this._weatherDuration > 0) {
            const d = this._weatherDuration;
            const t = this._weatherPowerTarget;
            this._weatherPower = (this._weatherPower * (d - 1) + t) / d;
            this._weatherDuration--;
            if (this._weatherDuration === 0 && this._weatherPowerTarget === 0) this._weatherType = "none";
        }
    }

    updatePictures() {
        for (const picture of this._pictures) {
            if (picture) picture.update();
        }
    }

    startFlashForDamage() {
        this.startFlash([255, 0, 0, 128], 8);
    }

    showPicture(pictureId, name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        const realPictureId = this.realPictureId(pictureId);
        const picture = new Game_Picture();
        picture.show(name, origin, x, y, scaleX, scaleY, opacity, blendMode);
        this._pictures[realPictureId] = picture;
    }

    movePicture(pictureId, origin, x, y, scaleX, scaleY, opacity, blendMode, duration, easingType) {
        const picture = this.picture(pictureId);
        if (picture) picture.move(origin, x, y, scaleX, scaleY, opacity, blendMode, duration, easingType);
    }

    rotatePicture(pictureId, speed) {
        const picture = this.picture(pictureId);
        if (picture) picture.rotate(speed);
    }

    tintPicture(pictureId, tone, duration) {
        const picture = this.picture(pictureId);
        if (picture) picture.tint(tone, duration);
    }

    erasePicture(pictureId) {
        const realPictureId = this.realPictureId(pictureId);
        this._pictures[realPictureId] = null;
    }
};

//-----------------------------------------------------------------------------
// Game_Picture

var Game_Picture = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this.initBasic();
        this.initTarget();
        this.initTone();
        this.initRotation();
    }

    name() {
        return this._name;
    }
    origin() {
        return this._origin;
    }
    x() {
        return this._x;
    }
    y() {
        return this._y;
    }
    scaleX() {
        return this._scaleX;
    }
    scaleY() {
        return this._scaleY;
    }
    opacity() {
        return this._opacity;
    }
    blendMode() {
        return this._blendMode;
    }
    tone() {
        return this._tone;
    }
    angle() {
        return this._angle;
    }

    initBasic() {
        this._name = "";
        this._origin = 0;
        this._x = 0;
        this._y = 0;
        this._scaleX = 100;
        this._scaleY = 100;
        this._opacity = 255;
        this._blendMode = 0;
    }

    initTarget() {
        this._targetX = this._x;
        this._targetY = this._y;
        this._targetScaleX = this._scaleX;
        this._targetScaleY = this._scaleY;
        this._targetOpacity = this._opacity;
        this._duration = 0;
        this._wholeDuration = 0;
        this._easingType = 0;
        this._easingExponent = 0;
    }

    initTone() {
        this._tone = null;
        this._toneTarget = null;
        this._toneDuration = 0;
    }

    initRotation() {
        this._angle = 0;
        this._rotationSpeed = 0;
    }

    show(name, origin, x, y, scaleX, scaleY, opacity, blendMode) {
        this._name = name;
        this._origin = origin;
        this._x = x;
        this._y = y;
        this._scaleX = scaleX;
        this._scaleY = scaleY;
        this._opacity = opacity;
        this._blendMode = blendMode;
        this.initTarget();
        this.initTone();
        this.initRotation();
    }

    move(origin, x, y, scaleX, scaleY, opacity, blendMode, duration, easingType) {
        this._origin = origin;
        this._targetX = x;
        this._targetY = y;
        this._targetScaleX = scaleX;
        this._targetScaleY = scaleY;
        this._targetOpacity = opacity;
        this._blendMode = blendMode;
        this._duration = duration;
        this._wholeDuration = duration;
        this._easingType = easingType || 0;
        this._easingExponent = 2;
    }

    rotate(speed) {
        this._rotationSpeed = speed;
    }

    tint(tone, duration) {
        if (!this._tone) this._tone = [0, 0, 0, 0];
        this._toneTarget = tone.clone();
        this._toneDuration = duration;
        if (this._toneDuration === 0) this._tone = this._toneTarget.clone();
    }

    update() {
        this.updateMove();
        this.updateTone();
        this.updateRotation();
    }

    updateMove() {
        if (this._duration > 0) {
            this._x = this.applyEasing(this._x, this._targetX);
            this._y = this.applyEasing(this._y, this._targetY);
            this._scaleX = this.applyEasing(this._scaleX, this._targetScaleX);
            this._scaleY = this.applyEasing(this._scaleY, this._targetScaleY);
            this._opacity = this.applyEasing(this._opacity, this._targetOpacity);
            this._duration--;
        }
    }

    updateTone() {
        if (this._toneDuration > 0) {
            const d = this._toneDuration;
            for (let i = 0; i < 4; i++) this._tone[i] = (this._tone[i] * (d - 1) + this._toneTarget[i]) / d;
            this._toneDuration--;
        }
    }

    updateRotation() {
        if (this._rotationSpeed !== 0) this._angle += this._rotationSpeed / 2;
    }

    applyEasing(current, target) {
        const d = this._duration;
        const wd = this._wholeDuration;
        const lt = this.calcEasing((wd - d) / wd);
        const t = this.calcEasing((wd - d + 1) / wd);
        const start = (current - target * lt) / (1 - lt);
        return start + (target - start) * t;
    }

    calcEasing(t) {
        const exponent = this._easingExponent;
        switch (this._easingType) {
            case 1:
                return this.easeIn(t, exponent);
            case 2:
                return this.easeOut(t, exponent);
            case 3:
                return this.easeInOut(t, exponent);
            default:
                return t;
        }
    }

    easeIn(t, exponent) {
        return Math.pow(t, exponent);
    }

    easeOut(t, exponent) {
        return 1 - Math.pow(1 - t, exponent);
    }

    easeInOut(t, exponent) {
        if (t < 0.5) return this.easeIn(t * 2, exponent) / 2;
        return this.easeOut(t * 2 - 1, exponent) / 2 + 0.5;
    }
};

//-----------------------------------------------------------------------------
// Game_Map

var Game_Map = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this._interpreter = new Game_Interpreter();
        this._mapId = 0;
        this._tilesetId = 0;
        this._events = [];
        this._commonEvents = [];
        this._vehicles = [];
        this._displayX = 0;
        this._displayY = 0;
        this._nameDisplay = true;
        this._scrollDirection = 2;
        this._scrollRest = 0;
        this._scrollSpeed = 4;
        this._parallaxName = "";
        this._parallaxZero = false;
        this._parallaxLoopX = false;
        this._parallaxLoopY = false;
        this._parallaxSx = 0;
        this._parallaxSy = 0;
        this._parallaxX = 0;
        this._parallaxY = 0;
        this._battleback1Name = null;
        this._battleback2Name = null;
        this._tileEvents = [];
        this.createVehicles();
    }

    setup(mapId) {
        if (!$dataMap) throw new Error("The map data is not available");
        this._mapId = mapId;
        this._tilesetId = $dataMap.tilesetId;
        this._displayX = 0;
        this._displayY = 0;
        this.refereshVehicles();
        this.setupEvents();
        this.setupScroll();
        this.setupParallax();
        this.setupBattleback();
        this._needsRefresh = false;
    }

    isEventRunning() {
        return this._interpreter.isRunning() || this.isAnyEventStarting();
    }

    tileWidth() {
        return "tileSize" in $dataSystem ? $dataSystem.tileSize : 48;
    }

    tileHeight() {
        return this.tileWidth();
    }

    bushDepth() {
        return this.tileHeight() / 4;
    }

    mapId() {
        return this._mapId;
    }
    tilesetId() {
        return this._tilesetId;
    }
    displayX() {
        return this._displayX;
    }
    displayY() {
        return this._displayY;
    }
    parallaxName() {
        return this._parallaxName;
    }
    battleback1Name() {
        return this._battleback1Name;
    }
    battleback2Name() {
        return this._battleback2Name;
    }
    requestRefresh() {
        this._needsRefresh = true;
    }
    isNameDisplayEnabled() {
        return this._nameDisplay;
    }
    disableNameDisplay() {
        this._nameDisplay = false;
    }
    enableNameDisplay() {
        this._nameDisplay = true;
    }

    createVehicles() {
        this._vehicles = [];
        this._vehicles[0] = new Game_Vehicle("boat");
        this._vehicles[1] = new Game_Vehicle("ship");
        this._vehicles[2] = new Game_Vehicle("airship");
    }

    refereshVehicles() {
        for (const vehicle of this._vehicles) vehicle.refresh();
    }

    vehicles() {
        return this._vehicles;
    }

    vehicle(type) {
        if (type === 0 || type === "boat") return this.boat();
        if (type === 1 || type === "ship") return this.ship();
        if (type === 2 || type === "airship") return this.airship();
        return null;
    }

    boat() {
        return this._vehicles[0];
    }
    ship() {
        return this._vehicles[1];
    }
    airship() {
        return this._vehicles[2];
    }

    setupEvents() {
        this._events = [];
        this._commonEvents = [];
        for (const event of $dataMap.events.filter(event => !!event)) {
            this._events[event.id] = new Game_Event(this._mapId, event.id);
        }
        for (const commonEvent of this.parallelCommonEvents()) {
            this._commonEvents.push(new Game_CommonEvent(commonEvent.id));
        }
        this.refreshTileEvents();
    }

    events() {
        return this._events.filter(event => !!event);
    }

    event(eventId) {
        return this._events[eventId];
    }

    eraseEvent(eventId) {
        this._events[eventId].erase();
    }

    autorunCommonEvents() {
        return $dataCommonEvents.filter(commonEvent => commonEvent && commonEvent.trigger === 1);
    }

    parallelCommonEvents() {
        return $dataCommonEvents.filter(commonEvent => commonEvent && commonEvent.trigger === 2);
    }

    setupScroll() {
        this._scrollDirection = 2;
        this._scrollRest = 0;
        this._scrollSpeed = 4;
    }

    setupParallax() {
        this._parallaxName = $dataMap.parallaxName || "";
        this._parallaxZero = ImageManager.isZeroParallax(this._parallaxName);
        this._parallaxLoopX = $dataMap.parallaxLoopX;
        this._parallaxLoopY = $dataMap.parallaxLoopY;
        this._parallaxSx = $dataMap.parallaxSx;
        this._parallaxSy = $dataMap.parallaxSy;
        this._parallaxX = 0;
        this._parallaxY = 0;
    }

    setupBattleback() {
        if ($dataMap.specifyBattleback) {
            this._battleback1Name = $dataMap.battleback1Name;
            this._battleback2Name = $dataMap.battleback2Name;
        } else {
            this._battleback1Name = null;
            this._battleback2Name = null;
        }
    }

    setDisplayPos(x, y) {
        if (this.isLoopHorizontal()) {
            this._displayX = x.mod(this.width());
            this._parallaxX = x;
        } else {
            const endX = this.width() - this.screenTileX();
            this._displayX = endX < 0 ? endX / 2 : x.clamp(0, endX);
            this._parallaxX = this._displayX;
        }
        if (this.isLoopVertical()) {
            this._displayY = y.mod(this.height());
            this._parallaxY = y;
        } else {
            const endY = this.height() - this.screenTileY();
            this._displayY = endY < 0 ? endY / 2 : y.clamp(0, endY);
            this._parallaxY = this._displayY;
        }
    }

    parallaxOx() {
        if (this._parallaxZero) return this._parallaxX * this.tileWidth();
        if (this._parallaxLoopX) return (this._parallaxX * this.tileWidth()) / 2;
        return 0;
    }

    parallaxOy() {
        if (this._parallaxZero) return this._parallaxY * this.tileHeight();
        if (this._parallaxLoopY) return (this._parallaxY * this.tileHeight()) / 2;
        return 0;
    }

    tileset() {
        return $dataTilesets[this._tilesetId];
    }

    tilesetFlags() {
        const tileset = this.tileset();
        return tileset ? tileset.flags : [];
    }

    displayName() {
        return $dataMap.displayName;
    }
    width() {
        return $dataMap.width;
    }
    height() {
        return $dataMap.height;
    }
    data() {
        return $dataMap.data;
    }
    isLoopHorizontal() {
        return $dataMap.scrollType === 2 || $dataMap.scrollType === 3;
    }
    isLoopVertical() {
        return $dataMap.scrollType === 1 || $dataMap.scrollType === 3;
    }
    isDashDisabled() {
        return $dataMap.disableDashing;
    }
    encounterList() {
        return $dataMap.encounterList;
    }
    encounterStep() {
        return $dataMap.encounterStep;
    }
    isOverworld() {
        return this.tileset() && this.tileset().mode === 0;
    }

    screenTileX() {
        return Math.round((Graphics.width / this.tileWidth()) * 16) / 16;
    }

    screenTileY() {
        return Math.round((Graphics.height / this.tileHeight()) * 16) / 16;
    }

    adjustX(x) {
        if (this.isLoopHorizontal() && x < this._displayX - (this.width() - this.screenTileX()) / 2) {
            return x - this._displayX + $dataMap.width;
        }
        if (this.isLoopHorizontal() && x > this._displayX + (this.screenTileX() + this.width()) / 2) {
            return x - this._displayX - $dataMap.width;
        }
        return x - this._displayX;
    }

    adjustY(y) {
        if (this.isLoopVertical() && y < this._displayY - (this.height() - this.screenTileY()) / 2) {
            return y - this._displayY + $dataMap.height;
        }
        if (this.isLoopVertical() && y > this._displayY + (this.screenTileY() + this.height()) / 2) {
            return y - this._displayY - $dataMap.height;
        }
        return y - this._displayY;
    }

    roundX(x) {
        return this.isLoopHorizontal() ? x.mod(this.width()) : x;
    }

    roundY(y) {
        return this.isLoopVertical() ? y.mod(this.height()) : y;
    }

    xWithDirection(x, d) {
        return x + (d === 6 ? 1 : d === 4 ? -1 : 0);
    }

    yWithDirection(y, d) {
        return y + (d === 2 ? 1 : d === 8 ? -1 : 0);
    }

    roundXWithDirection(x, d) {
        return this.roundX(x + (d === 6 ? 1 : d === 4 ? -1 : 0));
    }

    roundYWithDirection(y, d) {
        return this.roundY(y + (d === 2 ? 1 : d === 8 ? -1 : 0));
    }

    deltaX(x1, x2) {
        let result = x1 - x2;
        if (this.isLoopHorizontal() && Math.abs(result) > this.width() / 2) {
            if (result < 0) result += this.width();
            else result -= this.width();
        }
        return result;
    }

    deltaY(y1, y2) {
        let result = y1 - y2;
        if (this.isLoopVertical() && Math.abs(result) > this.height() / 2) {
            if (result < 0) result += this.height();
            else result -= this.height();
        }
        return result;
    }

    distance(x1, y1, x2, y2) {
        return Math.abs(this.deltaX(x1, x2)) + Math.abs(this.deltaY(y1, y2));
    }

    canvasToMapX(x) {
        const tileWidth = this.tileWidth();
        const originX = this._displayX * tileWidth;
        const mapX = Math.floor((originX + x) / tileWidth);
        return this.roundX(mapX);
    }

    canvasToMapY(y) {
        const tileHeight = this.tileHeight();
        const originY = this._displayY * tileHeight;
        const mapY = Math.floor((originY + y) / tileHeight);
        return this.roundY(mapY);
    }

    autoplay() {
        if ($dataMap.autoplayBgm) {
            if ($gamePlayer.isInVehicle()) $gameSystem.saveWalkingBgm2();
            else AudioManager.playBgm($dataMap.bgm);
        }
        if ($dataMap.autoplayBgs) AudioManager.playBgs($dataMap.bgs);
    }

    refreshIfNeeded() {
        if (this._needsRefresh) this.refresh();
    }

    refresh() {
        for (const event of this.events()) event.refresh();
        for (const commonEvent of this._commonEvents) commonEvent.refresh();
        this.refreshTileEvents();
        this._needsRefresh = false;
    }

    refreshTileEvents() {
        this._tileEvents = this.events().filter(event => event.isTile());
    }

    eventsXy(x, y) {
        return this.events().filter(event => event.pos(x, y));
    }

    eventsXyNt(x, y) {
        return this.events().filter(event => event.posNt(x, y));
    }

    tileEventsXy(x, y) {
        return this._tileEvents.filter(event => event.posNt(x, y));
    }

    eventIdXy(x, y) {
        const list = this.eventsXy(x, y);
        return list.length === 0 ? 0 : list[0].eventId();
    }

    scrollDown(distance) {
        if (this.isLoopVertical()) {
            this._displayY += distance;
            this._displayY %= $dataMap.height;
            if (this._parallaxLoopY) this._parallaxY += distance;
        } else if (this.height() >= this.screenTileY()) {
            const lastY = this._displayY;
            this._displayY = Math.min(this._displayY + distance, this.height() - this.screenTileY());
            this._parallaxY += this._displayY - lastY;
        }
    }

    scrollLeft(distance) {
        if (this.isLoopHorizontal()) {
            this._displayX += $dataMap.width - distance;
            this._displayX %= $dataMap.width;
            if (this._parallaxLoopX) this._parallaxX -= distance;
        } else if (this.width() >= this.screenTileX()) {
            const lastX = this._displayX;
            this._displayX = Math.max(this._displayX - distance, 0);
            this._parallaxX += this._displayX - lastX;
        }
    }

    scrollRight(distance) {
        if (this.isLoopHorizontal()) {
            this._displayX += distance;
            this._displayX %= $dataMap.width;
            if (this._parallaxLoopX) this._parallaxX += distance;
        } else if (this.width() >= this.screenTileX()) {
            const lastX = this._displayX;
            this._displayX = Math.min(this._displayX + distance, this.width() - this.screenTileX());
            this._parallaxX += this._displayX - lastX;
        }
    }

    scrollUp(distance) {
        if (this.isLoopVertical()) {
            this._displayY += $dataMap.height - distance;
            this._displayY %= $dataMap.height;
            if (this._parallaxLoopY) this._parallaxY -= distance;
        } else if (this.height() >= this.screenTileY()) {
            const lastY = this._displayY;
            this._displayY = Math.max(this._displayY - distance, 0);
            this._parallaxY += this._displayY - lastY;
        }
    }

    isValid(x, y) {
        return x >= 0 && x < this.width() && y >= 0 && y < this.height();
    }

    checkPassage(x, y, bit) {
        const flags = this.tilesetFlags();
        const tiles = this.allTiles(x, y);
        for (const tile of tiles) {
            const flag = flags[tile];
            if ((flag & 0x10) !== 0) continue; // [*] No effect on passage
            if ((flag & bit) === 0) return true; // [o] Passable
            if ((flag & bit) === bit) return false; // [x] Impassable
        }
        return false;
    }

    tileId(x, y, z) {
        const width = $dataMap.width;
        const height = $dataMap.height;
        return $dataMap.data[(z * height + y) * width + x] || 0;
    }

    layeredTiles(x, y) {
        const tiles = [];
        for (let i = 0; i < 4; i++) tiles.push(this.tileId(x, y, 3 - i));
        return tiles;
    }

    allTiles(x, y) {
        const tiles = this.tileEventsXy(x, y).map(event => event.tileId());
        return tiles.concat(this.layeredTiles(x, y));
    }

    autotileType(x, y, z) {
        const tileId = this.tileId(x, y, z);
        return tileId >= 2048 ? Math.floor((tileId - 2048) / 48) : -1;
    }

    isPassable(x, y, d) {
        return this.checkPassage(x, y, (1 << (d / 2 - 1)) & 0x0f);
    }

    isBoatPassable(x, y) {
        return this.checkPassage(x, y, 0x0200);
    }

    isShipPassable(x, y) {
        return this.checkPassage(x, y, 0x0400);
    }

    isAirshipLandOk(x, y) {
        return this.checkPassage(x, y, 0x0800) && this.checkPassage(x, y, 0x0f);
    }

    checkLayeredTilesFlags(x, y, bit) {
        const flags = this.tilesetFlags();
        return this.layeredTiles(x, y).some(tileId => (flags[tileId] & bit) !== 0);
    }

    isLadder(x, y) {
        return this.isValid(x, y) && this.checkLayeredTilesFlags(x, y, 0x20);
    }

    isBush(x, y) {
        return this.isValid(x, y) && this.checkLayeredTilesFlags(x, y, 0x40);
    }

    isCounter(x, y) {
        return this.isValid(x, y) && this.checkLayeredTilesFlags(x, y, 0x80);
    }

    isDamageFloor(x, y) {
        return this.isValid(x, y) && this.checkLayeredTilesFlags(x, y, 0x100);
    }

    terrainTag(x, y) {
        if (this.isValid(x, y)) {
            const flags = this.tilesetFlags();
            const tiles = this.layeredTiles(x, y);
            for (const tile of tiles) {
                const tag = flags[tile] >> 12;
                if (tag > 0) return tag;
            }
        }
        return 0;
    }

    regionId(x, y) {
        return this.isValid(x, y) ? this.tileId(x, y, 5) : 0;
    }

    startScroll(direction, distance, speed) {
        this._scrollDirection = direction;
        this._scrollRest = distance;
        this._scrollSpeed = speed;
    }

    isScrolling() {
        return this._scrollRest > 0;
    }

    update(sceneActive) {
        this.refreshIfNeeded();
        if (sceneActive) this.updateInterpreter();
        this.updateScroll();
        this.updateEvents();
        this.updateVehicles();
        this.updateParallax();
    }

    updateScroll() {
        if (this.isScrolling()) {
            const lastX = this._displayX;
            const lastY = this._displayY;
            this.doScroll(this._scrollDirection, this.scrollDistance());
            if (this._displayX === lastX && this._displayY === lastY) this._scrollRest = 0;
            else this._scrollRest -= this.scrollDistance();
        }
    }

    scrollDistance() {
        return Math.pow(2, this._scrollSpeed) / 256;
    }

    doScroll(direction, distance) {
        switch (direction) {
            case 2:
                this.scrollDown(distance);
                break;
            case 4:
                this.scrollLeft(distance);
                break;
            case 6:
                this.scrollRight(distance);
                break;
            case 8:
                this.scrollUp(distance);
                break;
        }
    }

    updateEvents() {
        for (const event of this.events()) event.update();
        for (const commonEvent of this._commonEvents) commonEvent.update();
    }

    updateVehicles() {
        for (const vehicle of this._vehicles) vehicle.update();
    }

    updateParallax() {
        if (this._parallaxLoopX) this._parallaxX += this._parallaxSx / this.tileWidth() / 2;
        if (this._parallaxLoopY) this._parallaxY += this._parallaxSy / this.tileHeight() / 2;
    }

    changeTileset(tilesetId) {
        this._tilesetId = tilesetId;
        this.refresh();
    }

    changeBattleback(battleback1Name, battleback2Name) {
        this._battleback1Name = battleback1Name;
        this._battleback2Name = battleback2Name;
    }

    changeParallax(name, loopX, loopY, sx, sy) {
        this._parallaxName = name;
        this._parallaxZero = ImageManager.isZeroParallax(this._parallaxName);
        if (this._parallaxLoopX && !loopX) this._parallaxX = 0;
        if (this._parallaxLoopY && !loopY) this._parallaxY = 0;
        this._parallaxLoopX = loopX;
        this._parallaxLoopY = loopY;
        this._parallaxSx = sx;
        this._parallaxSy = sy;
    }

    updateInterpreter() {
        for (;;) {
            this._interpreter.update();
            if (this._interpreter.isRunning()) return;
            if (this._interpreter.eventId() > 0) {
                this.unlockEvent(this._interpreter.eventId());
                this._interpreter.clear();
            }
            if (!this.setupStartingEvent()) return;
        }
    }

    unlockEvent(eventId) {
        if (this._events[eventId]) this._events[eventId].unlock();
    }

    setupStartingEvent() {
        this.refreshIfNeeded();
        if (this._interpreter.setupReservedCommonEvent()) return true;
        if (this.setupTestEvent()) return true;
        if (this.setupStartingMapEvent()) return true;
        if (this.setupAutorunCommonEvent()) return true;
        return false;
    }

    setupTestEvent() {
        if (window.$testEvent) {
            this._interpreter.setup($testEvent, 0);
            $testEvent = null;
            window.$testEvent = null;
            return true;
        }
        return false;
    }

    setupStartingMapEvent() {
        for (const event of this.events()) {
            if (event.isStarting()) {
                event.clearStartingFlag();
                this._interpreter.setup(event.list(), event.eventId());
                return true;
            }
        }
        return false;
    }

    setupAutorunCommonEvent() {
        for (const commonEvent of this.autorunCommonEvents()) {
            if ($gameSwitches.value(commonEvent.switchId)) {
                this._interpreter.setup(commonEvent.list);
                return true;
            }
        }
        return false;
    }

    isAnyEventStarting() {
        return this.events().some(event => event.isStarting());
    }
};

//-----------------------------------------------------------------------------
// Game_CommonEvent — a parallel common event

var Game_CommonEvent = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize(commonEventId) {
        this._commonEventId = commonEventId;
        this.refresh();
    }
    event() {
        return $dataCommonEvents[this._commonEventId];
    }
    list() {
        return this.event().list;
    }
    refresh() {
        if (this.isActive()) {
            if (!this._interpreter) this._interpreter = new Game_Interpreter();
        } else {
            this._interpreter = null;
        }
    }
    isActive() {
        const event = this.event();
        return event.trigger === 2 && $gameSwitches.value(event.switchId);
    }
    update() {
        if (this._interpreter) {
            if (!this._interpreter.isRunning()) this._interpreter.setup(this.list());
            this._interpreter.update();
        }
    }
};

//-----------------------------------------------------------------------------
// Game_CharacterBase

var Game_CharacterBase = class {
    constructor(...args) {
        this.initialize(...args);
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }

    initialize() {
        this.initMembers();
    }

    initMembers() {
        this._x = 0;
        this._y = 0;
        this._realX = 0;
        this._realY = 0;
        this._moveSpeed = 4;
        this._moveFrequency = 6;
        this._opacity = 255;
        this._blendMode = 0;
        this._direction = 2;
        this._pattern = 1;
        this._priorityType = 1;
        this._tileId = 0;
        this._characterName = "";
        this._characterIndex = 0;
        this._isObjectCharacter = false;
        this._walkAnime = true;
        this._stepAnime = false;
        this._directionFix = false;
        this._through = false;
        this._transparent = false;
        this._bushDepth = 0;
        this._animationId = 0;
        this._balloonId = 0;
        this._animationPlaying = false;
        this._balloonPlaying = false;
        this._animationCount = 0;
        this._stopCount = 0;
        this._jumpCount = 0;
        this._jumpPeak = 0;
        this._movementSuccess = true;
    }

    pos(x, y) {
        return this._x === x && this._y === y;
    }

    posNt(x, y) {
        // No through
        return this.pos(x, y) && !this.isThrough();
    }

    moveSpeed() {
        return this._moveSpeed;
    }
    setMoveSpeed(moveSpeed) {
        this._moveSpeed = moveSpeed;
    }
    moveFrequency() {
        return this._moveFrequency;
    }
    setMoveFrequency(moveFrequency) {
        this._moveFrequency = moveFrequency;
    }
    opacity() {
        return this._opacity;
    }
    setOpacity(opacity) {
        this._opacity = opacity;
    }
    blendMode() {
        return this._blendMode;
    }
    setBlendMode(blendMode) {
        this._blendMode = blendMode;
    }
    isNormalPriority() {
        return this._priorityType === 1;
    }
    setPriorityType(priorityType) {
        this._priorityType = priorityType;
    }
    isMoving() {
        return this._realX !== this._x || this._realY !== this._y;
    }
    isJumping() {
        return this._jumpCount > 0;
    }
    jumpHeight() {
        return (this._jumpPeak * this._jumpPeak - Math.pow(Math.abs(this._jumpCount - this._jumpPeak), 2)) / 2;
    }
    isStopping() {
        return !this.isMoving() && !this.isJumping();
    }
    checkStop(threshold) {
        return this._stopCount > threshold;
    }
    resetStopCount() {
        this._stopCount = 0;
    }
    realMoveSpeed() {
        return this._moveSpeed + (this.isDashing() ? 1 : 0);
    }
    distancePerFrame() {
        return Math.pow(2, this.realMoveSpeed()) / 256;
    }
    isDashing() {
        return false;
    }
    isDebugThrough() {
        return false;
    }
    straighten() {
        if (this.hasWalkAnime() || this.hasStepAnime()) this._pattern = 1;
        this._animationCount = 0;
    }
    reverseDir(d) {
        return 10 - d;
    }

    canPass(x, y, d) {
        const x2 = $gameMap.roundXWithDirection(x, d);
        const y2 = $gameMap.roundYWithDirection(y, d);
        if (!$gameMap.isValid(x2, y2)) return false;
        if (this.isThrough() || this.isDebugThrough()) return true;
        if (!this.isMapPassable(x, y, d)) return false;
        if (this.isCollidedWithCharacters(x2, y2)) return false;
        return true;
    }

    canPassDiagonally(x, y, horz, vert) {
        const x2 = $gameMap.roundXWithDirection(x, horz);
        const y2 = $gameMap.roundYWithDirection(y, vert);
        if (this.canPass(x, y, vert) && this.canPass(x, y2, horz)) return true;
        if (this.canPass(x, y, horz) && this.canPass(x2, y, vert)) return true;
        return false;
    }

    isMapPassable(x, y, d) {
        const x2 = $gameMap.roundXWithDirection(x, d);
        const y2 = $gameMap.roundYWithDirection(y, d);
        const d2 = this.reverseDir(d);
        return $gameMap.isPassable(x, y, d) && $gameMap.isPassable(x2, y2, d2);
    }

    isCollidedWithCharacters(x, y) {
        return this.isCollidedWithEvents(x, y) || this.isCollidedWithVehicles(x, y);
    }

    isCollidedWithEvents(x, y) {
        const events = $gameMap.eventsXyNt(x, y);
        return events.some(event => event.isNormalPriority());
    }

    isCollidedWithVehicles(x, y) {
        return $gameMap.boat().posNt(x, y) || $gameMap.ship().posNt(x, y);
    }

    setPosition(x, y) {
        this._x = Math.round(x);
        this._y = Math.round(y);
        this._realX = x;
        this._realY = y;
    }

    copyPosition(character) {
        this._x = character._x;
        this._y = character._y;
        this._realX = character._realX;
        this._realY = character._realY;
        this._direction = character._direction;
    }

    locate(x, y) {
        this.setPosition(x, y);
        this.straighten();
        this.refreshBushDepth();
    }

    direction() {
        return this._direction;
    }

    setDirection(d) {
        if (!this.isDirectionFixed() && d) this._direction = d;
        this.resetStopCount();
    }

    isTile() {
        return this._tileId > 0 && this._priorityType === 0;
    }

    isObjectCharacter() {
        return this._isObjectCharacter;
    }

    shiftY() {
        return this.isObjectCharacter() ? 0 : 6;
    }

    scrolledX() {
        return $gameMap.adjustX(this._realX);
    }

    scrolledY() {
        return $gameMap.adjustY(this._realY);
    }

    screenX() {
        const tw = $gameMap.tileWidth();
        return Math.floor(this.scrolledX() * tw + tw / 2);
    }

    screenY() {
        const th = $gameMap.tileHeight();
        return Math.floor(this.scrolledY() * th + th - this.shiftY() - this.jumpHeight());
    }

    screenZ() {
        return this._priorityType * 2 + 1;
    }

    isNearTheScreen() {
        const gw = Graphics.width;
        const gh = Graphics.height;
        const tw = $gameMap.tileWidth();
        const th = $gameMap.tileHeight();
        const px = this.scrolledX() * tw + tw / 2 - gw / 2;
        const py = this.scrolledY() * th + th / 2 - gh / 2;
        return px >= -gw && px <= gw && py >= -gh && py <= gh;
    }

    update() {
        if (this.isStopping()) this.updateStop();
        if (this.isJumping()) this.updateJump();
        else if (this.isMoving()) this.updateMove();
        this.updateAnimation();
    }

    updateStop() {
        this._stopCount++;
    }

    updateJump() {
        this._jumpCount--;
        this._realX = (this._realX * this._jumpCount + this._x) / (this._jumpCount + 1.0);
        this._realY = (this._realY * this._jumpCount + this._y) / (this._jumpCount + 1.0);
        this.refreshBushDepth();
        if (this._jumpCount === 0) {
            this._realX = this._x = $gameMap.roundX(this._x);
            this._realY = this._y = $gameMap.roundY(this._y);
        }
    }

    updateMove() {
        if (this._x < this._realX) this._realX = Math.max(this._realX - this.distancePerFrame(), this._x);
        if (this._x > this._realX) this._realX = Math.min(this._realX + this.distancePerFrame(), this._x);
        if (this._y < this._realY) this._realY = Math.max(this._realY - this.distancePerFrame(), this._y);
        if (this._y > this._realY) this._realY = Math.min(this._realY + this.distancePerFrame(), this._y);
        if (!this.isMoving()) this.refreshBushDepth();
    }

    updateAnimation() {
        this.updateAnimationCount();
        if (this._animationCount >= this.animationWait()) {
            this.updatePattern();
            this._animationCount = 0;
        }
    }

    animationWait() {
        return (9 - this.realMoveSpeed()) * 3;
    }

    updateAnimationCount() {
        if (this.isMoving() && this.hasWalkAnime()) this._animationCount += 1.5;
        else if (this.hasStepAnime() || !this.isOriginalPattern()) this._animationCount++;
    }

    updatePattern() {
        if (!this.hasStepAnime() && this._stopCount > 0) this.resetPattern();
        else this._pattern = (this._pattern + 1) % this.maxPattern();
    }

    maxPattern() {
        return 4;
    }

    pattern() {
        return this._pattern < 3 ? this._pattern : 1;
    }

    setPattern(pattern) {
        this._pattern = pattern;
    }

    isOriginalPattern() {
        return this.pattern() === 1;
    }

    resetPattern() {
        this.setPattern(1);
    }

    refreshBushDepth() {
        if (this.isNormalPriority() && !this.isObjectCharacter() && this.isOnBush() && !this.isJumping()) {
            if (!this.isMoving()) this._bushDepth = $gameMap.bushDepth();
        } else {
            this._bushDepth = 0;
        }
    }

    isOnLadder() {
        return $gameMap.isLadder(this._x, this._y);
    }

    isOnBush() {
        return $gameMap.isBush(this._x, this._y);
    }

    terrainTag() {
        return $gameMap.terrainTag(this._x, this._y);
    }

    regionId() {
        return $gameMap.regionId(this._x, this._y);
    }

    increaseSteps() {
        if (this.isOnLadder()) this.setDirection(8);
        this.resetStopCount();
        this.refreshBushDepth();
    }

    tileId() {
        return this._tileId;
    }

    characterName() {
        return this._characterName;
    }

    characterIndex() {
        return this._characterIndex;
    }

    setImage(characterName, characterIndex) {
        this._tileId = 0;
        this._characterName = characterName;
        this._characterIndex = characterIndex;
        this._isObjectCharacter = ImageManager.isObjectCharacter(characterName);
    }

    setTileImage(tileId) {
        this._tileId = tileId;
        this._characterName = "";
        this._characterIndex = 0;
        this._isObjectCharacter = true;
    }

    checkEventTriggerTouchFront(d) {
        const x2 = $gameMap.roundXWithDirection(this._x, d);
        const y2 = $gameMap.roundYWithDirection(this._y, d);
        this.checkEventTriggerTouch(x2, y2);
    }

    checkEventTriggerTouch(/* x, y */) {
        return false;
    }

    isMovementSucceeded() {
        return this._movementSuccess;
    }

    setMovementSuccess(success) {
        this._movementSuccess = success;
    }

    moveStraight(d) {
        this.setMovementSuccess(this.canPass(this._x, this._y, d));
        if (this.isMovementSucceeded()) {
            this.setDirection(d);
            this._x = $gameMap.roundXWithDirection(this._x, d);
            this._y = $gameMap.roundYWithDirection(this._y, d);
            this._realX = $gameMap.xWithDirection(this._x, this.reverseDir(d));
            this._realY = $gameMap.yWithDirection(this._y, this.reverseDir(d));
            this.increaseSteps();
        } else {
            this.setDirection(d);
            this.checkEventTriggerTouchFront(d);
        }
    }

    moveDiagonally(horz, vert) {
        this.setMovementSuccess(this.canPassDiagonally(this._x, this._y, horz, vert));
        if (this.isMovementSucceeded()) {
            this._x = $gameMap.roundXWithDirection(this._x, horz);
            this._y = $gameMap.roundYWithDirection(this._y, vert);
            this._realX = $gameMap.xWithDirection(this._x, this.reverseDir(horz));
            this._realY = $gameMap.yWithDirection(this._y, this.reverseDir(vert));
            this.increaseSteps();
        }
        if (this._direction === this.reverseDir(horz)) this.setDirection(horz);
        if (this._direction === this.reverseDir(vert)) this.setDirection(vert);
    }

    jump(xPlus, yPlus) {
        if (Math.abs(xPlus) > Math.abs(yPlus)) {
            if (xPlus !== 0) this.setDirection(xPlus < 0 ? 4 : 6);
        } else {
            if (yPlus !== 0) this.setDirection(yPlus < 0 ? 8 : 2);
        }
        this._x += xPlus;
        this._y += yPlus;
        const distance = Math.round(Math.sqrt(xPlus * xPlus + yPlus * yPlus));
        this._jumpPeak = 10 + distance - this._moveSpeed;
        this._jumpCount = this._jumpPeak * 2;
        this.resetStopCount();
        this.straighten();
    }

    hasWalkAnime() {
        return this._walkAnime;
    }
    setWalkAnime(walkAnime) {
        this._walkAnime = walkAnime;
    }
    hasStepAnime() {
        return this._stepAnime;
    }
    setStepAnime(stepAnime) {
        this._stepAnime = stepAnime;
    }
    isDirectionFixed() {
        return this._directionFix;
    }
    setDirectionFix(directionFix) {
        this._directionFix = directionFix;
    }
    isThrough() {
        return this._through;
    }
    setThrough(through) {
        this._through = through;
    }
    isTransparent() {
        return this._transparent;
    }
    bushDepth() {
        return this._bushDepth;
    }
    setTransparent(transparent) {
        this._transparent = transparent;
    }
    startAnimation() {
        this._animationPlaying = true;
    }
    startBalloon() {
        this._balloonPlaying = true;
    }
    isAnimationPlaying() {
        return this._animationPlaying;
    }
    isBalloonPlaying() {
        return this._balloonPlaying;
    }
    endAnimation() {
        this._animationPlaying = false;
    }
    endBalloon() {
        this._balloonPlaying = false;
    }
};

//-----------------------------------------------------------------------------
// Game_Character — adds move routes

var Game_Character = class extends Game_CharacterBase {
    initMembers() {
        super.initMembers();
        this._moveRouteForcing = false;
        this._moveRoute = null;
        this._moveRouteIndex = 0;
        this._originalMoveRoute = null;
        this._originalMoveRouteIndex = 0;
        this._waitCount = 0;
    }

    memorizeMoveRoute() {
        this._originalMoveRoute = this._moveRoute;
        this._originalMoveRouteIndex = this._moveRouteIndex;
    }

    restoreMoveRoute() {
        this._moveRoute = this._originalMoveRoute;
        this._moveRouteIndex = this._originalMoveRouteIndex;
        this._originalMoveRoute = null;
    }

    isMoveRouteForcing() {
        return this._moveRouteForcing;
    }

    setMoveRoute(moveRoute) {
        if (this._moveRouteForcing) {
            this._originalMoveRoute = moveRoute;
            this._originalMoveRouteIndex = 0;
        } else {
            this._moveRoute = moveRoute;
            this._moveRouteIndex = 0;
        }
    }

    forceMoveRoute(moveRoute) {
        if (!this._originalMoveRoute) this.memorizeMoveRoute();
        this._moveRoute = moveRoute;
        this._moveRouteIndex = 0;
        this._moveRouteForcing = true;
        this._waitCount = 0;
    }

    updateStop() {
        super.updateStop();
        if (this._moveRouteForcing) this.updateRoutineMove();
    }

    updateRoutineMove() {
        if (this._waitCount > 0) {
            this._waitCount--;
        } else {
            this.setMovementSuccess(true);
            const command = this._moveRoute ? this._moveRoute.list[this._moveRouteIndex] : null;
            if (command) {
                this.processMoveCommand(command);
                this.advanceMoveRouteIndex();
            }
        }
    }

    processMoveCommand(command) {
        const gc = Game_Character;
        const params = command.parameters;
        switch (command.code) {
            case gc.ROUTE_END:
                this.processRouteEnd();
                break;
            case gc.ROUTE_MOVE_DOWN:
                this.moveStraight(2);
                break;
            case gc.ROUTE_MOVE_LEFT:
                this.moveStraight(4);
                break;
            case gc.ROUTE_MOVE_RIGHT:
                this.moveStraight(6);
                break;
            case gc.ROUTE_MOVE_UP:
                this.moveStraight(8);
                break;
            case gc.ROUTE_MOVE_LOWER_L:
                this.moveDiagonally(4, 2);
                break;
            case gc.ROUTE_MOVE_LOWER_R:
                this.moveDiagonally(6, 2);
                break;
            case gc.ROUTE_MOVE_UPPER_L:
                this.moveDiagonally(4, 8);
                break;
            case gc.ROUTE_MOVE_UPPER_R:
                this.moveDiagonally(6, 8);
                break;
            case gc.ROUTE_MOVE_RANDOM:
                this.moveRandom();
                break;
            case gc.ROUTE_MOVE_TOWARD:
                this.moveTowardPlayer();
                break;
            case gc.ROUTE_MOVE_AWAY:
                this.moveAwayFromPlayer();
                break;
            case gc.ROUTE_MOVE_FORWARD:
                this.moveForward();
                break;
            case gc.ROUTE_MOVE_BACKWARD:
                this.moveBackward();
                break;
            case gc.ROUTE_JUMP:
                this.jump(params[0], params[1]);
                break;
            case gc.ROUTE_WAIT:
                this._waitCount = params[0] - 1;
                break;
            case gc.ROUTE_TURN_DOWN:
                this.setDirection(2);
                break;
            case gc.ROUTE_TURN_LEFT:
                this.setDirection(4);
                break;
            case gc.ROUTE_TURN_RIGHT:
                this.setDirection(6);
                break;
            case gc.ROUTE_TURN_UP:
                this.setDirection(8);
                break;
            case gc.ROUTE_TURN_90D_R:
                this.turnRight90();
                break;
            case gc.ROUTE_TURN_90D_L:
                this.turnLeft90();
                break;
            case gc.ROUTE_TURN_180D:
                this.turn180();
                break;
            case gc.ROUTE_TURN_90D_R_L:
                this.turnRightOrLeft90();
                break;
            case gc.ROUTE_TURN_RANDOM:
                this.turnRandom();
                break;
            case gc.ROUTE_TURN_TOWARD:
                this.turnTowardPlayer();
                break;
            case gc.ROUTE_TURN_AWAY:
                this.turnAwayFromPlayer();
                break;
            case gc.ROUTE_SWITCH_ON:
                $gameSwitches.setValue(params[0], true);
                break;
            case gc.ROUTE_SWITCH_OFF:
                $gameSwitches.setValue(params[0], false);
                break;
            case gc.ROUTE_CHANGE_SPEED:
                this.setMoveSpeed(params[0]);
                break;
            case gc.ROUTE_CHANGE_FREQ:
                this.setMoveFrequency(params[0]);
                break;
            case gc.ROUTE_WALK_ANIME_ON:
                this.setWalkAnime(true);
                break;
            case gc.ROUTE_WALK_ANIME_OFF:
                this.setWalkAnime(false);
                break;
            case gc.ROUTE_STEP_ANIME_ON:
                this.setStepAnime(true);
                break;
            case gc.ROUTE_STEP_ANIME_OFF:
                this.setStepAnime(false);
                break;
            case gc.ROUTE_DIR_FIX_ON:
                this.setDirectionFix(true);
                break;
            case gc.ROUTE_DIR_FIX_OFF:
                this.setDirectionFix(false);
                break;
            case gc.ROUTE_THROUGH_ON:
                this.setThrough(true);
                break;
            case gc.ROUTE_THROUGH_OFF:
                this.setThrough(false);
                break;
            case gc.ROUTE_TRANSPARENT_ON:
                this.setTransparent(true);
                break;
            case gc.ROUTE_TRANSPARENT_OFF:
                this.setTransparent(false);
                break;
            case gc.ROUTE_CHANGE_IMAGE:
                this.setImage(params[0], params[1]);
                break;
            case gc.ROUTE_CHANGE_OPACITY:
                this.setOpacity(params[0]);
                break;
            case gc.ROUTE_CHANGE_BLEND_MODE:
                this.setBlendMode(params[0]);
                break;
            case gc.ROUTE_PLAY_SE:
                AudioManager.playSe(params[0]);
                break;
            case gc.ROUTE_SCRIPT:
                eval(params[0]);
                break;
        }
    }

    deltaXFrom(x) {
        return $gameMap.deltaX(this.x, x);
    }

    deltaYFrom(y) {
        return $gameMap.deltaY(this.y, y);
    }

    moveRandom() {
        const d = 2 + Math.randomInt(4) * 2;
        if (this.canPass(this.x, this.y, d)) this.moveStraight(d);
    }

    moveTowardCharacter(character) {
        const sx = this.deltaXFrom(character.x);
        const sy = this.deltaYFrom(character.y);
        if (Math.abs(sx) > Math.abs(sy)) {
            this.moveStraight(sx > 0 ? 4 : 6);
            if (!this.isMovementSucceeded() && sy !== 0) this.moveStraight(sy > 0 ? 8 : 2);
        } else if (sy !== 0) {
            this.moveStraight(sy > 0 ? 8 : 2);
            if (!this.isMovementSucceeded() && sx !== 0) this.moveStraight(sx > 0 ? 4 : 6);
        }
    }

    moveAwayFromCharacter(character) {
        const sx = this.deltaXFrom(character.x);
        const sy = this.deltaYFrom(character.y);
        if (Math.abs(sx) > Math.abs(sy)) {
            this.moveStraight(sx > 0 ? 6 : 4);
            if (!this.isMovementSucceeded() && sy !== 0) this.moveStraight(sy > 0 ? 2 : 8);
        } else if (sy !== 0) {
            this.moveStraight(sy > 0 ? 2 : 8);
            if (!this.isMovementSucceeded() && sx !== 0) this.moveStraight(sx > 0 ? 6 : 4);
        }
    }

    turnTowardCharacter(character) {
        const sx = this.deltaXFrom(character.x);
        const sy = this.deltaYFrom(character.y);
        if (Math.abs(sx) > Math.abs(sy)) this.setDirection(sx > 0 ? 4 : 6);
        else if (sy !== 0) this.setDirection(sy > 0 ? 8 : 2);
    }

    turnAwayFromCharacter(character) {
        const sx = this.deltaXFrom(character.x);
        const sy = this.deltaYFrom(character.y);
        if (Math.abs(sx) > Math.abs(sy)) this.setDirection(sx > 0 ? 6 : 4);
        else if (sy !== 0) this.setDirection(sy > 0 ? 2 : 8);
    }

    turnTowardPlayer() {
        this.turnTowardCharacter($gamePlayer);
    }

    turnAwayFromPlayer() {
        this.turnAwayFromCharacter($gamePlayer);
    }

    moveTowardPlayer() {
        this.moveTowardCharacter($gamePlayer);
    }

    moveAwayFromPlayer() {
        this.moveAwayFromCharacter($gamePlayer);
    }

    moveForward() {
        this.moveStraight(this.direction());
    }

    moveBackward() {
        const lastDirectionFix = this.isDirectionFixed();
        this.setDirectionFix(true);
        this.moveStraight(this.reverseDir(this.direction()));
        this.setDirectionFix(lastDirectionFix);
    }

    processRouteEnd() {
        if (this._moveRoute.repeat) {
            this._moveRouteIndex = -1;
        } else if (this._moveRouteForcing) {
            this._moveRouteForcing = false;
            this.restoreMoveRoute();
            this.setMovementSuccess(false);
        }
    }

    advanceMoveRouteIndex() {
        const moveRoute = this._moveRoute;
        if (moveRoute && (this.isMovementSucceeded() || moveRoute.skippable)) {
            const numCommands = moveRoute.list.length - 1;
            this._moveRouteIndex++;
            if (moveRoute.repeat && this._moveRouteIndex >= numCommands) this._moveRouteIndex = 0;
        }
    }

    turnRight90() {
        switch (this.direction()) {
            case 2:
                this.setDirection(4);
                break;
            case 4:
                this.setDirection(8);
                break;
            case 6:
                this.setDirection(2);
                break;
            case 8:
                this.setDirection(6);
                break;
        }
    }

    turnLeft90() {
        switch (this.direction()) {
            case 2:
                this.setDirection(6);
                break;
            case 4:
                this.setDirection(2);
                break;
            case 6:
                this.setDirection(8);
                break;
            case 8:
                this.setDirection(4);
                break;
        }
    }

    turn180() {
        this.setDirection(this.reverseDir(this.direction()));
    }

    turnRightOrLeft90() {
        switch (Math.randomInt(2)) {
            case 0:
                this.turnRight90();
                break;
            case 1:
                this.turnLeft90();
                break;
        }
    }

    turnRandom() {
        this.setDirection(2 + Math.randomInt(4) * 2);
    }

    swap(character) {
        const newX = character.x;
        const newY = character.y;
        character.locate(this.x, this.y);
        this.locate(newX, newY);
    }

    // A* pathfinding toward a goal tile (used by touch movement).
    findDirectionTo(goalX, goalY) {
        const searchLimit = this.searchLimit();
        const mapWidth = $gameMap.width();
        const nodeList = [];
        const openList = [];
        const closedList = [];
        const start = {};
        let best = start;

        if (this.x === goalX && this.y === goalY) return 0;

        start.parent = null;
        start.x = this.x;
        start.y = this.y;
        start.g = 0;
        start.f = $gameMap.distance(start.x, start.y, goalX, goalY);
        nodeList.push(start);
        openList.push(start.y * mapWidth + start.x);

        while (nodeList.length > 0) {
            let bestIndex = 0;
            for (let i = 0; i < nodeList.length; i++) {
                if (nodeList[i].f < nodeList[bestIndex].f) bestIndex = i;
            }

            const current = nodeList[bestIndex];
            const x1 = current.x;
            const y1 = current.y;
            const pos1 = y1 * mapWidth + x1;
            const g1 = current.g;

            nodeList.splice(bestIndex, 1);
            openList.splice(openList.indexOf(pos1), 1);
            closedList.push(pos1);

            if (current.x === goalX && current.y === goalY) {
                best = current;
                break;
            }

            if (g1 >= searchLimit) continue;

            for (let j = 0; j < 4; j++) {
                const direction = 2 + j * 2;
                const x2 = $gameMap.roundXWithDirection(x1, direction);
                const y2 = $gameMap.roundYWithDirection(y1, direction);
                const pos2 = y2 * mapWidth + x2;

                if (closedList.includes(pos2)) continue;
                if (!this.canPass(x1, y1, direction)) continue;

                const g2 = g1 + 1;
                const index2 = openList.indexOf(pos2);

                if (index2 < 0 || g2 < nodeList[index2].g) {
                    let neighbor = {};
                    if (index2 >= 0) {
                        neighbor = nodeList[index2];
                    } else {
                        nodeList.push(neighbor);
                        openList.push(pos2);
                    }
                    neighbor.parent = current;
                    neighbor.x = x2;
                    neighbor.y = y2;
                    neighbor.g = g2;
                    neighbor.f = g2 + $gameMap.distance(x2, y2, goalX, goalY);
                    if (!best || neighbor.f - neighbor.g < best.f - best.g) best = neighbor;
                }
            }
        }

        let node = best;
        while (node.parent && node.parent !== start) node = node.parent;

        const deltaX1 = $gameMap.deltaX(node.x, start.x);
        const deltaY1 = $gameMap.deltaY(node.y, start.y);
        if (deltaY1 > 0) return 2;
        if (deltaX1 < 0) return 4;
        if (deltaX1 > 0) return 6;
        if (deltaY1 < 0) return 8;

        const deltaX2 = this.deltaXFrom(goalX);
        const deltaY2 = this.deltaYFrom(goalY);
        if (Math.abs(deltaX2) > Math.abs(deltaY2)) return deltaX2 > 0 ? 4 : 6;
        if (deltaY2 !== 0) return deltaY2 > 0 ? 8 : 2;
        return 0;
    }

    searchLimit() {
        return 12;
    }
};

Game_Character.ROUTE_END = 0;
Game_Character.ROUTE_MOVE_DOWN = 1;
Game_Character.ROUTE_MOVE_LEFT = 2;
Game_Character.ROUTE_MOVE_RIGHT = 3;
Game_Character.ROUTE_MOVE_UP = 4;
Game_Character.ROUTE_MOVE_LOWER_L = 5;
Game_Character.ROUTE_MOVE_LOWER_R = 6;
Game_Character.ROUTE_MOVE_UPPER_L = 7;
Game_Character.ROUTE_MOVE_UPPER_R = 8;
Game_Character.ROUTE_MOVE_RANDOM = 9;
Game_Character.ROUTE_MOVE_TOWARD = 10;
Game_Character.ROUTE_MOVE_AWAY = 11;
Game_Character.ROUTE_MOVE_FORWARD = 12;
Game_Character.ROUTE_MOVE_BACKWARD = 13;
Game_Character.ROUTE_JUMP = 14;
Game_Character.ROUTE_WAIT = 15;
Game_Character.ROUTE_TURN_DOWN = 16;
Game_Character.ROUTE_TURN_LEFT = 17;
Game_Character.ROUTE_TURN_RIGHT = 18;
Game_Character.ROUTE_TURN_UP = 19;
Game_Character.ROUTE_TURN_90D_R = 20;
Game_Character.ROUTE_TURN_90D_L = 21;
Game_Character.ROUTE_TURN_180D = 22;
Game_Character.ROUTE_TURN_90D_R_L = 23;
Game_Character.ROUTE_TURN_RANDOM = 24;
Game_Character.ROUTE_TURN_TOWARD = 25;
Game_Character.ROUTE_TURN_AWAY = 26;
Game_Character.ROUTE_SWITCH_ON = 27;
Game_Character.ROUTE_SWITCH_OFF = 28;
Game_Character.ROUTE_CHANGE_SPEED = 29;
Game_Character.ROUTE_CHANGE_FREQ = 30;
Game_Character.ROUTE_WALK_ANIME_ON = 31;
Game_Character.ROUTE_WALK_ANIME_OFF = 32;
Game_Character.ROUTE_STEP_ANIME_ON = 33;
Game_Character.ROUTE_STEP_ANIME_OFF = 34;
Game_Character.ROUTE_DIR_FIX_ON = 35;
Game_Character.ROUTE_DIR_FIX_OFF = 36;
Game_Character.ROUTE_THROUGH_ON = 37;
Game_Character.ROUTE_THROUGH_OFF = 38;
Game_Character.ROUTE_TRANSPARENT_ON = 39;
Game_Character.ROUTE_TRANSPARENT_OFF = 40;
Game_Character.ROUTE_CHANGE_IMAGE = 41;
Game_Character.ROUTE_CHANGE_OPACITY = 42;
Game_Character.ROUTE_CHANGE_BLEND_MODE = 43;
Game_Character.ROUTE_PLAY_SE = 44;
Game_Character.ROUTE_SCRIPT = 45;

//-----------------------------------------------------------------------------
// Game_Player

var Game_Player = class extends Game_Character {
    initialize() {
        super.initialize();
        this.setTransparent($dataSystem.optTransparent);
    }

    initMembers() {
        super.initMembers();
        this._vehicleType = "walk";
        this._vehicleGettingOn = false;
        this._vehicleGettingOff = false;
        this._dashing = false;
        this._needsMapReload = false;
        this._transferring = false;
        this._newMapId = 0;
        this._newX = 0;
        this._newY = 0;
        this._newDirection = 0;
        this._fadeType = 0;
        this._followers = new Game_Followers();
        this._encounterCount = 0;
    }

    clearTransferInfo() {
        this._transferring = false;
        this._newMapId = 0;
        this._newX = 0;
        this._newY = 0;
        this._newDirection = 0;
    }

    followers() {
        return this._followers;
    }

    refresh() {
        const actor = $gameParty.leader();
        const characterName = actor ? actor.characterName() : "";
        const characterIndex = actor ? actor.characterIndex() : 0;
        this.setImage(characterName, characterIndex);
        this._followers.refresh();
    }

    isStopping() {
        if (this._vehicleGettingOn || this._vehicleGettingOff) return false;
        return super.isStopping();
    }

    reserveTransfer(mapId, x, y, d, fadeType) {
        this._transferring = true;
        this._newMapId = mapId;
        this._newX = x;
        this._newY = y;
        this._newDirection = d;
        this._fadeType = fadeType;
    }

    setupForNewGame() {
        const mapId = $dataSystem.startMapId;
        const x = $dataSystem.startX;
        const y = $dataSystem.startY;
        this.reserveTransfer(mapId, x, y, 2, 0);
    }

    requestMapReload() {
        this._needsMapReload = true;
    }

    isTransferring() {
        return this._transferring;
    }

    newMapId() {
        return this._newMapId;
    }

    fadeType() {
        return this._fadeType;
    }

    performTransfer() {
        if (this.isTransferring()) {
            this.setDirection(this._newDirection);
            if (this._newMapId !== $gameMap.mapId() || this._needsMapReload) {
                $gameMap.setup(this._newMapId);
                this._needsMapReload = false;
            }
            this.locate(this._newX, this._newY);
            this.refresh();
            this.clearTransferInfo();
        }
    }

    isMapPassable(x, y, d) {
        const vehicle = this.vehicle();
        if (vehicle) return vehicle.isMapPassable(x, y, d);
        return super.isMapPassable(x, y, d);
    }

    vehicle() {
        return $gameMap.vehicle(this._vehicleType);
    }

    isInBoat() {
        return this._vehicleType === "boat";
    }

    isInShip() {
        return this._vehicleType === "ship";
    }

    isInAirship() {
        return this._vehicleType === "airship";
    }

    isInVehicle() {
        return this.isInBoat() || this.isInShip() || this.isInAirship();
    }

    isNormal() {
        return this._vehicleType === "walk" && !this.isMoveRouteForcing();
    }

    isDashing() {
        return this._dashing;
    }

    isDebugThrough() {
        return Input.isPressed("control") && $gameTemp.isPlaytest();
    }

    isCollided(x, y) {
        if (this.isThrough()) return false;
        return this.pos(x, y) || this._followers.isSomeoneCollided(x, y);
    }

    centerX() {
        return ($gameMap.screenTileX() - 1) / 2;
    }

    centerY() {
        return ($gameMap.screenTileY() - 1) / 2;
    }

    center(x, y) {
        return $gameMap.setDisplayPos(x - this.centerX(), y - this.centerY());
    }

    locate(x, y) {
        super.locate(x, y);
        this.center(x, y);
        this.makeEncounterCount();
        if (this.isInVehicle()) this.vehicle().refresh();
        this._followers.synchronize(x, y, this.direction());
    }

    increaseSteps() {
        super.increaseSteps();
        if (this.isNormal()) $gameParty.increaseSteps();
    }

    makeEncounterCount() {
        const n = $gameMap.encounterStep();
        this._encounterCount = Math.randomInt(n) + Math.randomInt(n) + 1;
    }

    makeEncounterTroopId() {
        const encounterList = [];
        let weightSum = 0;
        for (const encounter of $gameMap.encounterList()) {
            if (this.meetsEncounterConditions(encounter)) {
                encounterList.push(encounter);
                weightSum += encounter.weight;
            }
        }
        if (weightSum > 0) {
            let value = Math.randomInt(weightSum);
            for (const encounter of encounterList) {
                value -= encounter.weight;
                if (value < 0) return encounter.troopId;
            }
        }
        return 0;
    }

    meetsEncounterConditions(encounter) {
        return encounter.regionSet.length === 0 || encounter.regionSet.includes(this.regionId());
    }

    executeEncounter() {
        if (!$gameMap.isEventRunning() && this._encounterCount <= 0) {
            this.makeEncounterCount();
            const troopId = this.makeEncounterTroopId();
            if ($dataTroops[troopId]) {
                BattleManager.setup(troopId, true, false);
                BattleManager.onEncounter();
                return true;
            }
            return false;
        }
        return false;
    }

    startMapEvent(x, y, triggers, normal) {
        if (!$gameMap.isEventRunning()) {
            for (const event of $gameMap.eventsXy(x, y)) {
                if (event.isTriggerIn(triggers) && event.isNormalPriority() === normal) event.start();
            }
        }
    }

    moveByInput() {
        if (!this.isMoving() && this.canMove()) {
            let direction = this.getInputDirection();
            if (direction > 0) {
                $gameTemp.clearDestination();
            } else if ($gameTemp.isDestinationValid()) {
                const x = $gameTemp.destinationX();
                const y = $gameTemp.destinationY();
                direction = this.findDirectionTo(x, y);
            }
            if (direction > 0) this.executeMove(direction);
        }
    }

    canMove() {
        if ($gameMap.isEventRunning() || $gameMessage.isBusy()) return false;
        if (this.isMoveRouteForcing() || this.areFollowersGathering()) return false;
        if (this._vehicleGettingOn || this._vehicleGettingOff) return false;
        if (this.isInVehicle() && !this.vehicle().canMove()) return false;
        return true;
    }

    getInputDirection() {
        return Input.dir4;
    }

    executeMove(direction) {
        this.moveStraight(direction);
    }

    update(sceneActive) {
        const lastScrolledX = this.scrolledX();
        const lastScrolledY = this.scrolledY();
        const wasMoving = this.isMoving();
        this.updateDashing();
        if (sceneActive) this.moveByInput();
        super.update();
        this.updateScroll(lastScrolledX, lastScrolledY);
        this.updateVehicle();
        if (!this.isMoving()) this.updateNonmoving(wasMoving, sceneActive);
        this._followers.update();
    }

    updateDashing() {
        if (this.isMoving()) return;
        if (this.canMove() && !this.isInVehicle() && !$gameMap.isDashDisabled()) {
            this._dashing = this.isDashButtonPressed() || $gameTemp.isDestinationValid();
        } else {
            this._dashing = false;
        }
    }

    isDashButtonPressed() {
        const shift = Input.isPressed("shift");
        if (ConfigManager.alwaysDash) return !shift;
        return shift;
    }

    updateScroll(lastScrolledX, lastScrolledY) {
        const x1 = lastScrolledX;
        const y1 = lastScrolledY;
        const x2 = this.scrolledX();
        const y2 = this.scrolledY();
        if (y2 > y1 && y2 > this.centerY()) $gameMap.scrollDown(y2 - y1);
        if (x2 < x1 && x2 < this.centerX()) $gameMap.scrollLeft(x1 - x2);
        if (x2 > x1 && x2 > this.centerX()) $gameMap.scrollRight(x2 - x1);
        if (y2 < y1 && y2 < this.centerY()) $gameMap.scrollUp(y1 - y2);
    }

    updateVehicle() {
        if (this.isInVehicle() && !this.areFollowersGathering()) {
            if (this._vehicleGettingOn) this.updateVehicleGetOn();
            else if (this._vehicleGettingOff) this.updateVehicleGetOff();
            else this.vehicle().syncWithPlayer();
        }
    }

    updateVehicleGetOn() {
        if (!this.areFollowersGathering() && !this.isMoving()) {
            this.setDirection(this.vehicle().direction());
            this.setMoveSpeed(this.vehicle().moveSpeed());
            this._vehicleGettingOn = false;
            this.setTransparent(true);
            if (this.isInAirship()) this.setThrough(true);
            this.vehicle().getOn();
        }
    }

    updateVehicleGetOff() {
        if (!this.areFollowersGathering() && this.vehicle().isLowest()) {
            this._vehicleGettingOff = false;
            this._vehicleType = "walk";
            this.setTransparent(false);
        }
    }

    updateNonmoving(wasMoving, sceneActive) {
        if (!$gameMap.isEventRunning()) {
            if (wasMoving) {
                $gameParty.onPlayerWalk();
                this.checkEventTriggerHere([1, 2]);
                if ($gameMap.setupStartingEvent()) return;
            }
            if (sceneActive && this.triggerAction()) return;
            if (wasMoving) this.updateEncounterCount();
            else $gameTemp.clearDestination();
        }
    }

    triggerAction() {
        if (this.canMove()) {
            if (this.triggerButtonAction()) return true;
            if (this.triggerTouchAction()) return true;
        }
        return false;
    }

    triggerButtonAction() {
        if (Input.isTriggered("ok")) {
            if (this.getOnOffVehicle()) return true;
            this.checkEventTriggerHere([0]);
            if ($gameMap.setupStartingEvent()) return true;
            this.checkEventTriggerThere([0, 1, 2]);
            if ($gameMap.setupStartingEvent()) return true;
        }
        return false;
    }

    triggerTouchAction() {
        if ($gameTemp.isDestinationValid()) {
            const direction = this.direction();
            const x1 = this.x;
            const y1 = this.y;
            const x2 = $gameMap.roundXWithDirection(x1, direction);
            const y2 = $gameMap.roundYWithDirection(y1, direction);
            const x3 = $gameMap.roundXWithDirection(x2, direction);
            const y3 = $gameMap.roundYWithDirection(y2, direction);
            const destX = $gameTemp.destinationX();
            const destY = $gameTemp.destinationY();
            if (destX === x1 && destY === y1) return this.triggerTouchActionD1(x1, y1);
            if (destX === x2 && destY === y2) return this.triggerTouchActionD2(x2, y2);
            if (destX === x3 && destY === y3) return this.triggerTouchActionD3(x2, y2);
        }
        return false;
    }

    triggerTouchActionD1(x1, y1) {
        if ($gameMap.airship().pos(x1, y1)) {
            if (TouchInput.isTriggered() && this.getOnOffVehicle()) return true;
        }
        this.checkEventTriggerHere([0]);
        return $gameMap.setupStartingEvent();
    }

    triggerTouchActionD2(x2, y2) {
        if ($gameMap.boat().pos(x2, y2) || $gameMap.ship().pos(x2, y2)) {
            if (TouchInput.isTriggered() && this.getOnVehicle()) return true;
        }
        if (this.isInBoat() || this.isInShip()) {
            if (TouchInput.isTriggered() && this.getOffVehicle()) return true;
        }
        this.checkEventTriggerThere([0, 1, 2]);
        return $gameMap.setupStartingEvent();
    }

    triggerTouchActionD3(x2, y2) {
        if ($gameMap.isCounter(x2, y2)) this.checkEventTriggerThere([0, 1, 2]);
        return $gameMap.setupStartingEvent();
    }

    updateEncounterCount() {
        if (this.canEncounter()) this._encounterCount -= this.encounterProgressValue();
    }

    canEncounter() {
        return (
            !$gameParty.hasEncounterNone() &&
            $gameSystem.isEncounterEnabled() &&
            !this.isInAirship() &&
            !this.isMoveRouteForcing() &&
            !this.isDebugThrough()
        );
    }

    encounterProgressValue() {
        let value = $gameMap.isBush(this.x, this.y) ? 2 : 1;
        if ($gameParty.hasEncounterHalf()) value *= 0.5;
        if (this.isInShip()) value *= 0.5;
        return value;
    }

    checkEventTriggerHere(triggers) {
        if (this.canStartLocalEvents()) this.startMapEvent(this.x, this.y, triggers, false);
    }

    checkEventTriggerThere(triggers) {
        if (this.canStartLocalEvents()) {
            const direction = this.direction();
            const x1 = this.x;
            const y1 = this.y;
            const x2 = $gameMap.roundXWithDirection(x1, direction);
            const y2 = $gameMap.roundYWithDirection(y1, direction);
            this.startMapEvent(x2, y2, triggers, true);
            if (!$gameMap.isAnyEventStarting() && $gameMap.isCounter(x2, y2)) {
                const x3 = $gameMap.roundXWithDirection(x2, direction);
                const y3 = $gameMap.roundYWithDirection(y2, direction);
                this.startMapEvent(x3, y3, triggers, true);
            }
        }
    }

    checkEventTriggerTouch(x, y) {
        if (this.canStartLocalEvents()) this.startMapEvent(x, y, [1, 2], true);
    }

    canStartLocalEvents() {
        return !this.isInAirship();
    }

    getOnOffVehicle() {
        if (this.isInVehicle()) return this.getOffVehicle();
        return this.getOnVehicle();
    }

    getOnVehicle() {
        const direction = this.direction();
        const x1 = this.x;
        const y1 = this.y;
        const x2 = $gameMap.roundXWithDirection(x1, direction);
        const y2 = $gameMap.roundYWithDirection(y1, direction);
        if ($gameMap.airship().pos(x1, y1)) this._vehicleType = "airship";
        else if ($gameMap.ship().pos(x2, y2)) this._vehicleType = "ship";
        else if ($gameMap.boat().pos(x2, y2)) this._vehicleType = "boat";
        if (this.isInVehicle()) {
            this._vehicleGettingOn = true;
            if (!this.isInAirship()) this.forceMoveForward();
            this.gatherFollowers();
        }
        return this._vehicleGettingOn;
    }

    getOffVehicle() {
        if (this.vehicle().isLandOk(this.x, this.y, this.direction())) {
            if (this.isInAirship()) this.setDirection(2);
            this._followers.synchronize(this.x, this.y, this.direction());
            this.vehicle().getOff();
            if (!this.isInAirship()) {
                this.forceMoveForward();
                this.setTransparent(false);
            }
            this._vehicleGettingOff = true;
            this.setMoveSpeed(4);
            this.setThrough(false);
            this.makeEncounterCount();
            this.gatherFollowers();
        }
        return this._vehicleGettingOff;
    }

    forceMoveForward() {
        this.setThrough(true);
        this.moveForward();
        this.setThrough(false);
    }

    isOnDamageFloor() {
        return $gameMap.isDamageFloor(this.x, this.y) && !this.isInAirship();
    }

    moveStraight(d) {
        if (this.canPass(this.x, this.y, d)) this._followers.updateMove();
        super.moveStraight(d);
    }

    moveDiagonally(horz, vert) {
        if (this.canPassDiagonally(this.x, this.y, horz, vert)) this._followers.updateMove();
        super.moveDiagonally(horz, vert);
    }

    jump(xPlus, yPlus) {
        super.jump(xPlus, yPlus);
        this._followers.jumpAll();
    }

    showFollowers() {
        this._followers.show();
    }

    hideFollowers() {
        this._followers.hide();
    }

    gatherFollowers() {
        this._followers.gather();
    }

    areFollowersGathering() {
        return this._followers.areGathering();
    }

    areFollowersGathered() {
        return this._followers.areGathered();
    }
};

//-----------------------------------------------------------------------------
// Game_Follower

var Game_Follower = class extends Game_Character {
    initialize(memberIndex) {
        super.initialize();
        this._memberIndex = memberIndex;
        this.setTransparent($dataSystem.optTransparent);
        this.setThrough(true);
    }

    refresh() {
        const characterName = this.isVisible() ? this.actor().characterName() : "";
        const characterIndex = this.isVisible() ? this.actor().characterIndex() : 0;
        this.setImage(characterName, characterIndex);
    }

    actor() {
        return $gameParty.battleMembers()[this._memberIndex];
    }

    isVisible() {
        return this.actor() && $gamePlayer.followers().isVisible();
    }

    isGathered() {
        return !this.isMoving() && this.pos($gamePlayer.x, $gamePlayer.y);
    }

    update() {
        super.update();
        this.setMoveSpeed($gamePlayer.realMoveSpeed());
        this.setOpacity($gamePlayer.opacity());
        this.setBlendMode($gamePlayer.blendMode());
        this.setWalkAnime($gamePlayer.hasWalkAnime());
        this.setStepAnime($gamePlayer.hasStepAnime());
        this.setDirectionFix($gamePlayer.isDirectionFixed());
        this.setTransparent($gamePlayer.isTransparent());
    }

    chaseCharacter(character) {
        const sx = this.deltaXFrom(character.x);
        const sy = this.deltaYFrom(character.y);
        if (sx !== 0 && sy !== 0) this.moveDiagonally(sx > 0 ? 4 : 6, sy > 0 ? 8 : 2);
        else if (sx !== 0) this.moveStraight(sx > 0 ? 4 : 6);
        else if (sy !== 0) this.moveStraight(sy > 0 ? 8 : 2);
        this.setMoveSpeed($gamePlayer.realMoveSpeed());
    }
};

//-----------------------------------------------------------------------------
// Game_Followers

var Game_Followers = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this._visible = $dataSystem.optFollowers;
        this._gathering = false;
        this._data = [];
        this.setup();
    }

    setup() {
        this._data = [];
        for (let i = 1; i < $gameParty.maxBattleMembers(); i++) this._data.push(new Game_Follower(i));
    }

    isVisible() {
        return this._visible;
    }
    show() {
        this._visible = true;
    }
    hide() {
        this._visible = false;
    }
    data() {
        return this._data.clone();
    }
    reverseData() {
        return this._data.clone().reverse();
    }
    follower(index) {
        return this._data[index];
    }

    refresh() {
        for (const follower of this._data) follower.refresh();
    }

    update() {
        if (this.areGathering()) {
            if (!this.areMoving()) this.updateMove();
            if (this.areGathered()) this._gathering = false;
        }
        for (const follower of this._data) follower.update();
    }

    updateMove() {
        for (let i = this._data.length - 1; i >= 0; i--) {
            const precedingCharacter = i > 0 ? this._data[i - 1] : $gamePlayer;
            this._data[i].chaseCharacter(precedingCharacter);
        }
    }

    jumpAll() {
        if ($gamePlayer.isJumping()) {
            for (const follower of this._data) {
                const sx = $gamePlayer.deltaXFrom(follower.x);
                const sy = $gamePlayer.deltaYFrom(follower.y);
                follower.jump(sx, sy);
            }
        }
    }

    synchronize(x, y, d) {
        for (const follower of this._data) {
            follower.locate(x, y);
            follower.setDirection(d);
        }
    }

    gather() {
        this._gathering = true;
    }

    areGathering() {
        return this._gathering;
    }

    visibleFollowers() {
        return this._data.filter(follower => follower.isVisible());
    }

    areMoving() {
        return this.visibleFollowers().some(follower => follower.isMoving());
    }

    areGathered() {
        return this.visibleFollowers().every(follower => follower.isGathered());
    }

    isSomeoneCollided(x, y) {
        return this.visibleFollowers().some(follower => follower.pos(x, y));
    }
};

//-----------------------------------------------------------------------------
// Game_Vehicle

var Game_Vehicle = class extends Game_Character {
    initialize(type) {
        super.initialize();
        this._type = type;
        this.resetDirection();
        this.initMoveSpeed();
        this.loadSystemSettings();
    }

    initMembers() {
        super.initMembers();
        this._type = "";
        this._mapId = 0;
        this._altitude = 0;
        this._driving = false;
        this._bgm = null;
    }

    isBoat() {
        return this._type === "boat";
    }
    isShip() {
        return this._type === "ship";
    }
    isAirship() {
        return this._type === "airship";
    }

    resetDirection() {
        this.setDirection(4);
    }

    initMoveSpeed() {
        if (this.isBoat()) this.setMoveSpeed(4);
        else if (this.isShip()) this.setMoveSpeed(5);
        else if (this.isAirship()) this.setMoveSpeed(6);
    }

    vehicle() {
        if (this.isBoat()) return $dataSystem.boat;
        if (this.isShip()) return $dataSystem.ship;
        if (this.isAirship()) return $dataSystem.airship;
        return null;
    }

    loadSystemSettings() {
        const vehicle = this.vehicle();
        this._mapId = vehicle.startMapId;
        this.setPosition(vehicle.startX, vehicle.startY);
        this.setImage(vehicle.characterName, vehicle.characterIndex);
    }

    refresh() {
        if (this._driving) {
            this._mapId = $gameMap.mapId();
            this.syncWithPlayer();
        } else if (this._mapId === $gameMap.mapId()) {
            this.locate(this.x, this.y);
        }
        if (this.isAirship()) this.setPriorityType(this._driving ? 2 : 0);
        else this.setPriorityType(1);
        this.setWalkAnime(this._driving);
        this.setStepAnime(this._driving);
        this.setTransparent(this._mapId !== $gameMap.mapId());
    }

    setLocation(mapId, x, y) {
        this._mapId = mapId;
        this.setPosition(x, y);
        this.refresh();
    }

    pos(x, y) {
        if (this._mapId === $gameMap.mapId()) return super.pos(x, y);
        return false;
    }

    isMapPassable(x, y, d) {
        const x2 = $gameMap.roundXWithDirection(x, d);
        const y2 = $gameMap.roundYWithDirection(y, d);
        if (this.isBoat()) return $gameMap.isBoatPassable(x2, y2);
        if (this.isShip()) return $gameMap.isShipPassable(x2, y2);
        if (this.isAirship()) return true;
        return false;
    }

    getOn() {
        this._driving = true;
        this.setWalkAnime(true);
        this.setStepAnime(true);
        $gameSystem.saveWalkingBgm();
        this.playBgm();
    }

    getOff() {
        this._driving = false;
        this.setWalkAnime(false);
        this.setStepAnime(false);
        this.resetDirection();
        $gameSystem.replayWalkingBgm();
    }

    setBgm(bgm) {
        this._bgm = bgm;
    }

    playBgm() {
        AudioManager.playBgm(this._bgm || this.vehicle().bgm);
    }

    syncWithPlayer() {
        this.copyPosition($gamePlayer);
        this.refreshBushDepth();
    }

    screenY() {
        return super.screenY() - this._altitude;
    }

    shadowX() {
        return this.screenX();
    }

    shadowY() {
        return this.screenY() + this._altitude;
    }

    shadowOpacity() {
        return (255 * this._altitude) / this.maxAltitude();
    }

    canMove() {
        if (this.isAirship()) return this.isHighest();
        return true;
    }

    update() {
        super.update();
        if (this.isAirship()) this.updateAirship();
    }

    updateAirship() {
        this.updateAirshipAltitude();
        this.setStepAnime(this.isHighest());
        this.setPriorityType(this.isLowest() ? 0 : 2);
    }

    updateAirshipAltitude() {
        if (this._driving && !this.isHighest()) this._altitude++;
        if (!this._driving && !this.isLowest()) this._altitude--;
    }

    maxAltitude() {
        return 48;
    }

    isLowest() {
        return this._altitude <= 0;
    }

    isHighest() {
        return this._altitude >= this.maxAltitude();
    }

    isTakeoffOk() {
        return $gamePlayer.areFollowersGathered();
    }

    isLandOk(x, y, d) {
        if (this.isAirship()) {
            if (!$gameMap.isAirshipLandOk(x, y)) return false;
            if ($gameMap.eventsXy(x, y).length > 0) return false;
        } else {
            const x2 = $gameMap.roundXWithDirection(x, d);
            const y2 = $gameMap.roundYWithDirection(y, d);
            if (!$gameMap.isValid(x2, y2)) return false;
            if (!$gameMap.isPassable(x2, y2, this.reverseDir(d))) return false;
            if (this.isCollidedWithCharacters(x2, y2)) return false;
        }
        return true;
    }
};

//-----------------------------------------------------------------------------
// Game_Event

var Game_Event = class extends Game_Character {
    initialize(mapId, eventId) {
        super.initialize();
        this._mapId = mapId;
        this._eventId = eventId;
        this.locate(this.event().x, this.event().y);
        this.refresh();
    }

    initMembers() {
        super.initMembers();
        this._moveType = 0;
        this._trigger = 0;
        this._starting = false;
        this._erased = false;
        this._pageIndex = -2;
        this._originalPattern = 1;
        this._originalDirection = 2;
        this._prelockDirection = 0;
        this._locked = false;
    }

    eventId() {
        return this._eventId;
    }

    event() {
        return $dataMap.events[this._eventId];
    }

    page() {
        return this.event().pages[this._pageIndex];
    }

    list() {
        return this.page().list;
    }

    isCollidedWithCharacters(x, y) {
        return super.isCollidedWithCharacters(x, y) || this.isCollidedWithPlayerCharacters(x, y);
    }

    isCollidedWithEvents(x, y) {
        const events = $gameMap.eventsXyNt(x, y);
        return events.length > 0;
    }

    isCollidedWithPlayerCharacters(x, y) {
        return this.isNormalPriority() && $gamePlayer.isCollided(x, y);
    }

    lock() {
        if (!this._locked) {
            this._prelockDirection = this.direction();
            this.turnTowardPlayer();
            this._locked = true;
        }
    }

    unlock() {
        if (this._locked) {
            this._locked = false;
            this.setDirection(this._prelockDirection);
        }
    }

    updateStop() {
        if (this._locked) this.resetStopCount();
        super.updateStop();
        if (!this.isMoveRouteForcing()) this.updateSelfMovement();
    }

    updateSelfMovement() {
        if (!this._locked && this.isNearTheScreen() && this.checkStop(this.stopCountThreshold())) {
            switch (this._moveType) {
                case 1:
                    this.moveTypeRandom();
                    break;
                case 2:
                    this.moveTypeTowardPlayer();
                    break;
                case 3:
                    this.moveTypeCustom();
                    break;
            }
        }
    }

    stopCountThreshold() {
        return 30 * (5 - this.moveFrequency());
    }

    moveTypeRandom() {
        switch (Math.randomInt(6)) {
            case 0:
            case 1:
                this.moveRandom();
                break;
            case 2:
            case 3:
            case 4:
                this.moveForward();
                break;
            case 5:
                this.resetStopCount();
                break;
        }
    }

    moveTypeTowardPlayer() {
        if (this.isNearThePlayer()) {
            switch (Math.randomInt(6)) {
                case 0:
                case 1:
                case 2:
                case 3:
                    this.moveTowardPlayer();
                    break;
                case 4:
                    this.moveRandom();
                    break;
                case 5:
                    this.moveForward();
                    break;
            }
        } else {
            this.moveRandom();
        }
    }

    isNearThePlayer() {
        const sx = Math.abs(this.deltaXFrom($gamePlayer.x));
        const sy = Math.abs(this.deltaYFrom($gamePlayer.y));
        return sx + sy < 20;
    }

    moveTypeCustom() {
        this.updateRoutineMove();
    }

    isStarting() {
        return this._starting;
    }

    clearStartingFlag() {
        this._starting = false;
    }

    isTriggerIn(triggers) {
        return triggers.includes(this._trigger);
    }

    start() {
        const list = this.list();
        if (list && list.length > 1) {
            this._starting = true;
            if (this.isTriggerIn([0, 1, 2])) this.lock();
        }
    }

    erase() {
        this._erased = true;
        this.refresh();
    }

    refresh() {
        const newPageIndex = this._erased ? -1 : this.findProperPageIndex();
        if (this._pageIndex !== newPageIndex) {
            this._pageIndex = newPageIndex;
            this.setupPage();
        }
    }

    findProperPageIndex() {
        const pages = this.event().pages;
        for (let i = pages.length - 1; i >= 0; i--) {
            const page = pages[i];
            if (this.meetsConditions(page)) return i;
        }
        return -1;
    }

    meetsConditions(page) {
        const c = page.conditions;
        if (c.switch1Valid) {
            if (!$gameSwitches.value(c.switch1Id)) return false;
        }
        if (c.switch2Valid) {
            if (!$gameSwitches.value(c.switch2Id)) return false;
        }
        if (c.variableValid) {
            if ($gameVariables.value(c.variableId) < c.variableValue) return false;
        }
        if (c.selfSwitchValid) {
            const key = [this._mapId, this._eventId, c.selfSwitchCh];
            if ($gameSelfSwitches.value(key) !== true) return false;
        }
        if (c.itemValid) {
            const item = $dataItems[c.itemId];
            if (!$gameParty.hasItem(item)) return false;
        }
        if (c.actorValid) {
            const actor = $gameActors.actor(c.actorId);
            if (!$gameParty.members().includes(actor)) return false;
        }
        return true;
    }

    setupPage() {
        if (this._pageIndex >= 0) this.setupPageSettings();
        else this.clearPageSettings();
        this.refreshBushDepth();
        this.clearStartingFlag();
        this.checkEventTriggerAuto();
    }

    clearPageSettings() {
        this.setImage("", 0);
        this._moveType = 0;
        this._trigger = null;
        this._interpreter = null;
        this.setThrough(true);
    }

    setupPageSettings() {
        const page = this.page();
        const image = page.image;
        if (image.tileId > 0) this.setTileImage(image.tileId);
        else this.setImage(image.characterName, image.characterIndex);
        if (this._originalDirection !== image.direction) {
            this._originalDirection = image.direction;
            this._prelockDirection = 0;
            this.setDirectionFix(false);
            this.setDirection(image.direction);
        }
        if (this._originalPattern !== image.pattern) {
            this._originalPattern = image.pattern;
            this.setPattern(image.pattern);
        }
        this.setMoveSpeed(page.moveSpeed);
        this.setMoveFrequency(page.moveFrequency);
        this.setPriorityType(page.priorityType);
        this.setWalkAnime(page.walkAnime);
        this.setStepAnime(page.stepAnime);
        this.setDirectionFix(page.directionFix);
        this.setThrough(page.through);
        this.setMoveRoute(page.moveRoute);
        this._moveType = page.moveType;
        this._trigger = page.trigger;
        if (this._trigger === 4) this._interpreter = new Game_Interpreter();
        else this._interpreter = null;
    }

    isOriginalPattern() {
        return this.pattern() === this._originalPattern;
    }

    resetPattern() {
        this.setPattern(this._originalPattern);
    }

    checkEventTriggerTouch(x, y) {
        if (!$gameMap.isEventRunning()) {
            if (this._trigger === 2 && $gamePlayer.pos(x, y)) {
                if (!this.isJumping() && this.isNormalPriority()) this.start();
            }
        }
    }

    checkEventTriggerAuto() {
        if (this._trigger === 3) this.start();
    }

    update() {
        super.update();
        this.checkEventTriggerAuto();
        this.updateParallel();
    }

    updateParallel() {
        if (this._interpreter) {
            if (!this._interpreter.isRunning()) this._interpreter.setup(this.list(), this._eventId);
            this._interpreter.update();
        }
    }

    locate(x, y) {
        super.locate(x, y);
        this._prelockDirection = 0;
    }

    forceMoveRoute(moveRoute) {
        super.forceMoveRoute(moveRoute);
        this._prelockDirection = 0;
    }
};
