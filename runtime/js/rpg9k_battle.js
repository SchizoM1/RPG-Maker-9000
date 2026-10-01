//=============================================================================
// rpg9k_battle.js — BattleManager (turn-based and time progress battles)
//=============================================================================
"use strict";

var BattleManager = {
    setup(troopId, canEscape, canLose) {
        this.initMembers();
        this._canEscape = canEscape;
        this._canLose = canLose;
        $gameTroop.setup(troopId);
        $gameScreen.onBattleStart();
        this.makeEscapeRatio();
    },

    initMembers() {
        this._phase = "";
        this._inputting = false;
        this._canEscape = false;
        this._canLose = false;
        this._battleTest = false;
        this._eventCallback = null;
        this._preemptive = false;
        this._surprise = false;
        this._currentActor = null;
        this._actionForcedBattler = null;
        this._mapBgm = null;
        this._mapBgs = null;
        this._actionBattlers = [];
        this._subject = null;
        this._action = null;
        this._targets = [];
        this._logWindow = null;
        this._spriteset = null;
        this._escapeRatio = 0;
        this._escaped = false;
        this._rewards = {};
        this._tpbNeedsPartyCommand = true;
    },

    isTpb() {
        return $dataSystem.battleSystem >= 1;
    },

    isActiveTpb() {
        return $dataSystem.battleSystem === 1;
    },

    isBattleTest() {
        return this._battleTest;
    },

    setBattleTest(battleTest) {
        this._battleTest = battleTest;
    },

    setEventCallback(callback) {
        this._eventCallback = callback;
    },

    setLogWindow(logWindow) {
        this._logWindow = logWindow;
    },

    setSpriteset(spriteset) {
        this._spriteset = spriteset;
    },

    onEncounter() {
        this._preemptive = Math.random() < this.ratePreemptive();
        this._surprise = Math.random() < this.rateSurprise() && !this._preemptive;
    },

    ratePreemptive() {
        return $gameParty.ratePreemptive($gameTroop.agility());
    },

    rateSurprise() {
        return $gameParty.rateSurprise($gameTroop.agility());
    },

    saveBgmAndBgs() {
        this._mapBgm = AudioManager.saveBgm();
        this._mapBgs = AudioManager.saveBgs();
    },

    playBattleBgm() {
        AudioManager.playBgm($gameSystem.battleBgm());
        AudioManager.stopBgs();
    },

    playVictoryMe() {
        AudioManager.playMe($gameSystem.victoryMe());
    },

    playDefeatMe() {
        AudioManager.playMe($gameSystem.defeatMe());
    },

    replayBgmAndBgs() {
        if (this._mapBgm) AudioManager.replayBgm(this._mapBgm);
        else AudioManager.stopBgm();
        if (this._mapBgs) AudioManager.replayBgs(this._mapBgs);
    },

    makeEscapeRatio() {
        this._escapeRatio = (0.5 * $gameParty.agility()) / $gameTroop.agility();
    },

    update(timeActive) {
        if (!this.isBusy() && !this.updateEvent()) this.updatePhase(timeActive);
        if (this.isTpb()) this.updateTpbInput();
    },

    updatePhase(timeActive) {
        switch (this._phase) {
            case "start":
                this.updateStart();
                break;
            case "turn":
                this.updateTurn(timeActive);
                break;
            case "action":
                this.updateAction();
                break;
            case "turnEnd":
                this.updateTurnEnd();
                break;
            case "battleEnd":
                this.updateBattleEnd();
                break;
        }
    },

    updateEvent() {
        switch (this._phase) {
            case "start":
            case "turn":
            case "turnEnd":
                if (this.isActionForced()) {
                    this.processForcedAction();
                    return true;
                }
                return this.updateEventMain();
        }
        return this.checkAbort();
    },

    updateEventMain() {
        $gameTroop.updateInterpreter();
        $gameParty.requestMotionRefresh();
        if ($gameTroop.isEventRunning() || this.checkBattleEnd()) return true;
        $gameTroop.setupBattleEvent();
        if ($gameTroop.isEventRunning() || SceneManager.isSceneChanging()) return true;
        return false;
    },

    isBusy() {
        return (
            $gameMessage.isBusy() ||
            (this._spriteset && this._spriteset.isBusy()) ||
            (this._logWindow && this._logWindow.isBusy())
        );
    },

    updateTpbInput() {
        if (this._inputting) this.checkTpbInputClose();
        else this.checkTpbInputOpen();
    },

    checkTpbInputClose() {
        if (!this.isPartyTpbInputtable() || this.needsActorInputCancel()) {
            this.cancelActorInput();
            this._currentActor = null;
            this._inputting = false;
        }
    },

    checkTpbInputOpen() {
        if (this.isPartyTpbInputtable()) {
            if (this._tpbNeedsPartyCommand) {
                this._inputting = true;
                this._tpbNeedsPartyCommand = false;
            } else {
                this.selectNextCommand();
            }
        }
    },

    isPartyTpbInputtable() {
        return $gameParty.canInput() && this.isTpbMainPhase();
    },

    needsActorInputCancel() {
        return this._currentActor && !this._currentActor.canInput();
    },

    isTpbMainPhase() {
        return ["turn", "turnEnd", "action"].includes(this._phase);
    },

    isInputting() {
        return this._inputting;
    },

    isInTurn() {
        return this._phase === "turn";
    },

    isTurnEnd() {
        return this._phase === "turnEnd";
    },

    isAborting() {
        return this._phase === "aborting";
    },

    isBattleEnd() {
        return this._phase === "battleEnd";
    },

    canEscape() {
        return this._canEscape;
    },

    canLose() {
        return this._canLose;
    },

    isEscaped() {
        return this._escaped;
    },

    actor() {
        return this._currentActor;
    },

    startBattle() {
        this._phase = "start";
        $gameSystem.onBattleStart();
        $gameParty.onBattleStart(this._preemptive);
        $gameTroop.onBattleStart(this._surprise);
        this.displayStartMessages();
    },

    displayStartMessages() {
        for (const name of $gameTroop.enemyNames()) $gameMessage.add(TextManager.emerge.format(name));
        if (this._preemptive) $gameMessage.add(TextManager.preemptive.format($gameParty.name()));
        else if (this._surprise) $gameMessage.add(TextManager.surprise.format($gameParty.name()));
    },

    startInput() {
        this._phase = "input";
        this._inputting = true;
        $gameParty.makeActions();
        $gameTroop.makeActions();
        this._currentActor = null;
        if (this._surprise || !$gameParty.canInput()) this.startTurn();
    },

    inputtingAction() {
        return this._currentActor ? this._currentActor.inputtingAction() : null;
    },

    selectNextCommand() {
        if (this._currentActor) {
            if (this._currentActor.selectNextCommand()) return;
            this.finishActorInput();
        }
        this.selectNextActor();
    },

    selectNextActor() {
        this.changeCurrentActor(true);
        if (!this._currentActor) {
            if (this.isTpb()) this.changeCurrentActor(true);
            else this.startTurn();
        }
    },

    selectPreviousCommand() {
        if (this._currentActor) {
            if (this._currentActor.selectPreviousCommand()) return;
            this.cancelActorInput();
        }
        this.selectPreviousActor();
    },

    selectPreviousActor() {
        if (this.isTpb()) {
            this.changeCurrentActor(true);
            if (!this._currentActor) this._inputting = $gameParty.canInput();
        } else {
            this.changeCurrentActor(false);
        }
    },

    changeCurrentActor(forward) {
        const members = $gameParty.battleMembers();
        let actor = this._currentActor;
        for (;;) {
            const currentIndex = members.indexOf(actor);
            actor = members[currentIndex + (forward ? 1 : -1)];
            if (!actor || actor.canInput()) break;
        }
        this._currentActor = actor ? actor : null;
        this.startActorInput();
    },

    startActorInput() {
        if (this._currentActor) {
            this._currentActor.setActionState("inputting");
            this._inputting = true;
        }
    },

    finishActorInput() {
        if (this._currentActor) {
            if (this.isTpb()) this._currentActor.startTpbCasting();
            this._currentActor.setActionState("waiting");
        }
    },

    cancelActorInput() {
        if (this._currentActor) this._currentActor.setActionState("undecided");
    },

    updateStart() {
        if (this.isTpb()) this._phase = "turn";
        else this.startInput();
    },

    startTurn() {
        this._phase = "turn";
        $gameTroop.increaseTurn();
        $gameParty.requestMotionRefresh();
        if (!this.isTpb()) {
            this.makeActionOrders();
            this._logWindow.startTurn();
            this._inputting = false;
        }
    },

    updateTurn(timeActive) {
        $gameParty.requestMotionRefresh();
        if (this.isTpb() && timeActive) this.updateTpb();
        if (!this._subject) this._subject = this.getNextSubject();
        if (this._subject) this.processTurn();
        else if (!this.isTpb()) this.endTurn();
    },

    updateTpb() {
        $gameParty.updateTpb();
        $gameTroop.updateTpb();
        this.updateAllTpbBattlers();
        this.checkTpbTurnEnd();
    },

    updateAllTpbBattlers() {
        for (const battler of this.allBattleMembers()) this.updateTpbBattler(battler);
    },

    updateTpbBattler(battler) {
        if (battler.isTpbTurnEnd()) {
            battler.onTurnEnd();
            battler.startTpbTurn();
            this.displayBattlerStatus(battler, false);
        } else if (battler.isTpbReady()) {
            battler.startTpbAction();
            this._actionBattlers.push(battler);
        } else if (battler.isTpbTimeout()) {
            battler.onTpbTimeout();
            this.displayBattlerStatus(battler, true);
        }
    },

    checkTpbTurnEnd() {
        if ($gameTroop.isTpbTurnEnd()) this.endTurn();
    },

    processTurn() {
        const subject = this._subject;
        const action = subject.currentAction();
        if (action) {
            action.prepare();
            if (action.isValid()) this.startAction();
            subject.removeCurrentAction();
        } else {
            this.endAction();
            this._subject = null;
        }
    },

    endBattlerActions(battler) {
        battler.setActionState(this.isTpb() ? "undecided" : "done");
        battler.onAllActionsEnd();
        battler.clearTpbChargeTime();
        this.displayBattlerStatus(battler, true);
    },

    endTurn() {
        this._phase = "turnEnd";
        this._preemptive = false;
        this._surprise = false;
    },

    updateTurnEnd() {
        if (this.isTpb()) {
            this.startTurn();
        } else {
            this.endAllBattlersTurn();
            this._phase = "start";
        }
    },

    endAllBattlersTurn() {
        for (const battler of this.allBattleMembers()) this.endBattlerTurn(battler);
    },

    endBattlerTurn(battler) {
        battler.onTurnEnd();
        this.displayBattlerStatus(battler, false);
    },

    displayBattlerStatus(battler, current) {
        this._logWindow.displayAutoAffectedStatus(battler);
        if (current) this._logWindow.displayCurrentState(battler);
        this._logWindow.displayRegeneration(battler);
    },

    getNextSubject() {
        for (;;) {
            const battler = this._actionBattlers.shift();
            if (!battler) return null;
            if (battler.isBattleMember() && battler.isAlive()) return battler;
        }
    },

    allBattleMembers() {
        return $gameParty.battleMembers().concat($gameTroop.members());
    },

    makeActionOrders() {
        const battlers = [];
        if (!this._surprise) battlers.push(...$gameParty.battleMembers());
        if (!this._preemptive) battlers.push(...$gameTroop.members());
        for (const battler of battlers) battler.makeSpeed();
        battlers.sort((a, b) => b.speed() - a.speed());
        this._actionBattlers = battlers;
    },

    startAction() {
        const subject = this._subject;
        const action = subject.currentAction();
        const targets = action.makeTargets();
        this._phase = "action";
        this._action = action;
        this._targets = targets;
        subject.cancelMotionRefresh();
        subject.useItem(action.item());
        this._action.applyGlobal();
        this._logWindow.startAction(subject, action, targets);
    },

    updateAction() {
        const target = this._targets.shift();
        if (target) this.invokeAction(this._subject, target);
        else this.endAction();
    },

    endAction() {
        this._logWindow.endAction(this._subject);
        this._phase = "turn";
        if (this._subject.numActions() === 0) {
            this.endBattlerActions(this._subject);
            this._subject = null;
        }
    },

    invokeAction(subject, target) {
        this._logWindow.push("pushBaseLine");
        if (Math.random() < this._action.itemCnt(target)) this.invokeCounterAttack(subject, target);
        else if (Math.random() < this._action.itemMrf(target)) this.invokeMagicReflection(subject, target);
        else this.invokeNormalAction(subject, target);
        subject.setLastTarget(target);
        this._logWindow.push("popBaseLine");
    },

    invokeNormalAction(subject, target) {
        const realTarget = this.applySubstitute(target);
        this._action.apply(realTarget);
        this._logWindow.displayActionResults(subject, realTarget);
    },

    invokeCounterAttack(subject, target) {
        const action = new Game_Action(target);
        action.setAttack();
        action.apply(subject);
        this._logWindow.displayCounter(target);
        this._logWindow.displayActionResults(target, subject);
    },

    invokeMagicReflection(subject, target) {
        this._action._reflectionTarget = target;
        this._logWindow.displayReflection(target);
        this._action.apply(subject);
        this._logWindow.displayActionResults(target, subject);
    },

    applySubstitute(target) {
        if (this.checkSubstitute(target)) {
            const substitute = target.friendsUnit().substituteBattler();
            if (substitute && target !== substitute) {
                this._logWindow.displaySubstitute(substitute, target);
                return substitute;
            }
        }
        return target;
    },

    checkSubstitute(target) {
        return target.isDying() && !this._action.isCertainHit();
    },

    isActionForced() {
        return !!this._actionForcedBattler;
    },

    forceAction(battler) {
        if (battler.numActions() > 0) {
            this._actionForcedBattler = battler;
            this._actionBattlers.remove(battler);
        }
    },

    processForcedAction() {
        if (this._actionForcedBattler) {
            if (this._subject) this.endBattlerActions(this._subject);
            this._subject = this._actionForcedBattler;
            this._actionForcedBattler = null;
            this.startAction();
            this._subject.removeCurrentAction();
        }
    },

    abort() {
        this._phase = "aborting";
    },

    checkBattleEnd() {
        if (this._phase) {
            if ($gameParty.isEscaped()) {
                this.processPartyEscape();
                return true;
            } else if ($gameParty.isAllDead()) {
                this.processDefeat();
                return true;
            } else if ($gameTroop.isAllDead()) {
                this.processVictory();
                return true;
            }
        }
        return false;
    },

    checkAbort() {
        if (this.isAborting()) {
            this.processAbort();
            return true;
        }
        return false;
    },

    processVictory() {
        $gameParty.removeBattleStates();
        $gameParty.performVictory();
        this.playVictoryMe();
        this.replayBgmAndBgs();
        this.makeRewards();
        this.displayVictoryMessage();
        this.displayRewards();
        this.gainRewards();
        this.endBattle(0);
    },

    processEscape() {
        $gameParty.performEscape();
        SoundManager.playEscape();
        const success = this._preemptive || Math.random() < this._escapeRatio;
        if (success) this.onEscapeSuccess();
        else this.onEscapeFailure();
        return success;
    },

    onEscapeSuccess() {
        this.displayEscapeSuccessMessage();
        this._escaped = true;
        this.processAbort();
    },

    onEscapeFailure() {
        $gameParty.onEscapeFailure();
        this.displayEscapeFailureMessage();
        this._escapeRatio += 0.1;
        if (!this.isTpb()) this.startTurn();
    },

    processPartyEscape() {
        this._escaped = true;
        this.processAbort();
    },

    processAbort() {
        $gameParty.removeBattleStates();
        this._logWindow.clear();
        this.replayBgmAndBgs();
        this.endBattle(1);
    },

    processDefeat() {
        this.displayDefeatMessage();
        this.playDefeatMe();
        if (this._canLose) this.replayBgmAndBgs();
        else AudioManager.stopBgm();
        this.endBattle(2);
    },

    endBattle(result) {
        this._phase = "battleEnd";
        this.cancelActorInput();
        this._inputting = false;
        if (this._eventCallback) this._eventCallback(result);
        if (result === 0) $gameSystem.onBattleWin();
        else if (this._escaped) $gameSystem.onBattleEscape();
        $gameTemp.clearCommonEventReservation();
    },

    updateBattleEnd() {
        if (this.isBattleTest()) {
            AudioManager.stopBgm();
            SceneManager.exit();
        } else if (!this._escaped && $gameParty.isAllDead()) {
            if (this._canLose) {
                $gameParty.reviveBattleMembers();
                SceneManager.pop();
            } else {
                SceneManager.goto(Scene_Gameover);
            }
        } else {
            SceneManager.pop();
        }
        this._phase = "";
    },

    makeRewards() {
        this._rewards = {
            gold: $gameTroop.goldTotal(),
            exp: $gameTroop.expTotal(),
            items: $gameTroop.makeDropItems()
        };
    },

    displayVictoryMessage() {
        $gameMessage.add(TextManager.victory.format($gameParty.name()));
    },

    displayDefeatMessage() {
        $gameMessage.add(TextManager.defeat.format($gameParty.name()));
    },

    displayEscapeSuccessMessage() {
        $gameMessage.add(TextManager.escapeStart.format($gameParty.name()));
    },

    displayEscapeFailureMessage() {
        $gameMessage.add(TextManager.escapeStart.format($gameParty.name()));
        $gameMessage.add("\\." + TextManager.escapeFailure);
    },

    displayRewards() {
        this.displayExp();
        this.displayGold();
        this.displayDropItems();
    },

    displayExp() {
        const exp = this._rewards.exp;
        if (exp > 0) {
            const text = TextManager.obtainExp.format(exp, TextManager.exp);
            $gameMessage.add("\\." + text);
        }
    },

    displayGold() {
        const gold = this._rewards.gold;
        if (gold > 0) $gameMessage.add("\\." + TextManager.obtainGold.format(gold));
    },

    displayDropItems() {
        const items = this._rewards.items;
        if (items.length > 0) {
            $gameMessage.newPage();
            for (const item of items) $gameMessage.add(TextManager.obtainItem.format(item.name));
        }
    },

    gainRewards() {
        this.gainExp();
        this.gainGold();
        this.gainDropItems();
    },

    gainExp() {
        const exp = this._rewards.exp;
        for (const actor of $gameParty.allMembers()) actor.gainExp(exp);
    },

    gainGold() {
        $gameParty.gainGold(this._rewards.gold);
    },

    gainDropItems() {
        const items = this._rewards.items;
        for (const item of items) $gameParty.gainItem(item, 1);
    }
};
