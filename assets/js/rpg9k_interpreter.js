//=============================================================================
// rpg9k_interpreter.js — Game_Interpreter: runs event command lists.
// Command codes and parameter layouts match RPG Maker MZ so event data and
// documentation are interchangeable.
//=============================================================================
"use strict";

var Game_Interpreter = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize(depth) {
        this._depth = depth || 0;
        this.checkOverflow();
        this.clear();
        this._branch = {};
        this._indent = 0;
        this._frameCount = 0;
        this._freezeChecker = 0;
    }

    checkOverflow() {
        if (this._depth >= 100) throw new Error("Common event calls exceeded the limit");
    }

    clear() {
        this._mapId = 0;
        this._eventId = 0;
        this._list = null;
        this._index = 0;
        this._waitCount = 0;
        this._waitMode = "";
        this._comments = "";
        this._characterId = 0;
        this._childInterpreter = null;
    }

    setup(list, eventId) {
        this.clear();
        this._mapId = $gameMap.mapId();
        this._eventId = eventId || 0;
        this._list = list;
        this.loadImages();
    }

    loadImages() {
        // Preload images used by the first commands to avoid pop-in.
        const list = this._list.slice(0, 200);
        for (const command of list) {
            const params = command.parameters;
            switch (command.code) {
                case 101:
                    ImageManager.loadFace(params[0]);
                    break;
                case 231:
                    ImageManager.loadPicture(params[1]);
                    break;
            }
        }
    }

    eventId() {
        return this._eventId;
    }

    isOnCurrentMap() {
        return this._mapId === $gameMap.mapId();
    }

    setupReservedCommonEvent() {
        if ($gameTemp.isCommonEventReserved()) {
            const commonEvent = $gameTemp.retrieveCommonEvent();
            if (commonEvent) {
                this.setup(commonEvent.list);
                return true;
            }
        }
        return false;
    }

    isRunning() {
        return !!this._list;
    }

    update() {
        while (this.isRunning()) {
            if (this.updateChild() || this.updateWait()) break;
            if (SceneManager.isSceneChanging()) break;
            if (!this.executeCommand()) break;
            if (this.checkFreeze()) break;
        }
    }

    updateChild() {
        if (this._childInterpreter) {
            this._childInterpreter.update();
            if (this._childInterpreter.isRunning()) return true;
            this._childInterpreter = null;
        }
        return false;
    }

    updateWait() {
        return this.updateWaitCount() || this.updateWaitMode();
    }

    updateWaitCount() {
        if (this._waitCount > 0) {
            this._waitCount--;
            return true;
        }
        return false;
    }

    updateWaitMode() {
        let character = null;
        let waiting = false;
        switch (this._waitMode) {
            case "message":
                waiting = $gameMessage.isBusy();
                break;
            case "transfer":
                waiting = $gamePlayer.isTransferring();
                break;
            case "scroll":
                waiting = $gameMap.isScrolling();
                break;
            case "route":
                character = this.character(this._characterId);
                waiting = character && character.isMoveRouteForcing();
                break;
            case "animation":
                character = this.character(this._characterId);
                waiting = character && character.isAnimationPlaying();
                break;
            case "balloon":
                character = this.character(this._characterId);
                waiting = character && character.isBalloonPlaying();
                break;
            case "gather":
                waiting = $gamePlayer.areFollowersGathering();
                break;
            case "action":
                waiting = BattleManager.isActionForced();
                break;
            case "video":
                waiting = Video.isPlaying();
                break;
            case "image":
                waiting = !ImageManager.isReady();
                break;
        }
        if (!waiting) this._waitMode = "";
        return waiting;
    }

    setWaitMode(waitMode) {
        this._waitMode = waitMode;
    }

    wait(duration) {
        this._waitCount = duration;
    }

    fadeSpeed() {
        return 24;
    }

    executeCommand() {
        const command = this.currentCommand();
        if (command) {
            this._indent = command.indent;
            const methodName = "command" + command.code;
            if (typeof this[methodName] === "function") {
                if (!this[methodName](command.parameters)) return false;
            }
            this._index++;
        } else {
            this.terminate();
        }
        return true;
    }

    checkFreeze() {
        if (this._frameCount !== Graphics.frameCount) {
            this._frameCount = Graphics.frameCount;
            this._freezeChecker = 0;
        }
        if (this._freezeChecker++ >= 100000) return true;
        return false;
    }

    terminate() {
        this._list = null;
        this._comments = "";
    }

    skipBranch() {
        while (this._list[this._index + 1] && this._list[this._index + 1].indent > this._indent) {
            this._index++;
        }
    }

    currentCommand() {
        return this._list[this._index];
    }

    nextEventCode() {
        const command = this._list[this._index + 1];
        return command ? command.code : 0;
    }

    iterateActorId(param, callback) {
        if (param === 0) {
            $gameParty.members().forEach(callback);
        } else {
            const actor = $gameActors.actor(param);
            if (actor) callback(actor);
        }
    }

    iterateActorEx(param1, param2, callback) {
        if (param1 === 0) this.iterateActorId(param2, callback);
        else this.iterateActorId($gameVariables.value(param2), callback);
    }

    iterateActorIndex(param, callback) {
        if (param < 0) {
            $gameParty.members().forEach(callback);
        } else {
            const actor = $gameParty.members()[param];
            if (actor) callback(actor);
        }
    }

    iterateEnemyIndex(param, callback) {
        if (param < 0) {
            $gameTroop.members().forEach(callback);
        } else {
            const enemy = $gameTroop.members()[param];
            if (enemy) callback(enemy);
        }
    }

    iterateBattler(param1, param2, callback) {
        if ($gameParty.inBattle()) {
            if (param1 === 0) this.iterateEnemyIndex(param2, callback);
            else this.iterateActorId(param2, callback);
        }
    }

    character(param) {
        if ($gameParty.inBattle()) return null;
        if (param < 0) return $gamePlayer;
        if (this.isOnCurrentMap()) {
            const id = param > 0 ? param : this._eventId;
            return $gameMap.event(id);
        }
        return null;
    }

    operateValue(operation, operandType, operand) {
        const value = operandType === 0 ? operand : $gameVariables.value(operand);
        return operation === 0 ? value : -value;
    }

    changeHp(target, value, allowDeath) {
        if (target.isAlive()) {
            if (!allowDeath && target.hp <= -value) value = 1 - target.hp;
            target.gainHp(value);
            if (target.isDead()) target.performCollapse();
        }
    }

    // Show Text
    command101(params) {
        if ($gameMessage.isBusy()) return false;
        $gameMessage.setFaceImage(params[0], params[1]);
        $gameMessage.setBackground(params[2]);
        $gameMessage.setPositionType(params[3]);
        $gameMessage.setSpeakerName(params[4]);
        while (this.nextEventCode() === 401) {
            // Text data
            this._index++;
            $gameMessage.add(this.currentCommand().parameters[0]);
        }
        switch (this.nextEventCode()) {
            case 102: // Show Choices
                this._index++;
                this.setupChoices(this.currentCommand().parameters);
                break;
            case 103: // Input Number
                this._index++;
                this.setupNumInput(this.currentCommand().parameters);
                break;
            case 104: // Select Item
                this._index++;
                this.setupItemChoice(this.currentCommand().parameters);
                break;
        }
        this.setWaitMode("message");
        return true;
    }

    // Show Choices
    command102(params) {
        if ($gameMessage.isBusy()) return false;
        this.setupChoices(params);
        this.setWaitMode("message");
        return true;
    }

    setupChoices(params) {
        const choices = params[0].clone();
        const cancelType = params[1] < choices.length ? params[1] : -2;
        const defaultType = params.length > 2 ? params[2] : 0;
        const positionType = params.length > 3 ? params[3] : 2;
        const background = params.length > 4 ? params[4] : 0;
        $gameMessage.setChoices(choices, defaultType, cancelType);
        $gameMessage.setChoiceBackground(background);
        $gameMessage.setChoicePositionType(positionType);
        $gameMessage.setChoiceCallback(n => {
            this._branch[this._indent] = n;
        });
    }

    // When [**]
    command402(params) {
        if (this._branch[this._indent] !== params[0]) this.skipBranch();
        return true;
    }

    // When Cancel
    command403() {
        if (this._branch[this._indent] >= 0) this.skipBranch();
        return true;
    }

    // Input Number
    command103(params) {
        if ($gameMessage.isBusy()) return false;
        this.setupNumInput(params);
        this.setWaitMode("message");
        return true;
    }

    setupNumInput(params) {
        $gameMessage.setNumberInput(params[0], params[1]);
    }

    // Select Item
    command104(params) {
        if ($gameMessage.isBusy()) return false;
        this.setupItemChoice(params);
        this.setWaitMode("message");
        return true;
    }

    setupItemChoice(params) {
        $gameMessage.setItemChoice(params[0], params[1] || 2);
    }

    // Show Scrolling Text
    command105(params) {
        if ($gameMessage.isBusy()) return false;
        $gameMessage.setScroll(params[0], params[1]);
        while (this.nextEventCode() === 405) {
            this._index++;
            $gameMessage.add(this.currentCommand().parameters[0]);
        }
        this.setWaitMode("message");
        return true;
    }

    // Comment
    command108(params) {
        this._comments = [params[0]];
        while (this.nextEventCode() === 408) {
            this._index++;
            this._comments.push(this.currentCommand().parameters[0]);
        }
        return true;
    }

    // Skip
    command109() {
        this.skipBranch();
        return true;
    }

    // Conditional Branch
    command111(params) {
        let result = false;
        let value1, value2;
        let actor, enemy, character;
        switch (params[0]) {
            case 0: // Switch
                result = $gameSwitches.value(params[1]) === (params[2] === 0);
                break;
            case 1: // Variable
                value1 = $gameVariables.value(params[1]);
                if (params[2] === 0) value2 = params[3];
                else value2 = $gameVariables.value(params[3]);
                switch (params[4]) {
                    case 0:
                        result = value1 === value2;
                        break;
                    case 1:
                        result = value1 >= value2;
                        break;
                    case 2:
                        result = value1 <= value2;
                        break;
                    case 3:
                        result = value1 > value2;
                        break;
                    case 4:
                        result = value1 < value2;
                        break;
                    case 5:
                        result = value1 !== value2;
                        break;
                }
                break;
            case 2: // Self Switch
                if (this._eventId > 0) {
                    const key = [this._mapId, this._eventId, params[1]];
                    result = $gameSelfSwitches.value(key) === (params[2] === 0);
                }
                break;
            case 3: // Timer
                if ($gameTimer.isWorking()) {
                    const sec = $gameTimer.frames() / 60;
                    if (params[2] === 0) result = sec >= params[1];
                    else result = sec <= params[1];
                }
                break;
            case 4: // Actor
                actor = $gameActors.actor(params[1]);
                if (actor) {
                    const n = params[3];
                    switch (params[2]) {
                        case 0: // In the Party
                            result = $gameParty.members().includes(actor);
                            break;
                        case 1: // Name
                            result = actor.name() === n;
                            break;
                        case 2: // Class
                            result = actor.isClass($dataClasses[n]);
                            break;
                        case 3: // Skill
                            result = actor.hasSkill(n);
                            break;
                        case 4: // Weapon
                            result = actor.hasWeapon($dataWeapons[n]);
                            break;
                        case 5: // Armor
                            result = actor.hasArmor($dataArmors[n]);
                            break;
                        case 6: // State
                            result = actor.isStateAffected(n);
                            break;
                    }
                }
                break;
            case 5: // Enemy
                enemy = $gameTroop.members()[params[1]];
                if (enemy) {
                    switch (params[2]) {
                        case 0: // Appeared
                            result = enemy.isAlive();
                            break;
                        case 1: // State
                            result = enemy.isStateAffected(params[3]);
                            break;
                    }
                }
                break;
            case 6: // Character
                character = this.character(params[1]);
                if (character) result = character.direction() === params[2];
                break;
            case 7: // Gold
                switch (params[2]) {
                    case 0:
                        result = $gameParty.gold() >= params[1];
                        break;
                    case 1:
                        result = $gameParty.gold() <= params[1];
                        break;
                    case 2:
                        result = $gameParty.gold() < params[1];
                        break;
                }
                break;
            case 8: // Item
                result = $gameParty.hasItem($dataItems[params[1]]);
                break;
            case 9: // Weapon
                result = $gameParty.hasItem($dataWeapons[params[1]], params[2]);
                break;
            case 10: // Armor
                result = $gameParty.hasItem($dataArmors[params[1]], params[2]);
                break;
            case 11: // Button
                switch (params[2] || 0) {
                    case 0:
                        result = Input.isPressed(params[1]);
                        break;
                    case 1:
                        result = Input.isTriggered(params[1]);
                        break;
                    case 2:
                        result = Input.isRepeated(params[1]);
                        break;
                }
                break;
            case 12: // Script
                result = !!eval(params[1]);
                break;
            case 13: // Vehicle
                result = $gamePlayer.vehicle() === $gameMap.vehicle(params[1]);
                break;
        }
        this._branch[this._indent] = result;
        if (this._branch[this._indent] === false) this.skipBranch();
        return true;
    }

    // Else
    command411() {
        if (this._branch[this._indent] !== false) this.skipBranch();
        return true;
    }

    // Loop
    command112() {
        return true;
    }

    // Repeat Above
    command413() {
        do {
            this._index--;
        } while (this.currentCommand().indent !== this._indent);
        return true;
    }

    // Break Loop
    command113() {
        let depth = 0;
        while (this._index < this._list.length - 1) {
            this._index++;
            const command = this.currentCommand();
            if (command.code === 112) depth++;
            if (command.code === 413) {
                if (depth > 0) depth--;
                else break;
            }
        }
        return true;
    }

    // Exit Event Processing
    command115() {
        this._index = this._list.length;
        return true;
    }

    // Common Event
    command117(params) {
        const commonEvent = $dataCommonEvents[params[0]];
        if (commonEvent) {
            const eventId = this.isOnCurrentMap() ? this._eventId : 0;
            this.setupChild(commonEvent.list, eventId);
        }
        return true;
    }

    setupChild(list, eventId) {
        this._childInterpreter = new Game_Interpreter(this._depth + 1);
        this._childInterpreter.setup(list, eventId);
    }

    // Label
    command118() {
        return true;
    }

    // Jump to Label
    command119(params) {
        const labelName = params[0];
        for (let i = 0; i < this._list.length; i++) {
            const command = this._list[i];
            if (command.code === 118 && command.parameters[0] === labelName) {
                this.jumpTo(i);
                break;
            }
        }
        return true;
    }

    jumpTo(index) {
        const lastIndex = this._index;
        const startIndex = Math.min(index, lastIndex);
        const endIndex = Math.max(index, lastIndex);
        let indent = this._indent;
        for (let i = startIndex; i <= endIndex; i++) {
            const newIndent = this._list[i].indent;
            if (newIndent !== indent) {
                this._branch[indent] = null;
                indent = newIndent;
            }
        }
        this._index = index;
    }

    // Control Switches
    command121(params) {
        for (let i = params[0]; i <= params[1]; i++) $gameSwitches.setValue(i, params[2] === 0);
        return true;
    }

    // Control Variables
    command122(params) {
        const startId = params[0];
        const endId = params[1];
        const operationType = params[2];
        const operand = params[3];
        let value = 0;
        let randomMax = 1;
        switch (operand) {
            case 0: // Constant
                value = params[4];
                break;
            case 1: // Variable
                value = $gameVariables.value(params[4]);
                break;
            case 2: // Random
                value = params[4];
                randomMax = params[5] - params[4] + 1;
                randomMax = Math.max(randomMax, 1);
                break;
            case 3: // Game Data
                value = this.gameDataOperand(params[4], params[5], params[6]);
                break;
            case 4: // Script
                value = eval(params[4]);
                break;
        }
        for (let i = startId; i <= endId; i++) {
            if (typeof value === "number") {
                const realValue = value + Math.randomInt(randomMax);
                this.operateVariable(i, operationType, realValue);
            } else {
                this.operateVariable(i, operationType, value);
            }
        }
        return true;
    }

    gameDataOperand(type, param1, param2) {
        let actor, enemy, character;
        switch (type) {
            case 0: // Item
                return $gameParty.numItems($dataItems[param1]);
            case 1: // Weapon
                return $gameParty.numItems($dataWeapons[param1]);
            case 2: // Armor
                return $gameParty.numItems($dataArmors[param1]);
            case 3: // Actor
                actor = $gameActors.actor(param1);
                if (actor) {
                    switch (param2) {
                        case 0:
                            return actor.level;
                        case 1:
                            return actor.currentExp();
                        case 2:
                            return actor.hp;
                        case 3:
                            return actor.mp;
                        case 12:
                            return actor.tp;
                        default:
                            if (param2 >= 4 && param2 <= 11) return actor.param(param2 - 4);
                    }
                }
                break;
            case 4: // Enemy
                enemy = $gameTroop.members()[param1];
                if (enemy) {
                    switch (param2) {
                        case 0:
                            return enemy.hp;
                        case 1:
                            return enemy.mp;
                        case 10:
                            return enemy.tp;
                        default:
                            if (param2 >= 2 && param2 <= 9) return enemy.param(param2 - 2);
                    }
                }
                break;
            case 5: // Character
                character = this.character(param1);
                if (character) {
                    switch (param2) {
                        case 0:
                            return character.x;
                        case 1:
                            return character.y;
                        case 2:
                            return character.direction();
                        case 3:
                            return character.screenX();
                        case 4:
                            return character.screenY();
                    }
                }
                break;
            case 6: // Party
                actor = $gameParty.members()[param1];
                return actor ? actor.actorId() : 0;
            case 8: // Last
                return $gameTemp.lastActionData(param1);
            case 7: // Other
                switch (param1) {
                    case 0:
                        return $gameMap.mapId();
                    case 1:
                        return $gameParty.size();
                    case 2:
                        return $gameParty.gold();
                    case 3:
                        return $gameParty.steps();
                    case 4:
                        return $gameSystem.playtime();
                    case 5:
                        return $gameTimer.seconds();
                    case 6:
                        return $gameSystem.saveCount();
                    case 7:
                        return $gameSystem.battleCount();
                    case 8:
                        return $gameSystem.winCount();
                    case 9:
                        return $gameSystem.escapeCount();
                }
                break;
        }
        return 0;
    }

    operateVariable(variableId, operationType, value) {
        try {
            const oldValue = $gameVariables.value(variableId);
            switch (operationType) {
                case 0: // Set
                    $gameVariables.setValue(variableId, value);
                    break;
                case 1: // Add
                    $gameVariables.setValue(variableId, oldValue + value);
                    break;
                case 2: // Sub
                    $gameVariables.setValue(variableId, oldValue - value);
                    break;
                case 3: // Mul
                    $gameVariables.setValue(variableId, oldValue * value);
                    break;
                case 4: // Div
                    $gameVariables.setValue(variableId, oldValue / value);
                    break;
                case 5: // Mod
                    $gameVariables.setValue(variableId, oldValue % value);
                    break;
            }
        } catch (e) {
            $gameVariables.setValue(variableId, 0);
        }
    }

    // Control Self Switch
    command123(params) {
        if (this._eventId > 0) {
            const key = [this._mapId, this._eventId, params[0]];
            $gameSelfSwitches.setValue(key, params[1] === 0);
        }
        return true;
    }

    // Control Timer
    command124(params) {
        if (params[0] === 0) $gameTimer.start(params[1] * 60);
        else $gameTimer.stop();
        return true;
    }

    // Change Gold
    command125(params) {
        const value = this.operateValue(params[0], params[1], params[2]);
        $gameParty.gainGold(value);
        return true;
    }

    // Change Items
    command126(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        $gameParty.gainItem($dataItems[params[0]], value);
        return true;
    }

    // Change Weapons
    command127(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        $gameParty.gainItem($dataWeapons[params[0]], value, params[4]);
        return true;
    }

    // Change Armors
    command128(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        $gameParty.gainItem($dataArmors[params[0]], value, params[4]);
        return true;
    }

    // Change Party Member
    command129(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) {
            if (params[1] === 0) {
                if (params[2]) actor.setup(actor.actorId());
                $gameParty.addActor(params[0]);
            } else {
                $gameParty.removeActor(params[0]);
            }
        }
        return true;
    }

    // Change Battle BGM
    command132(params) {
        $gameSystem.setBattleBgm(params[0]);
        return true;
    }

    // Change Victory ME
    command133(params) {
        $gameSystem.setVictoryMe(params[0]);
        return true;
    }

    // Change Save Access
    command134(params) {
        if (params[0] === 0) $gameSystem.disableSave();
        else $gameSystem.enableSave();
        return true;
    }

    // Change Menu Access
    command135(params) {
        if (params[0] === 0) $gameSystem.disableMenu();
        else $gameSystem.enableMenu();
        return true;
    }

    // Change Encounter
    command136(params) {
        if (params[0] === 0) $gameSystem.disableEncounter();
        else $gameSystem.enableEncounter();
        $gamePlayer.makeEncounterCount();
        return true;
    }

    // Change Formation Access
    command137(params) {
        if (params[0] === 0) $gameSystem.disableFormation();
        else $gameSystem.enableFormation();
        return true;
    }

    // Change Window Color
    command138(params) {
        $gameSystem.setWindowTone(params[0]);
        return true;
    }

    // Change Defeat ME
    command139(params) {
        $gameSystem.setDefeatMe(params[0]);
        return true;
    }

    // Change Vehicle BGM
    command140(params) {
        const vehicle = $gameMap.vehicle(params[0]);
        if (vehicle) vehicle.setBgm(params[1]);
        return true;
    }

    // Transfer Player
    command201(params) {
        if ($gameParty.inBattle() || $gameMessage.isBusy()) return false;
        let mapId, x, y;
        if (params[0] === 0) {
            mapId = params[1];
            x = params[2];
            y = params[3];
        } else {
            mapId = $gameVariables.value(params[1]);
            x = $gameVariables.value(params[2]);
            y = $gameVariables.value(params[3]);
        }
        $gamePlayer.reserveTransfer(mapId, x, y, params[4], params[5]);
        this.setWaitMode("transfer");
        return true;
    }

    // Set Vehicle Location
    command202(params) {
        let mapId, x, y;
        if (params[1] === 0) {
            mapId = params[2];
            x = params[3];
            y = params[4];
        } else {
            mapId = $gameVariables.value(params[2]);
            x = $gameVariables.value(params[3]);
            y = $gameVariables.value(params[4]);
        }
        const vehicle = $gameMap.vehicle(params[0]);
        if (vehicle) vehicle.setLocation(mapId, x, y);
        return true;
    }

    // Set Event Location
    command203(params) {
        const character = this.character(params[0]);
        if (character) {
            if (params[1] === 0) {
                character.locate(params[2], params[3]);
            } else if (params[1] === 1) {
                const x = $gameVariables.value(params[2]);
                const y = $gameVariables.value(params[3]);
                character.locate(x, y);
            } else {
                const character2 = this.character(params[2]);
                if (character2) character.swap(character2);
            }
            if (params[4] > 0) character.setDirection(params[4]);
        }
        return true;
    }

    // Scroll Map
    command204(params) {
        if (!$gameParty.inBattle()) {
            if ($gameMap.isScrolling()) {
                this.setWaitMode("scroll");
                return false;
            }
            $gameMap.startScroll(params[0], params[1], params[2]);
            if (params[3]) this.setWaitMode("scroll");
        }
        return true;
    }

    // Set Movement Route
    command205(params) {
        $gameMap.refreshIfNeeded();
        this._characterId = params[0];
        const character = this.character(this._characterId);
        if (character) {
            character.forceMoveRoute(params[1]);
            if (params[1].wait) this.setWaitMode("route");
        }
        return true;
    }

    // Get on/off Vehicle
    command206() {
        $gamePlayer.getOnOffVehicle();
        return true;
    }

    // Change Transparency
    command211(params) {
        $gamePlayer.setTransparent(params[0] === 0);
        return true;
    }

    // Show Animation
    command212(params) {
        this._characterId = params[0];
        const character = this.character(this._characterId);
        if (character) {
            $gameTemp.requestAnimation([character], params[1]);
            if (params[2]) this.setWaitMode("animation");
        }
        return true;
    }

    // Show Balloon Icon
    command213(params) {
        this._characterId = params[0];
        const character = this.character(this._characterId);
        if (character) {
            $gameTemp.requestBalloon(character, params[1]);
            if (params[2]) this.setWaitMode("balloon");
        }
        return true;
    }

    // Erase Event
    command214() {
        if (this.isOnCurrentMap() && this._eventId > 0) $gameMap.eraseEvent(this._eventId);
        return true;
    }

    // Change Player Followers
    command216(params) {
        if (params[0] === 0) $gamePlayer.showFollowers();
        else $gamePlayer.hideFollowers();
        $gamePlayer.refresh();
        return true;
    }

    // Gather Followers
    command217() {
        if (!$gameParty.inBattle()) {
            $gamePlayer.gatherFollowers();
            this.setWaitMode("gather");
        }
        return true;
    }

    // Fadeout Screen
    command221() {
        if ($gameMessage.isBusy()) return false;
        $gameScreen.startFadeOut(this.fadeSpeed());
        this.wait(this.fadeSpeed());
        return true;
    }

    // Fadein Screen
    command222() {
        if ($gameMessage.isBusy()) return false;
        $gameScreen.startFadeIn(this.fadeSpeed());
        this.wait(this.fadeSpeed());
        return true;
    }

    // Tint Screen
    command223(params) {
        $gameScreen.startTint(params[0], params[1]);
        if (params[2]) this.wait(params[1]);
        return true;
    }

    // Flash Screen
    command224(params) {
        $gameScreen.startFlash(params[0], params[1]);
        if (params[2]) this.wait(params[1]);
        return true;
    }

    // Shake Screen
    command225(params) {
        $gameScreen.startShake(params[0], params[1], params[2]);
        if (params[3]) this.wait(params[2]);
        return true;
    }

    // Wait
    command230(params) {
        this.wait(params[0]);
        return true;
    }

    // Show Picture
    command231(params) {
        const point = this.picturePoint(params);
        // prettier-ignore
        $gameScreen.showPicture(
            params[0], params[1], params[2], point.x, point.y,
            params[6], params[7], params[8], params[9]
        );
        return true;
    }

    // Move Picture
    command232(params) {
        const point = this.picturePoint(params);
        // prettier-ignore
        $gameScreen.movePicture(
            params[0], params[2], point.x, point.y, params[6], params[7],
            params[8], params[9], params[10], params[12] || 0
        );
        if (params[11]) this.wait(params[10]);
        return true;
    }

    picturePoint(params) {
        const point = new Point();
        if (params[3] === 0) {
            // Direct designation
            point.x = params[4];
            point.y = params[5];
        } else {
            // Designation with variables
            point.x = $gameVariables.value(params[4]);
            point.y = $gameVariables.value(params[5]);
        }
        return point;
    }

    // Rotate Picture
    command233(params) {
        $gameScreen.rotatePicture(params[0], params[1]);
        return true;
    }

    // Tint Picture
    command234(params) {
        $gameScreen.tintPicture(params[0], params[1], params[2]);
        if (params[3]) this.wait(params[2]);
        return true;
    }

    // Erase Picture
    command235(params) {
        $gameScreen.erasePicture(params[0]);
        return true;
    }

    // Set Weather Effect
    command236(params) {
        if (!$gameParty.inBattle()) {
            $gameScreen.changeWeather(params[0], params[1], params[2]);
            if (params[3]) this.wait(params[2]);
        }
        return true;
    }

    // Play BGM
    command241(params) {
        AudioManager.playBgm(params[0]);
        return true;
    }

    // Fadeout BGM
    command242(params) {
        AudioManager.fadeOutBgm(params[0]);
        return true;
    }

    // Save BGM
    command243() {
        $gameSystem.saveBgm();
        return true;
    }

    // Resume BGM
    command244() {
        $gameSystem.replayBgm();
        return true;
    }

    // Play BGS
    command245(params) {
        AudioManager.playBgs(params[0]);
        return true;
    }

    // Fadeout BGS
    command246(params) {
        AudioManager.fadeOutBgs(params[0]);
        return true;
    }

    // Play ME
    command249(params) {
        AudioManager.playMe(params[0]);
        return true;
    }

    // Play SE
    command250(params) {
        AudioManager.playSe(params[0]);
        return true;
    }

    // Stop SE
    command251() {
        AudioManager.stopSe();
        return true;
    }

    // Play Movie
    command261(params) {
        if ($gameMessage.isBusy()) return false;
        const name = params[0];
        if (name.length > 0) {
            const ext = this.videoFileExt();
            Video.play("movies/" + name + ext);
            this.setWaitMode("video");
        }
        return true;
    }

    videoFileExt() {
        return Utils.canPlayWebm() ? ".webm" : ".mp4";
    }

    // Change Map Name Display
    command281(params) {
        if (params[0] === 0) $gameMap.enableNameDisplay();
        else $gameMap.disableNameDisplay();
        return true;
    }

    // Change Tileset
    command282(params) {
        const tileset = $dataTilesets[params[0]];
        const allReady = tileset.tilesetNames
            .map(tilesetName => ImageManager.loadTileset(tilesetName))
            .every(bitmap => bitmap.isReady());
        if (allReady) {
            $gameMap.changeTileset(params[0]);
            return true;
        }
        return false;
    }

    // Change Battle Background
    command283(params) {
        $gameMap.changeBattleback(params[0], params[1]);
        return true;
    }

    // Change Parallax
    command284(params) {
        // prettier-ignore
        $gameMap.changeParallax(params[0], params[1], params[2], params[3], params[4]);
        return true;
    }

    // Get Location Info
    command285(params) {
        let x, y, value;
        if (params[2] === 0) {
            x = params[3];
            y = params[4];
        } else if (params[2] === 1) {
            x = $gameVariables.value(params[3]);
            y = $gameVariables.value(params[4]);
        } else {
            const character = this.character(params[3]);
            x = character.x;
            y = character.y;
        }
        switch (params[1]) {
            case 0: // Terrain Tag
                value = $gameMap.terrainTag(x, y);
                break;
            case 1: // Event ID
                value = $gameMap.eventIdXy(x, y);
                break;
            case 2: // Tile ID (Layer 1)
            case 3: // Tile ID (Layer 2)
            case 4: // Tile ID (Layer 3)
            case 5: // Tile ID (Layer 4)
                value = $gameMap.tileId(x, y, params[1] - 2);
                break;
            default: // Region ID
                value = $gameMap.regionId(x, y);
                break;
        }
        $gameVariables.setValue(params[0], value);
        return true;
    }

    // Battle Processing
    command301(params) {
        if (!$gameParty.inBattle()) {
            let troopId;
            if (params[0] === 0) troopId = params[1];
            else if (params[0] === 1) troopId = $gameVariables.value(params[1]);
            else troopId = $gamePlayer.makeEncounterTroopId();
            if ($dataTroops[troopId]) {
                BattleManager.setup(troopId, params[2], params[3]);
                BattleManager.setEventCallback(n => {
                    this._branch[this._indent] = n;
                });
                $gamePlayer.makeEncounterCount();
                SceneManager.push(Scene_Battle);
            }
        }
        return true;
    }

    // If Win
    command601() {
        if (this._branch[this._indent] !== 0) this.skipBranch();
        return true;
    }

    // If Escape
    command602() {
        if (this._branch[this._indent] !== 1) this.skipBranch();
        return true;
    }

    // If Lose
    command603() {
        if (this._branch[this._indent] !== 2) this.skipBranch();
        return true;
    }

    // Shop Processing
    command302(params) {
        if (!$gameParty.inBattle()) {
            const goods = [params];
            while (this.nextEventCode() === 605) {
                this._index++;
                goods.push(this.currentCommand().parameters);
            }
            SceneManager.push(Scene_Shop);
            SceneManager.prepareNextScene(goods, params[4]);
        }
        return true;
    }

    // Name Input Processing
    command303(params) {
        if (!$gameParty.inBattle()) {
            if ($dataActors[params[0]]) {
                SceneManager.push(Scene_Name);
                SceneManager.prepareNextScene(params[0], params[1]);
            }
        }
        return true;
    }

    // Change HP
    command311(params) {
        const value = this.operateValue(params[2], params[3], params[4]);
        this.iterateActorEx(params[0], params[1], actor => {
            this.changeHp(actor, value, params[5]);
        });
        return true;
    }

    // Change MP
    command312(params) {
        const value = this.operateValue(params[2], params[3], params[4]);
        this.iterateActorEx(params[0], params[1], actor => {
            actor.gainMp(value);
        });
        return true;
    }

    // Change TP
    command326(params) {
        const value = this.operateValue(params[2], params[3], params[4]);
        this.iterateActorEx(params[0], params[1], actor => {
            actor.gainTp(value);
        });
        return true;
    }

    // Change State
    command313(params) {
        this.iterateActorEx(params[0], params[1], actor => {
            const alreadyDead = actor.isDead();
            if (params[2] === 0) actor.addState(params[3]);
            else actor.removeState(params[3]);
            if (actor.isDead() && !alreadyDead) actor.performCollapse();
            actor.clearResult();
        });
        return true;
    }

    // Recover All
    command314(params) {
        this.iterateActorEx(params[0], params[1], actor => {
            actor.recoverAll();
        });
        return true;
    }

    // Change EXP
    command315(params) {
        const value = this.operateValue(params[2], params[3], params[4]);
        this.iterateActorEx(params[0], params[1], actor => {
            actor.changeExp(actor.currentExp() + value, params[5]);
        });
        return true;
    }

    // Change Level
    command316(params) {
        const value = this.operateValue(params[2], params[3], params[4]);
        this.iterateActorEx(params[0], params[1], actor => {
            actor.changeLevel(actor.level + value, params[5]);
        });
        return true;
    }

    // Change Parameter
    command317(params) {
        const value = this.operateValue(params[3], params[4], params[5]);
        this.iterateActorEx(params[0], params[1], actor => {
            actor.addParam(params[2], value);
        });
        return true;
    }

    // Change Skill
    command318(params) {
        this.iterateActorEx(params[0], params[1], actor => {
            if (params[2] === 0) actor.learnSkill(params[3]);
            else actor.forgetSkill(params[3]);
        });
        return true;
    }

    // Change Equipment
    command319(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) actor.changeEquipById(params[1], params[2]);
        return true;
    }

    // Change Name
    command320(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) actor.setName(params[1]);
        return true;
    }

    // Change Class
    command321(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor && $dataClasses[params[1]]) actor.changeClass(params[1], params[2]);
        return true;
    }

    // Change Actor Images
    command322(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) {
            actor.setCharacterImage(params[1], params[2]);
            actor.setFaceImage(params[3], params[4]);
            actor.setBattlerImage(params[5]);
        }
        $gamePlayer.refresh();
        return true;
    }

    // Change Vehicle Image
    command323(params) {
        const vehicle = $gameMap.vehicle(params[0]);
        if (vehicle) vehicle.setImage(params[1], params[2]);
        return true;
    }

    // Change Nickname
    command324(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) actor.setNickname(params[1]);
        return true;
    }

    // Change Profile
    command325(params) {
        const actor = $gameActors.actor(params[0]);
        if (actor) actor.setProfile(params[1]);
        return true;
    }

    // Change Enemy HP
    command331(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        this.iterateEnemyIndex(params[0], enemy => {
            this.changeHp(enemy, value, params[4]);
        });
        return true;
    }

    // Change Enemy MP
    command332(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        this.iterateEnemyIndex(params[0], enemy => {
            enemy.gainMp(value);
        });
        return true;
    }

    // Change Enemy TP
    command342(params) {
        const value = this.operateValue(params[1], params[2], params[3]);
        this.iterateEnemyIndex(params[0], enemy => {
            enemy.gainTp(value);
        });
        return true;
    }

    // Change Enemy State
    command333(params) {
        this.iterateEnemyIndex(params[0], enemy => {
            const alreadyDead = enemy.isDead();
            if (params[1] === 0) enemy.addState(params[2]);
            else enemy.removeState(params[2]);
            if (enemy.isDead() && !alreadyDead) enemy.performCollapse();
            enemy.clearResult();
        });
        return true;
    }

    // Enemy Recover All
    command334(params) {
        this.iterateEnemyIndex(params[0], enemy => {
            enemy.recoverAll();
        });
        return true;
    }

    // Enemy Appear
    command335(params) {
        this.iterateEnemyIndex(params[0], enemy => {
            enemy.appear();
            $gameTroop.makeUniqueNames();
        });
        return true;
    }

    // Enemy Transform
    command336(params) {
        this.iterateEnemyIndex(params[0], enemy => {
            enemy.transform(params[1]);
            $gameTroop.makeUniqueNames();
        });
        return true;
    }

    // Show Battle Animation
    command337(params) {
        let param = params[0];
        if (params[2]) param = -1;
        const targets = [];
        this.iterateEnemyIndex(param, enemy => {
            if (enemy.isAlive()) targets.push(enemy);
        });
        $gameTemp.requestAnimation(targets, params[1]);
        return true;
    }

    // Force Action
    command339(params) {
        this.iterateBattler(params[0], params[1], battler => {
            if (!battler.isDeathStateAffected()) {
                battler.forceAction(params[2], params[3]);
                BattleManager.forceAction(battler);
                this.setWaitMode("action");
            }
        });
        return true;
    }

    // Abort Battle
    command340() {
        BattleManager.abort();
        return true;
    }

    // Open Menu Screen
    command351() {
        if (!$gameParty.inBattle()) {
            SceneManager.push(Scene_Menu);
            Window_MenuCommand.initCommandPosition();
        }
        return true;
    }

    // Open Save Screen
    command352() {
        if (!$gameParty.inBattle()) SceneManager.push(Scene_Save);
        return true;
    }

    // Game Over
    command353() {
        SceneManager.goto(Scene_Gameover);
        return true;
    }

    // Return to Title Screen
    command354() {
        SceneManager.goto(Scene_Title);
        return true;
    }

    // Script
    command355() {
        let script = this.currentCommand().parameters[0] + "\n";
        while (this.nextEventCode() === 655) {
            this._index++;
            script += this.currentCommand().parameters[0] + "\n";
        }
        eval(script);
        return true;
    }

    // Plugin Command (MV style, kept for MV plugin compatibility)
    command356(params) {
        const args = params[0].split(" ");
        const command = args.shift();
        this.pluginCommand(command, args);
        return true;
    }

    pluginCommand(/* command, args */) {
        // Overridden by MV-style plugins.
    }

    // Plugin Command (MZ style)
    command357(params) {
        const pluginName = Utils.extractFileName(params[0]);
        PluginManager.callCommand(this, pluginName, params[1], params[3]);
        return true;
    }
};
