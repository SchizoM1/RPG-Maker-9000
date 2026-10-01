//=============================================================================
// rpg9k_battlers.js — Game_Item, Game_Action, Game_ActionResult,
// Game_BattlerBase, Game_Battler, Game_Actor, Game_Enemy, Game_Actors,
// Game_Unit, Game_Party, Game_Troop
//=============================================================================
"use strict";

//-----------------------------------------------------------------------------
// Game_Item — a serializable reference to a database object

var Game_Item = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize(item) {
        this._dataClass = "";
        this._itemId = 0;
        if (item) this.setObject(item);
    }
    isSkill() {
        return this._dataClass === "skill";
    }
    isItem() {
        return this._dataClass === "item";
    }
    isUsableItem() {
        return this.isSkill() || this.isItem();
    }
    isWeapon() {
        return this._dataClass === "weapon";
    }
    isArmor() {
        return this._dataClass === "armor";
    }
    isEquipItem() {
        return this.isWeapon() || this.isArmor();
    }
    isNull() {
        return this._dataClass === "";
    }
    itemId() {
        return this._itemId;
    }
    object() {
        if (this.isSkill()) return $dataSkills[this._itemId];
        if (this.isItem()) return $dataItems[this._itemId];
        if (this.isWeapon()) return $dataWeapons[this._itemId];
        if (this.isArmor()) return $dataArmors[this._itemId];
        return null;
    }
    setObject(item) {
        if (DataManager.isSkill(item)) this._dataClass = "skill";
        else if (DataManager.isItem(item)) this._dataClass = "item";
        else if (DataManager.isWeapon(item)) this._dataClass = "weapon";
        else if (DataManager.isArmor(item)) this._dataClass = "armor";
        else this._dataClass = "";
        this._itemId = item ? item.id : 0;
    }
    setEquip(isWeapon, itemId) {
        this._dataClass = isWeapon ? "weapon" : "armor";
        this._itemId = itemId;
    }
};

//-----------------------------------------------------------------------------
// Game_Action

var Game_Action = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize(subject, forcing) {
        this._subjectActorId = 0;
        this._subjectEnemyIndex = -1;
        this._forcing = forcing || false;
        this.setSubject(subject);
        this.clear();
    }

    clear() {
        this._item = new Game_Item();
        this._targetIndex = -1;
    }

    setSubject(subject) {
        if (subject.isActor()) {
            this._subjectActorId = subject.actorId();
            this._subjectEnemyIndex = -1;
        } else {
            this._subjectEnemyIndex = subject.index();
            this._subjectActorId = 0;
        }
    }

    subject() {
        if (this._subjectActorId > 0) return $gameActors.actor(this._subjectActorId);
        return $gameTroop.members()[this._subjectEnemyIndex];
    }

    friendsUnit() {
        return this.subject().friendsUnit();
    }

    opponentsUnit() {
        return this.subject().opponentsUnit();
    }

    setEnemyAction(action) {
        if (action) this.setSkill(action.skillId);
        else this.clear();
    }

    setAttack() {
        this.setSkill(this.subject().attackSkillId());
    }

    setGuard() {
        this.setSkill(this.subject().guardSkillId());
    }

    setSkill(skillId) {
        this._item.setObject($dataSkills[skillId]);
    }

    setItem(itemId) {
        this._item.setObject($dataItems[itemId]);
    }

    setItemObject(object) {
        this._item.setObject(object);
    }

    setTarget(targetIndex) {
        this._targetIndex = targetIndex;
    }

    item() {
        return this._item.object();
    }

    isSkill() {
        return this._item.isSkill();
    }

    isItem() {
        return this._item.isItem();
    }

    numRepeats() {
        let repeats = this.item().repeats;
        if (this.isAttack()) repeats += this.subject().attackTimesAdd();
        return Math.floor(repeats);
    }

    checkItemScope(list) {
        return list.includes(this.item().scope);
    }

    isForOpponent() {
        return this.checkItemScope([1, 2, 3, 4, 5, 6, 14]);
    }
    isForFriend() {
        return this.checkItemScope([7, 8, 9, 10, 11, 12, 13, 14]);
    }
    isForEveryone() {
        return this.checkItemScope([14]);
    }
    isForAliveFriend() {
        return this.checkItemScope([7, 8, 11, 14]);
    }
    isForDeadFriend() {
        return this.checkItemScope([9, 10]);
    }
    isForUser() {
        return this.checkItemScope([11]);
    }
    isForOne() {
        return this.checkItemScope([1, 3, 7, 9, 11, 12]);
    }
    isForRandom() {
        return this.checkItemScope([3, 4, 5, 6]);
    }
    isForAll() {
        return this.checkItemScope([2, 8, 10, 13, 14]);
    }
    needsSelection() {
        return this.checkItemScope([1, 7, 9, 12]);
    }
    numTargets() {
        return this.isForRandom() ? this.item().scope - 2 : 0;
    }

    checkDamageType(list) {
        return list.includes(this.item().damage.type);
    }
    isHpEffect() {
        return this.checkDamageType([1, 3, 5]);
    }
    isMpEffect() {
        return this.checkDamageType([2, 4, 6]);
    }
    isDamage() {
        return this.checkDamageType([1, 2]);
    }
    isRecover() {
        return this.checkDamageType([3, 4]);
    }
    isDrain() {
        return this.checkDamageType([5, 6]);
    }
    isHpRecover() {
        return this.checkDamageType([3]);
    }
    isMpRecover() {
        return this.checkDamageType([4]);
    }
    isCertainHit() {
        return this.item().hitType === Game_Action.HITTYPE_CERTAIN;
    }
    isPhysical() {
        return this.item().hitType === Game_Action.HITTYPE_PHYSICAL;
    }
    isMagical() {
        return this.item().hitType === Game_Action.HITTYPE_MAGICAL;
    }
    isAttack() {
        return this.item() === $dataSkills[this.subject().attackSkillId()];
    }
    isGuard() {
        return this.item() === $dataSkills[this.subject().guardSkillId()];
    }
    isMagicSkill() {
        if (this.isSkill()) return $dataSystem.magicSkills.includes(this.item().stypeId);
        return false;
    }

    decideRandomTarget() {
        let target;
        if (this.isForDeadFriend()) target = this.friendsUnit().randomDeadTarget();
        else if (this.isForFriend()) target = this.friendsUnit().randomTarget();
        else target = this.opponentsUnit().randomTarget();
        if (target) this._targetIndex = target.index();
        else this.clear();
    }

    setConfusion() {
        this.setAttack();
    }

    prepare() {
        if (this.subject().isConfused() && !this._forcing) this.setConfusion();
    }

    isValid() {
        return (this._forcing && this.item()) || this.subject().canUse(this.item());
    }

    speed() {
        const agi = this.subject().agi;
        let speed = agi + Math.randomInt(Math.floor(5 + agi / 4));
        if (this.item()) speed += this.item().speed;
        if (this.isAttack()) speed += this.subject().attackSpeed();
        return speed;
    }

    makeTargets() {
        const targets = [];
        if (!this._forcing && this.subject().isConfused()) {
            targets.push(this.confusionTarget());
        } else if (this.isForEveryone()) {
            targets.push(...this.targetsForEveryone());
        } else if (this.isForOpponent()) {
            targets.push(...this.targetsForOpponents());
        } else if (this.isForFriend()) {
            targets.push(...this.targetsForFriends());
        }
        return this.repeatTargets(targets);
    }

    repeatTargets(targets) {
        const repeatedTargets = [];
        const repeats = this.numRepeats();
        for (const target of targets) {
            if (target) {
                for (let i = 0; i < repeats; i++) repeatedTargets.push(target);
            }
        }
        return repeatedTargets;
    }

    confusionTarget() {
        switch (this.subject().confusionLevel()) {
            case 1:
                return this.opponentsUnit().randomTarget();
            case 2:
                if (Math.randomInt(2) === 0) return this.opponentsUnit().randomTarget();
                return this.friendsUnit().randomTarget();
            default:
                return this.friendsUnit().randomTarget();
        }
    }

    targetsForEveryone() {
        const opponentMembers = this.opponentsUnit().aliveMembers();
        const friendMembers = this.friendsUnit().aliveMembers();
        return opponentMembers.concat(friendMembers);
    }

    targetsForOpponents() {
        const unit = this.opponentsUnit();
        if (this.isForRandom()) return this.randomTargets(unit);
        return this.targetsForAlive(unit);
    }

    targetsForFriends() {
        const unit = this.friendsUnit();
        if (this.isForUser()) return [this.subject()];
        if (this.isForDeadFriend()) return this.targetsForDead(unit);
        if (this.isForAliveFriend()) return this.targetsForAlive(unit);
        return this.targetsForDeadAndAlive(unit);
    }

    randomTargets(unit) {
        const targets = [];
        for (let i = 0; i < this.numTargets(); i++) targets.push(unit.randomTarget());
        return targets;
    }

    targetsForDead(unit) {
        if (this.isForOne()) return [unit.smoothDeadTarget(this._targetIndex)];
        return unit.deadMembers();
    }

    targetsForAlive(unit) {
        if (this.isForOne()) {
            if (this._targetIndex < 0) return [unit.randomTarget()];
            return [unit.smoothTarget(this._targetIndex)];
        }
        return unit.aliveMembers();
    }

    targetsForDeadAndAlive(unit) {
        if (this.isForOne()) return [unit.members()[this._targetIndex]];
        return unit.members();
    }

    evaluate() {
        let value = 0;
        for (const target of this.itemTargetCandidates()) {
            const targetValue = this.evaluateWithTarget(target);
            if (this.isForAll()) {
                value += targetValue;
            } else if (targetValue > value) {
                value = targetValue;
                this._targetIndex = target.index();
            }
        }
        value *= this.numRepeats();
        if (value > 0) value += Math.random();
        return value;
    }

    itemTargetCandidates() {
        if (!this.isValid()) return [];
        if (this.isForOpponent()) return this.opponentsUnit().aliveMembers();
        if (this.isForUser()) return [this.subject()];
        if (this.isForDeadFriend()) return this.friendsUnit().deadMembers();
        return this.friendsUnit().aliveMembers();
    }

    evaluateWithTarget(target) {
        if (this.isHpEffect()) {
            const value = this.makeDamageValue(target, false);
            if (this.isForOpponent()) return value / Math.max(target.hp, 1);
            const recovery = Math.min(-value, target.mhp - target.hp);
            return recovery / target.mhp;
        }
        return 0;
    }

    testApply(target) {
        return (
            this.testLifeAndDeath(target) &&
            ($gameParty.inBattle() ||
                (this.isHpRecover() && target.hp < target.mhp) ||
                (this.isMpRecover() && target.mp < target.mmp) ||
                this.hasItemAnyValidEffects(target))
        );
    }

    testLifeAndDeath(target) {
        if (this.isForOpponent() || this.isForAliveFriend()) return target.isAlive();
        if (this.isForDeadFriend()) return target.isDead();
        return true;
    }

    hasItemAnyValidEffects(target) {
        return this.item().effects.some(effect => this.testItemEffect(target, effect));
    }

    testItemEffect(target, effect) {
        switch (effect.code) {
            case Game_Action.EFFECT_RECOVER_HP:
                return target.hp < target.mhp || effect.value1 < 0 || effect.value2 < 0;
            case Game_Action.EFFECT_RECOVER_MP:
                return target.mp < target.mmp || effect.value1 < 0 || effect.value2 < 0;
            case Game_Action.EFFECT_ADD_STATE:
                return !target.isStateAffected(effect.dataId);
            case Game_Action.EFFECT_REMOVE_STATE:
                return target.isStateAffected(effect.dataId);
            case Game_Action.EFFECT_ADD_BUFF:
                return !target.isMaxBuffAffected(effect.dataId);
            case Game_Action.EFFECT_ADD_DEBUFF:
                return !target.isMaxDebuffAffected(effect.dataId);
            case Game_Action.EFFECT_REMOVE_BUFF:
                return target.isBuffAffected(effect.dataId);
            case Game_Action.EFFECT_REMOVE_DEBUFF:
                return target.isDebuffAffected(effect.dataId);
            case Game_Action.EFFECT_LEARN_SKILL:
                return target.isActor() && !target.isLearnedSkill(effect.dataId);
            default:
                return true;
        }
    }

    itemCnt(target) {
        if (this.isPhysical() && target.canMove()) return target.cnt;
        return 0;
    }

    itemMrf(target) {
        if (this.isMagical()) return target.mrf;
        return 0;
    }

    itemHit(/* target */) {
        const successRate = this.item().successRate;
        if (this.isPhysical()) return successRate * 0.01 * this.subject().hit;
        return successRate * 0.01;
    }

    itemEva(target) {
        if (this.isPhysical()) return target.eva;
        if (this.isMagical()) return target.mev;
        return 0;
    }

    itemCri(target) {
        return this.item().damage.critical ? this.subject().cri * (1 - target.cev) : 0;
    }

    apply(target) {
        const result = target.result();
        this.subject().clearResult();
        result.clear();
        result.used = this.testApply(target);
        result.missed = result.used && Math.random() >= this.itemHit(target);
        result.evaded = !result.missed && Math.random() < this.itemEva(target);
        result.physical = this.isPhysical();
        result.drain = this.isDrain();
        if (result.isHit()) {
            if (this.item().damage.type > 0) {
                result.critical = Math.random() < this.itemCri(target);
                const value = this.makeDamageValue(target, result.critical);
                this.executeDamage(target, value);
            }
            for (const effect of this.item().effects) this.applyItemEffect(target, effect);
            this.applyItemUserEffect(target);
        }
        this.updateLastTarget(target);
    }

    makeDamageValue(target, critical) {
        const item = this.item();
        const baseValue = this.evalDamageFormula(target);
        let value = baseValue * this.calcElementRate(target);
        if (this.isPhysical()) value *= target.pdr;
        if (this.isMagical()) value *= target.mdr;
        if (baseValue < 0) value *= target.rec;
        if (critical) value = this.applyCritical(value);
        value = this.applyVariance(value, item.damage.variance);
        value = this.applyGuard(value, target);
        value = Math.round(value);
        return value;
    }

    evalDamageFormula(target) {
        try {
            const item = this.item();
            const a = this.subject(); // eslint-disable-line no-unused-vars
            const b = target; // eslint-disable-line no-unused-vars
            const v = $gameVariables._data; // eslint-disable-line no-unused-vars
            const sign = [3, 4].includes(item.damage.type) ? -1 : 1;
            const value = Math.max(eval(item.damage.formula), 0) * sign;
            return isNaN(value) ? 0 : value;
        } catch (e) {
            return 0;
        }
    }

    calcElementRate(target) {
        if (this.item().damage.elementId < 0) {
            return this.elementsMaxRate(target, this.subject().attackElements());
        }
        return target.elementRate(this.item().damage.elementId);
    }

    elementsMaxRate(target, elements) {
        if (elements.length > 0) {
            const rates = elements.map(elementId => target.elementRate(elementId));
            return Math.max(...rates);
        }
        return 1;
    }

    applyCritical(damage) {
        return damage * 3;
    }

    applyVariance(damage, variance) {
        const amp = Math.floor(Math.max((Math.abs(damage) * variance) / 100, 0));
        const v = Math.randomInt(amp + 1) + Math.randomInt(amp + 1) - amp;
        return damage >= 0 ? damage + v : damage - v;
    }

    applyGuard(damage, target) {
        return damage / (damage > 0 && target.isGuard() ? 2 * target.grd : 1);
    }

    executeDamage(target, value) {
        const result = target.result();
        if (value === 0) result.critical = false;
        if (this.isHpEffect()) this.executeHpDamage(target, value);
        if (this.isMpEffect()) this.executeMpDamage(target, value);
    }

    executeHpDamage(target, value) {
        if (this.isDrain()) value = Math.min(target.hp, value);
        this.makeSuccess(target);
        target.gainHp(-value);
        if (value > 0) target.onDamage(value);
        this.gainDrainedHp(value);
    }

    executeMpDamage(target, value) {
        if (!this.isMpRecover()) value = Math.min(target.mp, value);
        if (value !== 0) this.makeSuccess(target);
        target.gainMp(-value);
        this.gainDrainedMp(value);
    }

    gainDrainedHp(value) {
        if (this.isDrain()) {
            let gainTarget = this.subject();
            if (this._reflectionTarget) gainTarget = this._reflectionTarget;
            gainTarget.gainHp(value);
        }
    }

    gainDrainedMp(value) {
        if (this.isDrain()) {
            let gainTarget = this.subject();
            if (this._reflectionTarget) gainTarget = this._reflectionTarget;
            gainTarget.gainMp(value);
        }
    }

    applyItemEffect(target, effect) {
        switch (effect.code) {
            case Game_Action.EFFECT_RECOVER_HP:
                this.itemEffectRecoverHp(target, effect);
                break;
            case Game_Action.EFFECT_RECOVER_MP:
                this.itemEffectRecoverMp(target, effect);
                break;
            case Game_Action.EFFECT_GAIN_TP:
                this.itemEffectGainTp(target, effect);
                break;
            case Game_Action.EFFECT_ADD_STATE:
                this.itemEffectAddState(target, effect);
                break;
            case Game_Action.EFFECT_REMOVE_STATE:
                this.itemEffectRemoveState(target, effect);
                break;
            case Game_Action.EFFECT_ADD_BUFF:
                this.itemEffectAddBuff(target, effect);
                break;
            case Game_Action.EFFECT_ADD_DEBUFF:
                this.itemEffectAddDebuff(target, effect);
                break;
            case Game_Action.EFFECT_REMOVE_BUFF:
                this.itemEffectRemoveBuff(target, effect);
                break;
            case Game_Action.EFFECT_REMOVE_DEBUFF:
                this.itemEffectRemoveDebuff(target, effect);
                break;
            case Game_Action.EFFECT_SPECIAL:
                this.itemEffectSpecial(target, effect);
                break;
            case Game_Action.EFFECT_GROW:
                this.itemEffectGrow(target, effect);
                break;
            case Game_Action.EFFECT_LEARN_SKILL:
                this.itemEffectLearnSkill(target, effect);
                break;
            case Game_Action.EFFECT_COMMON_EVENT:
                this.itemEffectCommonEvent(target, effect);
                break;
        }
    }

    itemEffectRecoverHp(target, effect) {
        let value = (target.mhp * effect.value1 + effect.value2) * target.rec;
        if (this.isItem()) value *= this.subject().pha;
        value = Math.floor(value);
        if (value !== 0) {
            target.gainHp(value);
            this.makeSuccess(target);
        }
    }

    itemEffectRecoverMp(target, effect) {
        let value = (target.mmp * effect.value1 + effect.value2) * target.rec;
        if (this.isItem()) value *= this.subject().pha;
        value = Math.floor(value);
        if (value !== 0) {
            target.gainMp(value);
            this.makeSuccess(target);
        }
    }

    itemEffectGainTp(target, effect) {
        const value = Math.floor(effect.value1);
        if (value !== 0) {
            target.gainTp(value);
            this.makeSuccess(target);
        }
    }

    itemEffectAddState(target, effect) {
        if (effect.dataId === 0) this.itemEffectAddAttackState(target, effect);
        else this.itemEffectAddNormalState(target, effect);
    }

    itemEffectAddAttackState(target, effect) {
        for (const stateId of this.subject().attackStates()) {
            let chance = effect.value1;
            chance *= target.stateRate(stateId);
            chance *= this.subject().attackStatesRate(stateId);
            chance *= this.lukEffectRate(target);
            if (Math.random() < chance) {
                target.addState(stateId);
                this.makeSuccess(target);
            }
        }
    }

    itemEffectAddNormalState(target, effect) {
        let chance = effect.value1;
        if (!this.isCertainHit()) {
            chance *= target.stateRate(effect.dataId);
            chance *= this.lukEffectRate(target);
        }
        if (Math.random() < chance) {
            target.addState(effect.dataId);
            this.makeSuccess(target);
        }
    }

    itemEffectRemoveState(target, effect) {
        const chance = effect.value1;
        if (Math.random() < chance) {
            target.removeState(effect.dataId);
            this.makeSuccess(target);
        }
    }

    itemEffectAddBuff(target, effect) {
        target.addBuff(effect.dataId, effect.value1);
        this.makeSuccess(target);
    }

    itemEffectAddDebuff(target, effect) {
        const chance = target.debuffRate(effect.dataId) * this.lukEffectRate(target);
        if (Math.random() < chance) {
            target.addDebuff(effect.dataId, effect.value1);
            this.makeSuccess(target);
        }
    }

    itemEffectRemoveBuff(target, effect) {
        if (target.isBuffAffected(effect.dataId)) {
            target.removeBuff(effect.dataId);
            this.makeSuccess(target);
        }
    }

    itemEffectRemoveDebuff(target, effect) {
        if (target.isDebuffAffected(effect.dataId)) {
            target.removeBuff(effect.dataId);
            this.makeSuccess(target);
        }
    }

    itemEffectSpecial(target, effect) {
        if (effect.dataId === Game_Action.SPECIAL_EFFECT_ESCAPE) {
            target.escape();
            this.makeSuccess(target);
        }
    }

    itemEffectGrow(target, effect) {
        target.addParam(effect.dataId, Math.floor(effect.value1));
        this.makeSuccess(target);
    }

    itemEffectLearnSkill(target, effect) {
        if (target.isActor()) {
            target.learnSkill(effect.dataId);
            this.makeSuccess(target);
        }
    }

    itemEffectCommonEvent(/* target, effect */) {}

    makeSuccess(target) {
        target.result().success = true;
    }

    applyItemUserEffect(/* target */) {
        const value = Math.floor(this.item().tpGain * this.subject().tcr);
        this.subject().gainSilentTp(value);
    }

    lukEffectRate(target) {
        return Math.max(1.0 + (this.subject().luk - target.luk) * 0.001, 0.0);
    }

    applyGlobal() {
        for (const effect of this.item().effects) {
            if (effect.code === Game_Action.EFFECT_COMMON_EVENT) $gameTemp.reserveCommonEvent(effect.dataId);
        }
        this.updateLastUsed();
        this.updateLastSubject();
    }

    updateLastUsed() {
        const item = this.item();
        if (DataManager.isSkill(item)) $gameTemp.setLastUsedSkillId(item.id);
        else if (DataManager.isItem(item)) $gameTemp.setLastUsedItemId(item.id);
    }

    updateLastSubject() {
        const subject = this.subject();
        if (subject.isActor()) $gameTemp.setLastSubjectActorId(subject.actorId());
        else $gameTemp.setLastSubjectEnemyIndex(subject.index() + 1);
    }

    updateLastTarget(target) {
        if (target.isActor()) $gameTemp.setLastTargetActorId(target.actorId());
        else $gameTemp.setLastTargetEnemyIndex(target.index() + 1);
    }
};

Game_Action.EFFECT_RECOVER_HP = 11;
Game_Action.EFFECT_RECOVER_MP = 12;
Game_Action.EFFECT_GAIN_TP = 13;
Game_Action.EFFECT_ADD_STATE = 21;
Game_Action.EFFECT_REMOVE_STATE = 22;
Game_Action.EFFECT_ADD_BUFF = 31;
Game_Action.EFFECT_ADD_DEBUFF = 32;
Game_Action.EFFECT_REMOVE_BUFF = 33;
Game_Action.EFFECT_REMOVE_DEBUFF = 34;
Game_Action.EFFECT_SPECIAL = 41;
Game_Action.EFFECT_GROW = 42;
Game_Action.EFFECT_LEARN_SKILL = 43;
Game_Action.EFFECT_COMMON_EVENT = 44;
Game_Action.SPECIAL_EFFECT_ESCAPE = 0;
Game_Action.HITTYPE_CERTAIN = 0;
Game_Action.HITTYPE_PHYSICAL = 1;
Game_Action.HITTYPE_MAGICAL = 2;

//-----------------------------------------------------------------------------
// Game_ActionResult

var Game_ActionResult = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this.clear();
    }
    clear() {
        this.used = false;
        this.missed = false;
        this.evaded = false;
        this.physical = false;
        this.drain = false;
        this.critical = false;
        this.success = false;
        this.hpAffected = false;
        this.hpDamage = 0;
        this.mpDamage = 0;
        this.tpDamage = 0;
        this.addedStates = [];
        this.removedStates = [];
        this.addedBuffs = [];
        this.addedDebuffs = [];
        this.removedBuffs = [];
    }
    addedStateObjects() {
        return this.addedStates.map(id => $dataStates[id]);
    }
    removedStateObjects() {
        return this.removedStates.map(id => $dataStates[id]);
    }
    isStatusAffected() {
        return (
            this.addedStates.length > 0 ||
            this.removedStates.length > 0 ||
            this.addedBuffs.length > 0 ||
            this.addedDebuffs.length > 0 ||
            this.removedBuffs.length > 0
        );
    }
    isHit() {
        return this.used && !this.missed && !this.evaded;
    }
    isStateAdded(stateId) {
        return this.addedStates.includes(stateId);
    }
    pushAddedState(stateId) {
        if (!this.isStateAdded(stateId)) this.addedStates.push(stateId);
    }
    isStateRemoved(stateId) {
        return this.removedStates.includes(stateId);
    }
    pushRemovedState(stateId) {
        if (!this.isStateRemoved(stateId)) this.removedStates.push(stateId);
    }
    isBuffAdded(paramId) {
        return this.addedBuffs.includes(paramId);
    }
    pushAddedBuff(paramId) {
        if (!this.isBuffAdded(paramId)) this.addedBuffs.push(paramId);
    }
    isDebuffAdded(paramId) {
        return this.addedDebuffs.includes(paramId);
    }
    pushAddedDebuff(paramId) {
        if (!this.isDebuffAdded(paramId)) this.addedDebuffs.push(paramId);
    }
    isBuffRemoved(paramId) {
        return this.removedBuffs.includes(paramId);
    }
    pushRemovedBuff(paramId) {
        if (!this.isBuffRemoved(paramId)) this.removedBuffs.push(paramId);
    }
};

//-----------------------------------------------------------------------------
// Game_BattlerBase

var Game_BattlerBase = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this.initMembers();
    }

    initMembers() {
        this._hp = 1;
        this._mp = 0;
        this._tp = 0;
        this._hidden = false;
        this.clearParamPlus();
        this.clearStates();
        this.clearBuffs();
    }

    // Parameters
    get hp() {
        return this._hp;
    }
    get mp() {
        return this._mp;
    }
    get tp() {
        return this._tp;
    }
    get mhp() {
        return this.param(0);
    }
    get mmp() {
        return this.param(1);
    }
    get atk() {
        return this.param(2);
    }
    get def() {
        return this.param(3);
    }
    get mat() {
        return this.param(4);
    }
    get mdf() {
        return this.param(5);
    }
    get agi() {
        return this.param(6);
    }
    get luk() {
        return this.param(7);
    }
    get hit() {
        return this.xparam(0);
    }
    get eva() {
        return this.xparam(1);
    }
    get cri() {
        return this.xparam(2);
    }
    get cev() {
        return this.xparam(3);
    }
    get mev() {
        return this.xparam(4);
    }
    get mrf() {
        return this.xparam(5);
    }
    get cnt() {
        return this.xparam(6);
    }
    get hrg() {
        return this.xparam(7);
    }
    get mrg() {
        return this.xparam(8);
    }
    get trg() {
        return this.xparam(9);
    }
    get tgr() {
        return this.sparam(0);
    }
    get grd() {
        return this.sparam(1);
    }
    get rec() {
        return this.sparam(2);
    }
    get pha() {
        return this.sparam(3);
    }
    get mcr() {
        return this.sparam(4);
    }
    get tcr() {
        return this.sparam(5);
    }
    get pdr() {
        return this.sparam(6);
    }
    get mdr() {
        return this.sparam(7);
    }
    get fdr() {
        return this.sparam(8);
    }
    get exr() {
        return this.sparam(9);
    }

    clearParamPlus() {
        this._paramPlus = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    clearStates() {
        this._states = [];
        this._stateTurns = {};
    }

    eraseState(stateId) {
        this._states.remove(stateId);
        delete this._stateTurns[stateId];
    }

    isStateAffected(stateId) {
        return this._states.includes(stateId);
    }

    isDeathStateAffected() {
        return this.isStateAffected(this.deathStateId());
    }

    deathStateId() {
        return 1;
    }

    resetStateCounts(stateId) {
        const state = $dataStates[stateId];
        const variance = 1 + Math.max(state.maxTurns - state.minTurns, 0);
        this._stateTurns[stateId] = state.minTurns + Math.randomInt(variance);
    }

    isStateExpired(stateId) {
        return this._stateTurns[stateId] === 0;
    }

    updateStateTurns() {
        for (const stateId of this._states) {
            if (this._stateTurns[stateId] > 0) this._stateTurns[stateId]--;
        }
    }

    clearBuffs() {
        this._buffs = [0, 0, 0, 0, 0, 0, 0, 0];
        this._buffTurns = [0, 0, 0, 0, 0, 0, 0, 0];
    }

    eraseBuff(paramId) {
        this._buffs[paramId] = 0;
        this._buffTurns[paramId] = 0;
    }

    buffLength() {
        return this._buffs.length;
    }

    buff(paramId) {
        return this._buffs[paramId];
    }

    isBuffAffected(paramId) {
        return this._buffs[paramId] > 0;
    }

    isDebuffAffected(paramId) {
        return this._buffs[paramId] < 0;
    }

    isBuffOrDebuffAffected(paramId) {
        return this._buffs[paramId] !== 0;
    }

    isMaxBuffAffected(paramId) {
        return this._buffs[paramId] === 2;
    }

    isMaxDebuffAffected(paramId) {
        return this._buffs[paramId] === -2;
    }

    increaseBuff(paramId) {
        if (!this.isMaxBuffAffected(paramId)) this._buffs[paramId]++;
    }

    decreaseBuff(paramId) {
        if (!this.isMaxDebuffAffected(paramId)) this._buffs[paramId]--;
    }

    overwriteBuffTurns(paramId, turns) {
        if (this._buffTurns[paramId] < turns) this._buffTurns[paramId] = turns;
    }

    isBuffExpired(paramId) {
        return this._buffTurns[paramId] === 0;
    }

    updateBuffTurns() {
        for (let i = 0; i < this._buffTurns.length; i++) {
            if (this._buffTurns[i] > 0) this._buffTurns[i]--;
        }
    }

    die() {
        this._hp = 0;
        this.clearStates();
        this.clearBuffs();
    }

    revive() {
        if (this._hp === 0) this._hp = 1;
    }

    states() {
        return this._states.map(id => $dataStates[id]);
    }

    stateIcons() {
        return this.states()
            .map(state => state.iconIndex)
            .filter(iconIndex => iconIndex > 0);
    }

    buffIcons() {
        const icons = [];
        for (let i = 0; i < this._buffs.length; i++) {
            if (this._buffs[i] !== 0) icons.push(this.buffIconIndex(this._buffs[i], i));
        }
        return icons;
    }

    buffIconIndex(buffLevel, paramId) {
        if (buffLevel > 0) return Game_BattlerBase.ICON_BUFF_START + (buffLevel - 1) * 8 + paramId;
        if (buffLevel < 0) return Game_BattlerBase.ICON_DEBUFF_START + (-buffLevel - 1) * 8 + paramId;
        return 0;
    }

    allIcons() {
        return this.stateIcons().concat(this.buffIcons());
    }

    traitObjects() {
        // Returns an array of the all objects having traits. States only here.
        return this.states();
    }

    allTraits() {
        return this.traitObjects().reduce((r, obj) => r.concat(obj.traits), []);
    }

    traits(code) {
        return this.allTraits().filter(trait => trait.code === code);
    }

    traitsWithId(code, id) {
        return this.allTraits().filter(trait => trait.code === code && trait.dataId === id);
    }

    traitsPi(code, id) {
        return this.traitsWithId(code, id).reduce((r, trait) => r * trait.value, 1);
    }

    traitsSum(code, id) {
        return this.traitsWithId(code, id).reduce((r, trait) => r + trait.value, 0);
    }

    traitsSumAll(code) {
        return this.traits(code).reduce((r, trait) => r + trait.value, 0);
    }

    traitsSet(code) {
        return this.traits(code).reduce((r, trait) => r.concat(trait.dataId), []);
    }

    paramBase(/* paramId */) {
        return 0;
    }

    paramPlus(paramId) {
        return this._paramPlus[paramId];
    }

    paramBasePlus(paramId) {
        return Math.max(0, this.paramBase(paramId) + this.paramPlus(paramId));
    }

    paramMin(paramId) {
        if (paramId === 0) return 1; // MHP
        return 0;
    }

    paramMax(/* paramId */) {
        return Infinity;
    }

    paramRate(paramId) {
        return this.traitsPi(Game_BattlerBase.TRAIT_PARAM, paramId);
    }

    paramBuffRate(paramId) {
        return this._buffs[paramId] * 0.25 + 1.0;
    }

    param(paramId) {
        const value = this.paramBasePlus(paramId) * this.paramRate(paramId) * this.paramBuffRate(paramId);
        const maxValue = this.paramMax(paramId);
        const minValue = this.paramMin(paramId);
        return Math.round(value.clamp(minValue, maxValue));
    }

    xparam(xparamId) {
        return this.traitsSum(Game_BattlerBase.TRAIT_XPARAM, xparamId);
    }

    sparam(sparamId) {
        return this.traitsPi(Game_BattlerBase.TRAIT_SPARAM, sparamId);
    }

    elementRate(elementId) {
        return this.traitsPi(Game_BattlerBase.TRAIT_ELEMENT_RATE, elementId);
    }

    debuffRate(paramId) {
        return this.traitsPi(Game_BattlerBase.TRAIT_DEBUFF_RATE, paramId);
    }

    stateRate(stateId) {
        return this.traitsPi(Game_BattlerBase.TRAIT_STATE_RATE, stateId);
    }

    stateResistSet() {
        return this.traitsSet(Game_BattlerBase.TRAIT_STATE_RESIST);
    }

    isStateResist(stateId) {
        return this.stateResistSet().includes(stateId);
    }

    attackElements() {
        return this.traitsSet(Game_BattlerBase.TRAIT_ATTACK_ELEMENT);
    }

    attackStates() {
        return this.traitsSet(Game_BattlerBase.TRAIT_ATTACK_STATE);
    }

    attackStatesRate(stateId) {
        return this.traitsSum(Game_BattlerBase.TRAIT_ATTACK_STATE, stateId);
    }

    attackSpeed() {
        return this.traitsSumAll(Game_BattlerBase.TRAIT_ATTACK_SPEED);
    }

    attackTimesAdd() {
        return Math.max(this.traitsSumAll(Game_BattlerBase.TRAIT_ATTACK_TIMES), 0);
    }

    attackSkillId() {
        const set = this.traitsSet(Game_BattlerBase.TRAIT_ATTACK_SKILL);
        return set.length > 0 ? Math.max(...set) : 1;
    }

    addedSkillTypes() {
        return this.traitsSet(Game_BattlerBase.TRAIT_STYPE_ADD);
    }

    isSkillTypeSealed(stypeId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_STYPE_SEAL).includes(stypeId);
    }

    addedSkills() {
        return this.traitsSet(Game_BattlerBase.TRAIT_SKILL_ADD);
    }

    isSkillSealed(skillId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_SKILL_SEAL).includes(skillId);
    }

    isEquipWtypeOk(wtypeId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_EQUIP_WTYPE).includes(wtypeId);
    }

    isEquipAtypeOk(atypeId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_EQUIP_ATYPE).includes(atypeId);
    }

    isEquipTypeLocked(etypeId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_EQUIP_LOCK).includes(etypeId);
    }

    isEquipTypeSealed(etypeId) {
        return this.traitsSet(Game_BattlerBase.TRAIT_EQUIP_SEAL).includes(etypeId);
    }

    slotType() {
        const set = this.traitsSet(Game_BattlerBase.TRAIT_SLOT_TYPE);
        return set.length > 0 ? Math.max(...set) : 0;
    }

    isDualWield() {
        return this.slotType() === 1;
    }

    actionPlusSet() {
        return this.traits(Game_BattlerBase.TRAIT_ACTION_PLUS).map(trait => trait.value);
    }

    specialFlag(flagId) {
        return this.traits(Game_BattlerBase.TRAIT_SPECIAL_FLAG).some(trait => trait.dataId === flagId);
    }

    collapseType() {
        const set = this.traitsSet(Game_BattlerBase.TRAIT_COLLAPSE_TYPE);
        return set.length > 0 ? Math.max(...set) : 0;
    }

    partyAbility(abilityId) {
        return this.traits(Game_BattlerBase.TRAIT_PARTY_ABILITY).some(trait => trait.dataId === abilityId);
    }

    isAutoBattle() {
        return this.specialFlag(Game_BattlerBase.FLAG_ID_AUTO_BATTLE);
    }

    isGuard() {
        return this.specialFlag(Game_BattlerBase.FLAG_ID_GUARD) && this.canMove();
    }

    isSubstitute() {
        return this.specialFlag(Game_BattlerBase.FLAG_ID_SUBSTITUTE) && this.canMove();
    }

    isPreserveTp() {
        return this.specialFlag(Game_BattlerBase.FLAG_ID_PRESERVE_TP);
    }

    addParam(paramId, value) {
        this._paramPlus[paramId] += value;
        this.refresh();
    }

    setHp(hp) {
        this._hp = hp;
        this.refresh();
    }

    setMp(mp) {
        this._mp = mp;
        this.refresh();
    }

    setTp(tp) {
        this._tp = tp;
        this.refresh();
    }

    maxTp() {
        return 100;
    }

    refresh() {
        for (const stateId of this.stateResistSet()) this.eraseState(stateId);
        this._hp = this._hp.clamp(0, this.mhp);
        this._mp = this._mp.clamp(0, this.mmp);
        this._tp = this._tp.clamp(0, this.maxTp());
    }

    recoverAll() {
        this.clearStates();
        this._hp = this.mhp;
        this._mp = this.mmp;
    }

    hpRate() {
        return this.hp / this.mhp;
    }

    mpRate() {
        return this.mmp > 0 ? this.mp / this.mmp : 0;
    }

    tpRate() {
        return this.tp / this.maxTp();
    }

    hide() {
        this._hidden = true;
    }

    appear() {
        this._hidden = false;
    }

    isHidden() {
        return this._hidden;
    }

    isAppeared() {
        return !this.isHidden();
    }

    isDead() {
        return this.isAppeared() && this.isDeathStateAffected();
    }

    isAlive() {
        return this.isAppeared() && !this.isDeathStateAffected();
    }

    isDying() {
        return this.isAlive() && this._hp < this.mhp / 4;
    }

    isRestricted() {
        return this.isAppeared() && this.restriction() > 0;
    }

    canInput() {
        // prettier-ignore
        return this.isAppeared() && this.isActor() && !this.isRestricted() && !this.isAutoBattle();
    }

    canMove() {
        return this.isAppeared() && this.restriction() < 4;
    }

    isConfused() {
        return this.isAppeared() && this.restriction() >= 1 && this.restriction() <= 3;
    }

    confusionLevel() {
        return this.isConfused() ? this.restriction() : 0;
    }

    isActor() {
        return false;
    }

    isEnemy() {
        return false;
    }

    sortStates() {
        this._states.sort((a, b) => {
            const p1 = $dataStates[a].priority;
            const p2 = $dataStates[b].priority;
            if (p1 !== p2) return p2 - p1;
            return a - b;
        });
    }

    restriction() {
        const restrictions = this.states().map(state => state.restriction);
        return Math.max(0, ...restrictions);
    }

    addNewState(stateId) {
        if (stateId === this.deathStateId()) this.die();
        const restricted = this.isRestricted();
        this._states.push(stateId);
        this.sortStates();
        if (!restricted && this.isRestricted()) this.onRestrict();
    }

    onRestrict() {}

    mostImportantStateText() {
        for (const state of this.states()) {
            if (state.message3) return state.message3;
        }
        return "";
    }

    stateMotionIndex() {
        const states = this.states();
        if (states.length > 0) return states[0].motion;
        return 0;
    }

    stateOverlayIndex() {
        const states = this.states();
        if (states.length > 0) return states[0].overlay;
        return 0;
    }

    isSkillWtypeOk(/* skill */) {
        return true;
    }

    skillMpCost(skill) {
        return Math.floor(skill.mpCost * this.mcr);
    }

    skillTpCost(skill) {
        return skill.tpCost;
    }

    canPaySkillCost(skill) {
        return this._tp >= this.skillTpCost(skill) && this._mp >= this.skillMpCost(skill);
    }

    paySkillCost(skill) {
        this._mp -= this.skillMpCost(skill);
        this._tp -= this.skillTpCost(skill);
    }

    isOccasionOk(item) {
        if ($gameParty.inBattle()) return item.occasion === 0 || item.occasion === 1;
        return item.occasion === 0 || item.occasion === 2;
    }

    meetsUsableItemConditions(item) {
        return this.canMove() && this.isOccasionOk(item);
    }

    meetsSkillConditions(skill) {
        return (
            this.meetsUsableItemConditions(skill) &&
            this.isSkillWtypeOk(skill) &&
            this.canPaySkillCost(skill) &&
            !this.isSkillSealed(skill.id) &&
            !this.isSkillTypeSealed(skill.stypeId)
        );
    }

    meetsItemConditions(item) {
        return this.meetsUsableItemConditions(item) && $gameParty.hasItem(item);
    }

    canUse(item) {
        if (!item) return false;
        if (DataManager.isSkill(item)) return this.meetsSkillConditions(item);
        if (DataManager.isItem(item)) return this.meetsItemConditions(item);
        return false;
    }

    canEquip(item) {
        if (!item) return false;
        if (DataManager.isWeapon(item)) return this.canEquipWeapon(item);
        if (DataManager.isArmor(item)) return this.canEquipArmor(item);
        return false;
    }

    canEquipWeapon(item) {
        return this.isEquipWtypeOk(item.wtypeId) && !this.isEquipTypeSealed(item.etypeId);
    }

    canEquipArmor(item) {
        return this.isEquipAtypeOk(item.atypeId) && !this.isEquipTypeSealed(item.etypeId);
    }

    guardSkillId() {
        return 2;
    }

    canAttack() {
        return this.canUse($dataSkills[this.attackSkillId()]);
    }

    canGuard() {
        return this.canUse($dataSkills[this.guardSkillId()]);
    }
};

Game_BattlerBase.TRAIT_ELEMENT_RATE = 11;
Game_BattlerBase.TRAIT_DEBUFF_RATE = 12;
Game_BattlerBase.TRAIT_STATE_RATE = 13;
Game_BattlerBase.TRAIT_STATE_RESIST = 14;
Game_BattlerBase.TRAIT_PARAM = 21;
Game_BattlerBase.TRAIT_XPARAM = 22;
Game_BattlerBase.TRAIT_SPARAM = 23;
Game_BattlerBase.TRAIT_ATTACK_ELEMENT = 31;
Game_BattlerBase.TRAIT_ATTACK_STATE = 32;
Game_BattlerBase.TRAIT_ATTACK_SPEED = 33;
Game_BattlerBase.TRAIT_ATTACK_TIMES = 34;
Game_BattlerBase.TRAIT_ATTACK_SKILL = 35;
Game_BattlerBase.TRAIT_STYPE_ADD = 41;
Game_BattlerBase.TRAIT_STYPE_SEAL = 42;
Game_BattlerBase.TRAIT_SKILL_ADD = 43;
Game_BattlerBase.TRAIT_SKILL_SEAL = 44;
Game_BattlerBase.TRAIT_EQUIP_WTYPE = 51;
Game_BattlerBase.TRAIT_EQUIP_ATYPE = 52;
Game_BattlerBase.TRAIT_EQUIP_LOCK = 53;
Game_BattlerBase.TRAIT_EQUIP_SEAL = 54;
Game_BattlerBase.TRAIT_SLOT_TYPE = 55;
Game_BattlerBase.TRAIT_ACTION_PLUS = 61;
Game_BattlerBase.TRAIT_SPECIAL_FLAG = 62;
Game_BattlerBase.TRAIT_COLLAPSE_TYPE = 63;
Game_BattlerBase.TRAIT_PARTY_ABILITY = 64;
Game_BattlerBase.FLAG_ID_AUTO_BATTLE = 0;
Game_BattlerBase.FLAG_ID_GUARD = 1;
Game_BattlerBase.FLAG_ID_SUBSTITUTE = 2;
Game_BattlerBase.FLAG_ID_PRESERVE_TP = 3;
Game_BattlerBase.ICON_BUFF_START = 32;
Game_BattlerBase.ICON_DEBUFF_START = 48;

//-----------------------------------------------------------------------------
// Game_Battler

var Game_Battler = class extends Game_BattlerBase {
    initMembers() {
        super.initMembers();
        this._actions = [];
        this._speed = 0;
        this._result = new Game_ActionResult();
        this._actionState = "";
        this._lastTargetIndex = 0;
        this._damagePopup = false;
        this._effectType = null;
        this._motionType = null;
        this._weaponImageId = 0;
        this._motionRefresh = false;
        this._selected = false;
        this._tpbState = "";
        this._tpbChargeTime = 0;
        this._tpbCastTime = 0;
        this._tpbIdleTime = 0;
        this._tpbTurnCount = 0;
        this._tpbTurnEnd = false;
    }

    clearDamagePopup() {
        this._damagePopup = false;
    }
    clearWeaponAnimation() {
        this._weaponImageId = 0;
    }
    clearEffect() {
        this._effectType = null;
    }
    clearMotion() {
        this._motionType = null;
        this._motionRefresh = false;
    }
    requestEffect(effectType) {
        this._effectType = effectType;
    }
    requestMotion(motionType) {
        this._motionType = motionType;
    }
    requestMotionRefresh() {
        this._motionRefresh = true;
    }
    cancelMotionRefresh() {
        this._motionRefresh = false;
    }
    select() {
        this._selected = true;
    }
    deselect() {
        this._selected = false;
    }
    isDamagePopupRequested() {
        return this._damagePopup;
    }
    isEffectRequested() {
        return !!this._effectType;
    }
    isMotionRequested() {
        return !!this._motionType;
    }
    isWeaponAnimationRequested() {
        return this._weaponImageId > 0;
    }
    isMotionRefreshRequested() {
        return this._motionRefresh;
    }
    isSelected() {
        return this._selected;
    }
    effectType() {
        return this._effectType;
    }
    motionType() {
        return this._motionType;
    }
    weaponImageId() {
        return this._weaponImageId;
    }
    startDamagePopup() {
        this._damagePopup = true;
    }
    shouldPopupDamage() {
        const result = this._result;
        return result.missed || result.evaded || result.hpAffected || result.mpDamage !== 0;
    }
    startWeaponAnimation(weaponImageId) {
        this._weaponImageId = weaponImageId;
    }

    action(index) {
        return this._actions[index];
    }
    setAction(index, action) {
        this._actions[index] = action;
    }
    numActions() {
        return this._actions.length;
    }
    clearActions() {
        this._actions = [];
    }
    result() {
        return this._result;
    }
    clearResult() {
        this._result.clear();
    }

    clearTpbChargeTime() {
        this._tpbState = "charging";
        this._tpbChargeTime = 0;
    }

    applyTpbPenalty() {
        this._tpbState = "charging";
        this._tpbChargeTime -= 1;
    }

    initTpbChargeTime(advantageous) {
        const speed = this.tpbRelativeSpeed();
        this._tpbState = "charging";
        this._tpbChargeTime = advantageous ? 1 : speed * Math.random() * 0.5;
        if (this.isRestricted()) this._tpbChargeTime = 0;
    }

    tpbChargeTime() {
        return this._tpbChargeTime;
    }

    startTpbCasting() {
        this._tpbState = "casting";
        this._tpbCastTime = 0;
    }

    startTpbAction() {
        this._tpbState = "acting";
    }

    isTpbCharged() {
        return this._tpbState === "charged";
    }

    isTpbReady() {
        return this._tpbState === "ready";
    }

    isTpbTimeout() {
        return this._tpbIdleTime >= 1;
    }

    updateTpb() {
        if (this.canMove()) {
            this.updateTpbChargeTime();
            this.updateTpbCastTime();
            this.updateTpbAutoBattle();
        }
        if (this.isAlive()) this.updateTpbIdleTime();
    }

    updateTpbChargeTime() {
        if (this._tpbState === "charging") {
            this._tpbChargeTime += this.tpbAcceleration();
            if (this._tpbChargeTime >= 1) {
                this._tpbChargeTime = 1;
                this.onTpbCharged();
            }
        }
    }

    updateTpbCastTime() {
        if (this._tpbState === "casting") {
            this._tpbCastTime += this.tpbAcceleration();
            if (this._tpbCastTime >= this.tpbRequiredCastTime()) {
                this._tpbCastTime = this.tpbRequiredCastTime();
                this._tpbState = "ready";
            }
        }
    }

    updateTpbAutoBattle() {
        if (this.isTpbCharged() && !this.isTpbTurnEnd() && this.isAutoBattle()) this.makeTpbActions();
    }

    updateTpbIdleTime() {
        if (!this.canMove() || this.isTpbCharged()) this._tpbIdleTime += this.tpbAcceleration();
    }

    tpbAcceleration() {
        const speed = this.tpbRelativeSpeed();
        const referenceTime = $gameParty.tpbReferenceTime();
        return speed / referenceTime;
    }

    tpbRelativeSpeed() {
        return this.tpbSpeed() / $gameParty.tpbBaseSpeed();
    }

    tpbSpeed() {
        return Math.sqrt(this.agi) + 1;
    }

    tpbBaseSpeed() {
        const baseAgility = this.paramBasePlus(6);
        return Math.sqrt(baseAgility) + 1;
    }

    tpbRequiredCastTime() {
        const actions = this._actions.filter(action => action.isValid());
        const items = actions.map(action => action.item());
        const delay = items.reduce((r, item) => r + Math.max(0, -item.speed), 0);
        return Math.sqrt(delay) / this.tpbSpeed();
    }

    onTpbCharged() {
        if (!this.shouldDelayTpbCharge()) this.finishTpbCharge();
    }

    shouldDelayTpbCharge() {
        return !BattleManager.isActiveTpb() && $gameParty.canInput();
    }

    finishTpbCharge() {
        this._tpbState = "charged";
        this._tpbTurnEnd = true;
        this._tpbIdleTime = 0;
    }

    isTpbTurnEnd() {
        return this._tpbTurnEnd;
    }

    initTpbTurn() {
        this._tpbTurnEnd = false;
        this._tpbTurnCount = 0;
        this._tpbIdleTime = 0;
    }

    startTpbTurn() {
        this._tpbTurnEnd = false;
        this._tpbTurnCount++;
        this._tpbIdleTime = 0;
        if (this.numActions() === 0) this.makeTpbActions();
    }

    makeTpbActions() {
        this.makeActions();
        if (this.canInput()) {
            this.setActionState("undecided");
        } else {
            this.startTpbCasting();
            this.setActionState("waiting");
        }
    }

    onTpbTimeout() {
        this.onAllActionsEnd();
        this._tpbTurnEnd = true;
        this._tpbIdleTime = 0;
    }

    turnCount() {
        if (BattleManager.isTpb()) return this._tpbTurnCount;
        return $gameTroop.turnCount() + 1;
    }

    canInput() {
        if (BattleManager.isTpb() && !this.isTpbCharged()) return false;
        return super.canInput();
    }

    refresh() {
        super.refresh();
        if (this.hp === 0) this.addState(this.deathStateId());
        else this.removeState(this.deathStateId());
    }

    addState(stateId) {
        if (this.isStateAddable(stateId)) {
            if (!this.isStateAffected(stateId)) {
                this.addNewState(stateId);
                this.refresh();
            }
            this.resetStateCounts(stateId);
            this._result.pushAddedState(stateId);
        }
    }

    isStateAddable(stateId) {
        return this.isAlive() && $dataStates[stateId] && !this.isStateResist(stateId) && !this.isStateRestrict(stateId);
    }

    isStateRestrict(stateId) {
        return $dataStates[stateId].removeByRestriction && this.isRestricted();
    }

    onRestrict() {
        super.onRestrict();
        this.clearTpbChargeTime();
        this.clearActions();
        for (const state of this.states()) {
            if (state.removeByRestriction) this.removeState(state.id);
        }
    }

    removeState(stateId) {
        if (this.isStateAffected(stateId)) {
            if (stateId === this.deathStateId()) this.revive();
            this.eraseState(stateId);
            this.refresh();
            this._result.pushRemovedState(stateId);
        }
    }

    escape() {
        if ($gameParty.inBattle()) this.hide();
        this.clearActions();
        this.clearStates();
        SoundManager.playEscape();
    }

    addBuff(paramId, turns) {
        if (this.isAlive()) {
            this.increaseBuff(paramId);
            if (this.isBuffAffected(paramId)) this.overwriteBuffTurns(paramId, turns);
            this._result.pushAddedBuff(paramId);
            this.refresh();
        }
    }

    addDebuff(paramId, turns) {
        if (this.isAlive()) {
            this.decreaseBuff(paramId);
            if (this.isDebuffAffected(paramId)) this.overwriteBuffTurns(paramId, turns);
            this._result.pushAddedDebuff(paramId);
            this.refresh();
        }
    }

    removeBuff(paramId) {
        if (this.isAlive() && this.isBuffOrDebuffAffected(paramId)) {
            this.eraseBuff(paramId);
            this._result.pushRemovedBuff(paramId);
            this.refresh();
        }
    }

    removeBattleStates() {
        for (const state of this.states()) {
            if (state.removeAtBattleEnd) this.removeState(state.id);
        }
    }

    removeAllBuffs() {
        for (let i = 0; i < this.buffLength(); i++) this.removeBuff(i);
    }

    removeStatesAuto(timing) {
        for (const state of this.states()) {
            if (this.isStateExpired(state.id) && state.autoRemovalTiming === timing) this.removeState(state.id);
        }
    }

    removeBuffsAuto() {
        for (let i = 0; i < this.buffLength(); i++) {
            if (this.isBuffExpired(i)) this.removeBuff(i);
        }
    }

    removeStatesByDamage() {
        for (const state of this.states()) {
            if (state.removeByDamage && Math.randomInt(100) < state.chanceByDamage) this.removeState(state.id);
        }
    }

    makeActionTimes() {
        const actionPlusSet = this.actionPlusSet();
        return actionPlusSet.reduce((r, p) => (Math.random() < p ? r + 1 : r), 1);
    }

    makeActions() {
        this.clearActions();
        if (this.canMove()) {
            const actionTimes = this.makeActionTimes();
            this._actions = [];
            for (let i = 0; i < actionTimes; i++) this._actions.push(new Game_Action(this));
        }
    }

    speed() {
        return this._speed;
    }

    makeSpeed() {
        this._speed = Math.min(...this._actions.map(action => action.speed())) || 0;
    }

    currentAction() {
        return this._actions[0];
    }

    removeCurrentAction() {
        this._actions.shift();
    }

    setLastTarget(target) {
        this._lastTargetIndex = target ? target.index() : 0;
    }

    forceAction(skillId, targetIndex) {
        this.clearActions();
        const action = new Game_Action(this, true);
        action.setSkill(skillId);
        if (targetIndex === -2) action.setTarget(this._lastTargetIndex);
        else if (targetIndex === -1) action.decideRandomTarget();
        else action.setTarget(targetIndex);
        if (action.item()) this._actions.push(action);
    }

    useItem(item) {
        if (DataManager.isSkill(item)) this.paySkillCost(item);
        else if (DataManager.isItem(item)) this.consumeItem(item);
    }

    consumeItem(item) {
        $gameParty.consumeItem(item);
    }

    gainHp(value) {
        this._result.hpDamage = -value;
        this._result.hpAffected = true;
        this.setHp(this.hp + value);
    }

    gainMp(value) {
        this._result.mpDamage = -value;
        this.setMp(this.mp + value);
    }

    gainTp(value) {
        this._result.tpDamage = -value;
        this.setTp(this.tp + value);
    }

    gainSilentTp(value) {
        this.setTp(this.tp + value);
    }

    initTp() {
        this.setTp(Math.randomInt(25));
    }

    clearTp() {
        this.setTp(0);
    }

    chargeTpByDamage(damageRate) {
        const value = Math.floor(50 * damageRate * this.tcr);
        this.gainSilentTp(value);
    }

    regenerateHp() {
        const minRecover = -this.maxSlipDamage();
        const value = Math.max(Math.floor(this.mhp * this.hrg), minRecover);
        if (value !== 0) this.gainHp(value);
    }

    maxSlipDamage() {
        return $dataSystem.optSlipDeath ? this.hp : Math.max(this.hp - 1, 0);
    }

    regenerateMp() {
        const value = Math.floor(this.mmp * this.mrg);
        if (value !== 0) this.gainMp(value);
    }

    regenerateTp() {
        const value = Math.floor(100 * this.trg);
        this.gainSilentTp(value);
    }

    regenerateAll() {
        if (this.isAlive()) {
            this.regenerateHp();
            this.regenerateMp();
            this.regenerateTp();
        }
    }

    onBattleStart(advantageous) {
        this.setActionState("undecided");
        this.clearMotion();
        this.initTpbChargeTime(advantageous);
        this.initTpbTurn();
        if (!this.isPreserveTp()) this.initTp();
    }

    onAllActionsEnd() {
        this.clearResult();
        this.removeStatesAuto(1);
        this.removeBuffsAuto();
    }

    onTurnEnd() {
        this.clearResult();
        this.regenerateAll();
        this.updateStateTurns();
        this.updateBuffTurns();
        this.removeStatesAuto(2);
    }

    onBattleEnd() {
        this.clearResult();
        this.removeBattleStates();
        this.removeAllBuffs();
        this.clearActions();
        if (!this.isPreserveTp()) this.clearTp();
        this.appear();
    }

    onDamage(value) {
        this.removeStatesByDamage();
        this.chargeTpByDamage(value / this.mhp);
    }

    setActionState(actionState) {
        this._actionState = actionState;
        this.requestMotionRefresh();
    }

    isUndecided() {
        return this._actionState === "undecided";
    }
    isInputting() {
        return this._actionState === "inputting";
    }
    isWaiting() {
        return this._actionState === "waiting";
    }
    isActing() {
        return this._actionState === "acting";
    }

    isChanting() {
        if (this.isWaiting()) return this._actions.some(action => action.isMagicSkill());
        return false;
    }

    isGuardWaiting() {
        if (this.isWaiting()) return this._actions.some(action => action.isGuard());
        return false;
    }

    performActionStart(action) {
        if (!action.isGuard()) this.setActionState("acting");
    }

    performAction(/* action */) {}
    performActionEnd() {}
    performDamage() {}
    performMiss() {
        SoundManager.playMiss();
    }
    performRecovery() {
        SoundManager.playRecovery();
    }
    performEvasion() {
        SoundManager.playEvasion();
    }
    performMagicEvasion() {
        SoundManager.playMagicEvasion();
    }
    performCounter() {
        SoundManager.playEvasion();
    }
    performReflection() {
        SoundManager.playReflection();
    }
    performSubstitute(/* target */) {}
    performCollapse() {}
};

//-----------------------------------------------------------------------------
// Game_Actor

var Game_Actor = class extends Game_Battler {
    initialize(actorId) {
        super.initialize();
        this.setup(actorId);
    }

    get level() {
        return this._level;
    }

    initMembers() {
        super.initMembers();
        this._actorId = 0;
        this._name = "";
        this._nickname = "";
        this._classId = 0;
        this._level = 0;
        this._characterName = "";
        this._characterIndex = 0;
        this._faceName = "";
        this._faceIndex = 0;
        this._battlerName = "";
        this._exp = {};
        this._skills = [];
        this._equips = [];
        this._actionInputIndex = 0;
        this._lastMenuSkill = new Game_Item();
        this._lastBattleSkill = new Game_Item();
        this._lastCommandSymbol = "";
        this._profile = "";
        this._stateSteps = {};
    }

    setup(actorId) {
        const actor = $dataActors[actorId];
        this._actorId = actorId;
        this._name = actor.name;
        this._nickname = actor.nickname;
        this._profile = actor.profile;
        this._classId = actor.classId;
        this._level = actor.initialLevel;
        this.initImages();
        this.initExp();
        this.initSkills();
        this.initEquips(actor.equips);
        this.clearParamPlus();
        this.recoverAll();
    }

    actorId() {
        return this._actorId;
    }
    actor() {
        return $dataActors[this._actorId];
    }
    name() {
        return this._name;
    }
    setName(name) {
        this._name = name;
    }
    nickname() {
        return this._nickname;
    }
    setNickname(nickname) {
        this._nickname = nickname;
    }
    profile() {
        return this._profile;
    }
    setProfile(profile) {
        this._profile = profile;
    }
    characterName() {
        return this._characterName;
    }
    characterIndex() {
        return this._characterIndex;
    }
    faceName() {
        return this._faceName;
    }
    faceIndex() {
        return this._faceIndex;
    }
    battlerName() {
        return this._battlerName;
    }

    clearStates() {
        super.clearStates();
        this._stateSteps = {};
    }

    eraseState(stateId) {
        super.eraseState(stateId);
        delete this._stateSteps[stateId];
    }

    resetStateCounts(stateId) {
        super.resetStateCounts(stateId);
        this._stateSteps[stateId] = $dataStates[stateId].stepsToRemove;
    }

    initImages() {
        const actor = this.actor();
        this._characterName = actor.characterName;
        this._characterIndex = actor.characterIndex;
        this._faceName = actor.faceName;
        this._faceIndex = actor.faceIndex;
        this._battlerName = actor.battlerName;
    }

    expForLevel(level) {
        const c = this.currentClass();
        const basis = c.expParams[0];
        const extra = c.expParams[1];
        const acc_a = c.expParams[2];
        const acc_b = c.expParams[3];
        return Math.round(
            (basis * Math.pow(level - 1, 0.9 + acc_a / 250) * level * (level + 1)) /
                (6 + Math.pow(level, 2) / 50 / acc_b) +
                (level - 1) * extra
        );
    }

    initExp() {
        this._exp[this._classId] = this.currentLevelExp();
    }

    currentExp() {
        return this._exp[this._classId];
    }

    currentLevelExp() {
        return this.expForLevel(this._level);
    }

    nextLevelExp() {
        return this.expForLevel(this._level + 1);
    }

    nextRequiredExp() {
        return this.nextLevelExp() - this.currentExp();
    }

    maxLevel() {
        return this.actor().maxLevel;
    }

    isMaxLevel() {
        return this._level >= this.maxLevel();
    }

    initSkills() {
        this._skills = [];
        for (const learning of this.currentClass().learnings) {
            if (learning.level <= this._level) this.learnSkill(learning.skillId);
        }
    }

    initEquips(equips) {
        const slots = this.equipSlots();
        const maxSlots = slots.length;
        this._equips = [];
        for (let i = 0; i < maxSlots; i++) this._equips[i] = new Game_Item();
        for (let j = 0; j < equips.length; j++) {
            if (j < maxSlots) this._equips[j].setEquip(slots[j] === 1, equips[j]);
        }
        this.releaseUnequippableItems(true);
        this.refresh();
    }

    equipSlots() {
        const slots = [];
        for (let i = 1; i < $dataSystem.equipTypes.length; i++) slots.push(i);
        if (slots.length >= 2 && this.isDualWield()) slots[1] = 1;
        return slots;
    }

    equips() {
        return this._equips.map(item => item.object());
    }

    weapons() {
        return this.equips().filter(item => item && DataManager.isWeapon(item));
    }

    armors() {
        return this.equips().filter(item => item && DataManager.isArmor(item));
    }

    hasWeapon(weapon) {
        return this.weapons().includes(weapon);
    }

    hasArmor(armor) {
        return this.armors().includes(armor);
    }

    isEquipChangeOk(slotId) {
        return !this.isEquipTypeLocked(this.equipSlots()[slotId]) && !this.isEquipTypeSealed(this.equipSlots()[slotId]);
    }

    changeEquip(slotId, item) {
        if (this.tradeItemWithParty(item, this.equips()[slotId]) && (!item || this.equipSlots()[slotId] === item.etypeId)) {
            this._equips[slotId].setObject(item);
            this.refresh();
        }
    }

    forceChangeEquip(slotId, item) {
        this._equips[slotId].setObject(item);
        this.releaseUnequippableItems(true);
        this.refresh();
    }

    tradeItemWithParty(newItem, oldItem) {
        if (newItem && !$gameParty.hasItem(newItem)) return false;
        $gameParty.gainItem(oldItem, 1);
        $gameParty.loseItem(newItem, 1);
        return true;
    }

    changeEquipById(etypeId, itemId) {
        const slotId = etypeId - 1;
        if (this.equipSlots()[slotId] === 1) this.changeEquip(slotId, $dataWeapons[itemId]);
        else this.changeEquip(slotId, $dataArmors[itemId]);
    }

    isEquipped(item) {
        return this.equips().includes(item);
    }

    discardEquip(item) {
        const slotId = this.equips().indexOf(item);
        if (slotId >= 0) this._equips[slotId].setObject(null);
    }

    releaseUnequippableItems(forcing) {
        for (;;) {
            const slots = this.equipSlots();
            const equips = this.equips();
            let changed = false;
            for (let i = 0; i < equips.length; i++) {
                const item = equips[i];
                if (item && (!this.canEquip(item) || item.etypeId !== slots[i])) {
                    if (!forcing) this.tradeItemWithParty(null, item);
                    this._equips[i].setObject(null);
                    changed = true;
                }
            }
            if (!changed) break;
        }
    }

    clearEquipments() {
        const maxSlots = this.equipSlots().length;
        for (let i = 0; i < maxSlots; i++) {
            if (this.isEquipChangeOk(i)) this.changeEquip(i, null);
        }
    }

    optimizeEquipments() {
        const maxSlots = this.equipSlots().length;
        this.clearEquipments();
        for (let i = 0; i < maxSlots; i++) {
            if (this.isEquipChangeOk(i)) this.changeEquip(i, this.bestEquipItem(i));
        }
    }

    bestEquipItem(slotId) {
        const etypeId = this.equipSlots()[slotId];
        const items = $gameParty.equipItems().filter(item => item.etypeId === etypeId && this.canEquip(item));
        let bestItem = null;
        let bestPerformance = -1000;
        for (let i = 0; i < items.length; i++) {
            const performance = this.calcEquipItemPerformance(items[i]);
            if (performance > bestPerformance) {
                bestPerformance = performance;
                bestItem = items[i];
            }
        }
        return bestItem;
    }

    calcEquipItemPerformance(item) {
        return item.params.reduce((a, b) => a + b);
    }

    isSkillWtypeOk(skill) {
        const wtypeId1 = skill.requiredWtypeId1;
        const wtypeId2 = skill.requiredWtypeId2;
        if (
            (wtypeId1 === 0 && wtypeId2 === 0) ||
            (wtypeId1 > 0 && this.isWtypeEquipped(wtypeId1)) ||
            (wtypeId2 > 0 && this.isWtypeEquipped(wtypeId2))
        ) {
            return true;
        }
        return false;
    }

    isWtypeEquipped(wtypeId) {
        return this.weapons().some(weapon => weapon.wtypeId === wtypeId);
    }

    refresh() {
        this.releaseUnequippableItems(false);
        super.refresh();
    }

    hide() {
        super.hide();
        $gameTemp.requestBattleRefresh();
    }

    isActor() {
        return true;
    }

    friendsUnit() {
        return $gameParty;
    }

    opponentsUnit() {
        return $gameTroop;
    }

    index() {
        return $gameParty.members().indexOf(this);
    }

    isBattleMember() {
        return $gameParty.battleMembers().includes(this);
    }

    isFormationChangeOk() {
        return true;
    }

    currentClass() {
        return $dataClasses[this._classId];
    }

    isClass(gameClass) {
        return !!(gameClass && this._classId === gameClass.id);
    }

    skillTypes() {
        const skillTypes = this.addedSkillTypes().sort((a, b) => a - b);
        return skillTypes.filter((x, i, self) => self.indexOf(x) === i);
    }

    skills() {
        const list = [];
        for (const id of this._skills.concat(this.addedSkills())) {
            if (!list.includes($dataSkills[id])) list.push($dataSkills[id]);
        }
        return list;
    }

    usableSkills() {
        return this.skills().filter(skill => this.canUse(skill));
    }

    traitObjects() {
        const objects = super.traitObjects().concat([this.actor(), this.currentClass()]);
        for (const item of this.equips()) {
            if (item) objects.push(item);
        }
        return objects;
    }

    attackElements() {
        const set = super.attackElements();
        if (this.hasNoWeapons() && !set.includes(this.bareHandsElementId())) set.push(this.bareHandsElementId());
        return set;
    }

    hasNoWeapons() {
        return this.weapons().length === 0;
    }

    bareHandsElementId() {
        return 1;
    }

    paramBase(paramId) {
        return this.currentClass().params[paramId][this._level];
    }

    paramPlus(paramId) {
        let value = super.paramPlus(paramId);
        for (const item of this.equips()) {
            if (item) value += item.params[paramId];
        }
        return value;
    }

    attackAnimationId1() {
        if (this.hasNoWeapons()) return this.bareHandsAnimationId();
        const weapons = this.weapons();
        return weapons[0] ? weapons[0].animationId : 0;
    }

    attackAnimationId2() {
        const weapons = this.weapons();
        return weapons[1] ? weapons[1].animationId : 0;
    }

    bareHandsAnimationId() {
        return 1;
    }

    changeExp(exp, show) {
        this._exp[this._classId] = Math.max(exp, 0);
        const lastLevel = this._level;
        const lastSkills = this.skills();
        while (!this.isMaxLevel() && this.currentExp() >= this.nextLevelExp()) this.levelUp();
        while (this.currentExp() < this.currentLevelExp()) this.levelDown();
        if (show && this._level > lastLevel) this.displayLevelUp(this.findNewSkills(lastSkills));
        this.refresh();
    }

    levelUp() {
        this._level++;
        for (const learning of this.currentClass().learnings) {
            if (learning.level === this._level) this.learnSkill(learning.skillId);
        }
    }

    levelDown() {
        this._level--;
    }

    findNewSkills(lastSkills) {
        const newSkills = this.skills();
        for (const lastSkill of lastSkills) newSkills.remove(lastSkill);
        return newSkills;
    }

    displayLevelUp(newSkills) {
        const text = TextManager.levelUp.format(this._name, TextManager.level, this._level);
        $gameMessage.newPage();
        $gameMessage.add(text);
        for (const skill of newSkills) $gameMessage.add(TextManager.obtainSkill.format(skill.name));
    }

    gainExp(exp) {
        const newExp = this.currentExp() + Math.round(exp * this.finalExpRate());
        this.changeExp(newExp, this.shouldDisplayLevelUp());
    }

    finalExpRate() {
        return this.exr * (this.isBattleMember() ? 1 : this.benchMembersExpRate());
    }

    benchMembersExpRate() {
        return $dataSystem.optExtraExp ? 1 : 0;
    }

    shouldDisplayLevelUp() {
        return true;
    }

    changeLevel(level, show) {
        level = level.clamp(1, this.maxLevel());
        this.changeExp(this.expForLevel(level), show);
    }

    learnSkill(skillId) {
        if (!this.isLearnedSkill(skillId)) {
            this._skills.push(skillId);
            this._skills.sort((a, b) => a - b);
        }
    }

    forgetSkill(skillId) {
        this._skills.remove(skillId);
    }

    isLearnedSkill(skillId) {
        return this._skills.includes(skillId);
    }

    hasSkill(skillId) {
        return this.skills().includes($dataSkills[skillId]);
    }

    changeClass(classId, keepExp) {
        if (keepExp) this._exp[classId] = this.currentExp();
        this._classId = classId;
        this._level = 0;
        this.changeExp(this._exp[this._classId] || 0, false);
        this.refresh();
    }

    setCharacterImage(characterName, characterIndex) {
        this._characterName = characterName;
        this._characterIndex = characterIndex;
    }

    setFaceImage(faceName, faceIndex) {
        this._faceName = faceName;
        this._faceIndex = faceIndex;
        $gameTemp.requestBattleRefresh();
    }

    setBattlerImage(battlerName) {
        this._battlerName = battlerName;
    }

    isSpriteVisible() {
        return $gameSystem.isSideView();
    }

    performActionStart(action) {
        super.performActionStart(action);
    }

    performAction(action) {
        super.performAction(action);
        if (action.isAttack()) this.performAttack();
        else if (action.isGuard()) this.requestMotion("guard");
        else if (action.isMagicSkill()) this.requestMotion("spell");
        else if (action.isSkill()) this.requestMotion("skill");
        else if (action.isItem()) this.requestMotion("item");
    }

    performActionEnd() {
        super.performActionEnd();
    }

    performAttack() {
        const weapons = this.weapons();
        const wtypeId = weapons[0] ? weapons[0].wtypeId : 0;
        const attackMotion = $dataSystem.attackMotions[wtypeId];
        if (attackMotion) {
            if (attackMotion.type === 0) this.requestMotion("thrust");
            else if (attackMotion.type === 1) this.requestMotion("swing");
            else if (attackMotion.type === 2) this.requestMotion("missile");
            this.startWeaponAnimation(attackMotion.weaponImageId);
        }
    }

    performDamage() {
        super.performDamage();
        if (this.isSpriteVisible()) this.requestMotion("damage");
        else $gameScreen.startShake(5, 5, 10);
        SoundManager.playActorDamage();
    }

    performEvasion() {
        super.performEvasion();
        this.requestMotion("evade");
    }

    performMagicEvasion() {
        super.performMagicEvasion();
        this.requestMotion("evade");
    }

    performCounter() {
        super.performCounter();
        this.performAttack();
    }

    performCollapse() {
        super.performCollapse();
        if ($gameParty.inBattle()) SoundManager.playActorCollapse();
    }

    performVictory() {
        this.setActionState("done");
        if (this.canMove()) this.requestMotion("victory");
    }

    performEscape() {
        if (this.canMove()) this.requestMotion("escape");
    }

    makeActionList() {
        const list = [];
        const attackAction = new Game_Action(this);
        attackAction.setAttack();
        list.push(attackAction);
        for (const skill of this.usableSkills()) {
            const skillAction = new Game_Action(this);
            skillAction.setSkill(skill.id);
            list.push(skillAction);
        }
        return list;
    }

    makeAutoBattleActions() {
        for (let i = 0; i < this.numActions(); i++) {
            const list = this.makeActionList();
            let maxValue = -Number.MAX_VALUE;
            for (const action of list) {
                const value = action.evaluate();
                if (value > maxValue) {
                    maxValue = value;
                    this.setAction(i, action);
                }
            }
        }
        this.setActionState("waiting");
    }

    makeConfusionActions() {
        for (let i = 0; i < this.numActions(); i++) this.action(i).setConfusion();
        this.setActionState("waiting");
    }

    makeActions() {
        super.makeActions();
        if (this.numActions() > 0) this.setActionState("undecided");
        else this.setActionState("waiting");
        if (this.isAutoBattle()) this.makeAutoBattleActions();
        else if (this.isConfused()) this.makeConfusionActions();
    }

    onPlayerWalk() {
        this.clearResult();
        this.checkFloorEffect();
        if ($gamePlayer.isNormal()) {
            this.turnEndOnMap();
            for (const state of this.states()) this.updateStateSteps(state);
            this.showAddedStates();
            this.showRemovedStates();
        }
    }

    updateStateSteps(state) {
        if (state.removeByWalking) {
            if (this._stateSteps[state.id] > 0) {
                if (--this._stateSteps[state.id] === 0) this.removeState(state.id);
            }
        }
    }

    showAddedStates() {
        for (const state of this.result().addedStateObjects()) {
            if (state.message1) $gameMessage.add(state.message1.format(this._name));
        }
    }

    showRemovedStates() {
        for (const state of this.result().removedStateObjects()) {
            if (state.message4) $gameMessage.add(state.message4.format(this._name));
        }
    }

    stepsForTurn() {
        return 20;
    }

    turnEndOnMap() {
        if ($gameParty.steps() % this.stepsForTurn() === 0) {
            this.onTurnEnd();
            if (this.result().hpDamage > 0) this.performMapDamage();
        }
    }

    checkFloorEffect() {
        if ($gamePlayer.isOnDamageFloor()) this.executeFloorDamage();
    }

    executeFloorDamage() {
        const floorDamage = Math.floor(this.basicFloorDamage() * this.fdr);
        const realDamage = Math.min(floorDamage, this.maxFloorDamage());
        this.gainHp(-realDamage);
        if (realDamage > 0) this.performMapDamage();
    }

    basicFloorDamage() {
        return 10;
    }

    maxFloorDamage() {
        return $dataSystem.optFloorDeath ? this.hp : Math.max(this.hp - 1, 0);
    }

    performMapDamage() {
        if (!$gameParty.inBattle()) $gameScreen.startFlashForDamage();
    }

    clearActions() {
        super.clearActions();
        this._actionInputIndex = 0;
    }

    inputtingAction() {
        return this.action(this._actionInputIndex);
    }

    selectNextCommand() {
        if (this._actionInputIndex < this.numActions() - 1) {
            this._actionInputIndex++;
            return true;
        }
        return false;
    }

    selectPreviousCommand() {
        if (this._actionInputIndex > 0) {
            this._actionInputIndex--;
            return true;
        }
        return false;
    }

    lastSkill() {
        return $gameParty.inBattle() ? this.lastBattleSkill() : this.lastMenuSkill();
    }

    lastMenuSkill() {
        return this._lastMenuSkill.object();
    }

    setLastMenuSkill(skill) {
        this._lastMenuSkill.setObject(skill);
    }

    lastBattleSkill() {
        return this._lastBattleSkill.object();
    }

    setLastBattleSkill(skill) {
        this._lastBattleSkill.setObject(skill);
    }

    lastCommandSymbol() {
        return this._lastCommandSymbol;
    }

    setLastCommandSymbol(symbol) {
        this._lastCommandSymbol = symbol;
    }

    testEscape(item) {
        return item.effects.some(effect => effect && effect.code === Game_Action.EFFECT_SPECIAL);
    }

    meetsUsableItemConditions(item) {
        if ($gameParty.inBattle()) {
            if (!BattleManager.canEscape() && this.testEscape(item)) return false;
        }
        return super.meetsUsableItemConditions(item);
    }

    onEscapeFailure() {
        if (BattleManager.isTpb()) this.applyTpbPenalty();
        this.setActionState("undecided");
        this.requestMotionRefresh();
    }
};

//-----------------------------------------------------------------------------
// Game_Enemy

var Game_Enemy = class extends Game_Battler {
    initialize(enemyId, x, y) {
        super.initialize();
        this.setup(enemyId, x, y);
    }

    initMembers() {
        super.initMembers();
        this._enemyId = 0;
        this._letter = "";
        this._plural = false;
        this._screenX = 0;
        this._screenY = 0;
    }

    setup(enemyId, x, y) {
        this._enemyId = enemyId;
        this._screenX = x;
        this._screenY = y;
        this.recoverAll();
    }

    isEnemy() {
        return true;
    }
    friendsUnit() {
        return $gameTroop;
    }
    opponentsUnit() {
        return $gameParty;
    }
    index() {
        return $gameTroop.members().indexOf(this);
    }
    isBattleMember() {
        return this.index() >= 0;
    }
    enemyId() {
        return this._enemyId;
    }
    enemy() {
        return $dataEnemies[this._enemyId];
    }
    traitObjects() {
        return super.traitObjects().concat(this.enemy());
    }
    paramBase(paramId) {
        return this.enemy().params[paramId];
    }
    exp() {
        return this.enemy().exp;
    }
    gold() {
        return this.enemy().gold;
    }

    makeDropItems() {
        const rate = this.dropItemRate();
        return this.enemy().dropItems.reduce((r, di) => {
            if (di.kind > 0 && Math.random() * di.denominator < rate) return r.concat(this.itemObject(di.kind, di.dataId));
            return r;
        }, []);
    }

    dropItemRate() {
        return $gameParty.hasDropItemDouble() ? 2 : 1;
    }

    itemObject(kind, dataId) {
        if (kind === 1) return $dataItems[dataId];
        if (kind === 2) return $dataWeapons[dataId];
        if (kind === 3) return $dataArmors[dataId];
        return null;
    }

    isSpriteVisible() {
        return true;
    }
    screenX() {
        return this._screenX;
    }
    screenY() {
        return this._screenY;
    }
    battlerName() {
        return this.enemy().battlerName;
    }
    battlerHue() {
        return this.enemy().battlerHue;
    }
    originalName() {
        return this.enemy().name;
    }
    name() {
        return this.originalName() + (this._plural ? this._letter : "");
    }
    isLetterEmpty() {
        return this._letter === "";
    }
    setLetter(letter) {
        this._letter = letter;
    }
    setPlural(plural) {
        this._plural = plural;
    }

    performActionStart(action) {
        super.performActionStart(action);
        this.requestEffect("whiten");
    }

    performAction(action) {
        super.performAction(action);
    }

    performActionEnd() {
        super.performActionEnd();
    }

    performDamage() {
        super.performDamage();
        SoundManager.playEnemyDamage();
        this.requestEffect("blink");
    }

    performCollapse() {
        super.performCollapse();
        switch (this.collapseType()) {
            case 0:
                this.requestEffect("collapse");
                SoundManager.playEnemyCollapse();
                break;
            case 1:
                this.requestEffect("bossCollapse");
                SoundManager.playBossCollapse1();
                break;
            case 2:
                this.requestEffect("instantCollapse");
                break;
        }
    }

    transform(enemyId) {
        const name = this.originalName();
        this._enemyId = enemyId;
        if (this.originalName() !== name) {
            this._letter = "";
            this._plural = false;
        }
        this.refresh();
        if (this.numActions() > 0) this.makeActions();
    }

    meetsCondition(action) {
        const param1 = action.conditionParam1;
        const param2 = action.conditionParam2;
        switch (action.conditionType) {
            case 1:
                return this.meetsTurnCondition(param1, param2);
            case 2:
                return this.meetsHpCondition(param1, param2);
            case 3:
                return this.meetsMpCondition(param1, param2);
            case 4:
                return this.meetsStateCondition(param1);
            case 5:
                return this.meetsPartyLevelCondition(param1);
            case 6:
                return this.meetsSwitchCondition(param1);
            default:
                return true;
        }
    }

    meetsTurnCondition(param1, param2) {
        const n = this.turnCount();
        if (param2 === 0) return n === param1;
        return n > 0 && n >= param1 && n % param2 === param1 % param2;
    }

    meetsHpCondition(param1, param2) {
        return this.hpRate() >= param1 && this.hpRate() <= param2;
    }

    meetsMpCondition(param1, param2) {
        return this.mpRate() >= param1 && this.mpRate() <= param2;
    }

    meetsStateCondition(param) {
        return this.isStateAffected(param);
    }

    meetsPartyLevelCondition(param) {
        return $gameParty.highestLevel() >= param;
    }

    meetsSwitchCondition(param) {
        return $gameSwitches.value(param);
    }

    isActionValid(action) {
        return this.meetsCondition(action) && this.canUse($dataSkills[action.skillId]);
    }

    selectAction(actionList, ratingZero) {
        const sum = actionList.reduce((r, a) => r + a.rating - ratingZero, 0);
        if (sum > 0) {
            let value = Math.randomInt(sum);
            for (const action of actionList) {
                value -= action.rating - ratingZero;
                if (value < 0) return action;
            }
        }
        return null;
    }

    selectAllActions(actionList) {
        const ratingMax = Math.max(...actionList.map(a => a.rating));
        const ratingZero = ratingMax - 3;
        actionList = actionList.filter(a => a.rating > ratingZero);
        for (let i = 0; i < this.numActions(); i++) {
            this.action(i).setEnemyAction(this.selectAction(actionList, ratingZero));
        }
    }

    makeActions() {
        super.makeActions();
        if (this.numActions() > 0) {
            const actionList = this.enemy().actions.filter(a => this.isActionValid(a));
            if (actionList.length > 0) this.selectAllActions(actionList);
        }
        this.setActionState("waiting");
    }
};

//-----------------------------------------------------------------------------
// Game_Actors

var Game_Actors = class {
    constructor(...args) {
        this.initialize(...args);
    }
    initialize() {
        this._data = [];
    }
    actor(actorId) {
        if ($dataActors[actorId]) {
            if (!this._data[actorId]) this._data[actorId] = new Game_Actor(actorId);
            return this._data[actorId];
        }
        return null;
    }
};

//-----------------------------------------------------------------------------
// Game_Unit

var Game_Unit = class {
    constructor(...args) {
        this.initialize(...args);
    }

    initialize() {
        this._inBattle = false;
    }

    inBattle() {
        return this._inBattle;
    }

    members() {
        return [];
    }

    aliveMembers() {
        return this.members().filter(member => member.isAlive());
    }

    deadMembers() {
        return this.members().filter(member => member.isDead());
    }

    movableMembers() {
        return this.members().filter(member => member.canMove());
    }

    clearActions() {
        for (const member of this.members()) member.clearActions();
    }

    agility() {
        const members = this.members();
        const sum = members.reduce((r, member) => r + member.agi, 0);
        return Math.max(1, sum / Math.max(1, members.length));
    }

    tgrSum() {
        return this.aliveMembers().reduce((r, member) => r + member.tgr, 0);
    }

    randomTarget() {
        let tgrRand = Math.random() * this.tgrSum();
        let target = null;
        for (const member of this.aliveMembers()) {
            tgrRand -= member.tgr;
            if (tgrRand <= 0 && !target) target = member;
        }
        return target;
    }

    randomDeadTarget() {
        const members = this.deadMembers();
        return members.length ? members[Math.randomInt(members.length)] : null;
    }

    smoothTarget(index) {
        const member = this.members()[Math.max(0, index)];
        return member && member.isAlive() ? member : this.aliveMembers()[0];
    }

    smoothDeadTarget(index) {
        const member = this.members()[Math.max(0, index)];
        return member && member.isDead() ? member : this.deadMembers()[0];
    }

    clearResults() {
        for (const member of this.members()) member.clearResult();
    }

    onBattleStart(advantageous) {
        for (const member of this.members()) member.onBattleStart(advantageous);
        this._inBattle = true;
    }

    onBattleEnd() {
        this._inBattle = false;
        for (const member of this.members()) member.onBattleEnd();
    }

    makeActions() {
        for (const member of this.members()) member.makeActions();
    }

    select(activeMember) {
        for (const member of this.members()) {
            if (member === activeMember) member.select();
            else member.deselect();
        }
    }

    isAllDead() {
        return this.aliveMembers().length === 0;
    }

    substituteBattler() {
        for (const member of this.members()) {
            if (member.isSubstitute()) return member;
        }
        return null;
    }

    tpbBaseSpeed() {
        const members = this.members();
        return Math.max(...members.map(member => member.tpbBaseSpeed()));
    }

    tpbReferenceTime() {
        return BattleManager.isActiveTpb() ? 240 : 60;
    }

    updateTpb() {
        for (const member of this.members()) member.updateTpb();
    }
};

//-----------------------------------------------------------------------------
// Game_Party

var Game_Party = class extends Game_Unit {
    initialize() {
        super.initialize();
        this._gold = 0;
        this._steps = 0;
        this._lastItem = new Game_Item();
        this._menuActorId = 0;
        this._targetActorId = 0;
        this._actors = [];
        this.initAllItems();
    }

    initAllItems() {
        this._items = {};
        this._weapons = {};
        this._armors = {};
    }

    exists() {
        return this._actors.length > 0;
    }

    size() {
        return this.members().length;
    }

    isEmpty() {
        return this.size() === 0;
    }

    members() {
        return this.inBattle() ? this.battleMembers() : this.allMembers();
    }

    allMembers() {
        return this._actors.map(id => $gameActors.actor(id));
    }

    battleMembers() {
        return this.allBattleMembers().filter(actor => actor.isAppeared());
    }

    hiddenBattleMembers() {
        return this.allBattleMembers().filter(actor => actor.isHidden());
    }

    allBattleMembers() {
        return this.allMembers().slice(0, this.maxBattleMembers());
    }

    maxBattleMembers() {
        return 4;
    }

    leader() {
        return this.battleMembers()[0];
    }

    removeInvalidMembers() {
        for (const actorId of [...this._actors]) {
            if (!$dataActors[actorId]) this._actors.remove(actorId);
        }
    }

    reviveBattleMembers() {
        for (const actor of this.battleMembers()) {
            if (actor.isDead()) actor.setHp(1);
        }
    }

    items() {
        return Object.keys(this._items).map(id => $dataItems[id]);
    }

    weapons() {
        return Object.keys(this._weapons).map(id => $dataWeapons[id]);
    }

    armors() {
        return Object.keys(this._armors).map(id => $dataArmors[id]);
    }

    equipItems() {
        return this.weapons().concat(this.armors());
    }

    allItems() {
        return this.items().concat(this.equipItems());
    }

    itemContainer(item) {
        if (!item) return null;
        if (DataManager.isItem(item)) return this._items;
        if (DataManager.isWeapon(item)) return this._weapons;
        if (DataManager.isArmor(item)) return this._armors;
        return null;
    }

    setupStartingMembers() {
        this._actors = [];
        for (const actorId of $dataSystem.partyMembers) {
            if ($gameActors.actor(actorId)) this._actors.push(actorId);
        }
    }

    name() {
        const numBattleMembers = this.battleMembers().length;
        if (numBattleMembers === 0) return "";
        if (numBattleMembers === 1) return this.leader().name();
        return TextManager.partyName.format(this.leader().name());
    }

    setupBattleTest() {
        this.setupBattleTestMembers();
        this.setupBattleTestItems();
    }

    setupBattleTestMembers() {
        for (const battler of $dataSystem.testBattlers) {
            const actor = $gameActors.actor(battler.actorId);
            if (actor) {
                actor.changeLevel(battler.level, false);
                actor.initEquips(battler.equips);
                actor.recoverAll();
                this.addActor(battler.actorId);
            }
        }
    }

    setupBattleTestItems() {
        for (const item of $dataItems) {
            if (item && item.name.length > 0) this.gainItem(item, this.maxItems(item));
        }
    }

    highestLevel() {
        return Math.max(...this.members().map(actor => actor.level));
    }

    addActor(actorId) {
        if (!this._actors.includes(actorId)) {
            this._actors.push(actorId);
            $gamePlayer.refresh();
            $gameMap.requestRefresh();
            $gameTemp.requestBattleRefresh();
            if (this.inBattle()) {
                const actor = $gameActors.actor(actorId);
                if (this.battleMembers().includes(actor)) actor.onBattleStart();
            }
        }
    }

    removeActor(actorId) {
        if (this._actors.includes(actorId)) {
            const actor = $gameActors.actor(actorId);
            const wasBattleMember = this.battleMembers().includes(actor);
            this._actors.remove(actorId);
            $gamePlayer.refresh();
            $gameMap.requestRefresh();
            $gameTemp.requestBattleRefresh();
            if (this.inBattle() && wasBattleMember) actor.onBattleEnd();
        }
    }

    gold() {
        return this._gold;
    }

    gainGold(amount) {
        this._gold = (this._gold + amount).clamp(0, this.maxGold());
    }

    loseGold(amount) {
        this.gainGold(-amount);
    }

    maxGold() {
        return 99999999;
    }

    steps() {
        return this._steps;
    }

    increaseSteps() {
        this._steps++;
    }

    numItems(item) {
        const container = this.itemContainer(item);
        return container ? container[item.id] || 0 : 0;
    }

    maxItems(/* item */) {
        return 99;
    }

    hasMaxItems(item) {
        return this.numItems(item) >= this.maxItems(item);
    }

    hasItem(item, includeEquip) {
        if (this.numItems(item) > 0) return true;
        if (includeEquip && this.isAnyMemberEquipped(item)) return true;
        return false;
    }

    isAnyMemberEquipped(item) {
        return this.members().some(actor => actor.equips().includes(item));
    }

    gainItem(item, amount, includeEquip) {
        const container = this.itemContainer(item);
        if (container) {
            const lastNumber = this.numItems(item);
            const newNumber = lastNumber + amount;
            container[item.id] = newNumber.clamp(0, this.maxItems(item));
            if (container[item.id] === 0) delete container[item.id];
            if (includeEquip && newNumber < 0) this.discardMembersEquip(item, -newNumber);
            $gameMap.requestRefresh();
        }
    }

    discardMembersEquip(item, amount) {
        let n = amount;
        for (const actor of this.members()) {
            while (n > 0 && actor.isEquipped(item)) {
                actor.discardEquip(item);
                n--;
            }
        }
    }

    loseItem(item, amount, includeEquip) {
        this.gainItem(item, -amount, includeEquip);
    }

    consumeItem(item) {
        if (DataManager.isItem(item) && item.consumable) this.loseItem(item, 1);
    }

    canUse(item) {
        return this.members().some(actor => actor.canUse(item));
    }

    canInput() {
        for (const actor of this.members()) {
            if (actor.canInput()) return true;
        }
        return false;
    }

    isAllDead() {
        if (super.isAllDead()) return this.inBattle() || !this.isEmpty();
        return false;
    }

    isEscaped() {
        return this.isAllDead() && this.hiddenBattleMembers().length > 0;
    }

    onPlayerWalk() {
        for (const actor of this.members()) actor.onPlayerWalk();
    }

    menuActor() {
        let actor = $gameActors.actor(this._menuActorId);
        if (!this.members().includes(actor)) actor = this.members()[0];
        return actor;
    }

    setMenuActor(actor) {
        this._menuActorId = actor.actorId();
    }

    makeMenuActorNext() {
        let index = this.members().indexOf(this.menuActor());
        if (index >= 0) {
            index = (index + 1) % this.members().length;
            this.setMenuActor(this.members()[index]);
        } else {
            this.setMenuActor(this.members()[0]);
        }
    }

    makeMenuActorPrevious() {
        let index = this.members().indexOf(this.menuActor());
        if (index >= 0) {
            index = (index + this.members().length - 1) % this.members().length;
            this.setMenuActor(this.members()[index]);
        } else {
            this.setMenuActor(this.members()[0]);
        }
    }

    targetActor() {
        let actor = $gameActors.actor(this._targetActorId);
        if (!this.members().includes(actor)) actor = this.members()[0];
        return actor;
    }

    setTargetActor(actor) {
        this._targetActorId = actor.actorId();
    }

    lastItem() {
        return this._lastItem.object();
    }

    setLastItem(item) {
        this._lastItem.setObject(item);
    }

    swapOrder(index1, index2) {
        const temp = this._actors[index1];
        this._actors[index1] = this._actors[index2];
        this._actors[index2] = temp;
        $gamePlayer.refresh();
    }

    charactersForSavefile() {
        return this.battleMembers().map(actor => [actor.characterName(), actor.characterIndex()]);
    }

    facesForSavefile() {
        return this.battleMembers().map(actor => [actor.faceName(), actor.faceIndex()]);
    }

    partyAbility(abilityId) {
        return this.battleMembers().some(actor => actor.partyAbility(abilityId));
    }

    hasEncounterHalf() {
        return this.partyAbility(Game_Party.ABILITY_ENCOUNTER_HALF);
    }
    hasEncounterNone() {
        return this.partyAbility(Game_Party.ABILITY_ENCOUNTER_NONE);
    }
    hasCancelSurprise() {
        return this.partyAbility(Game_Party.ABILITY_CANCEL_SURPRISE);
    }
    hasRaisePreemptive() {
        return this.partyAbility(Game_Party.ABILITY_RAISE_PREEMPTIVE);
    }
    hasGoldDouble() {
        return this.partyAbility(Game_Party.ABILITY_GOLD_DOUBLE);
    }
    hasDropItemDouble() {
        return this.partyAbility(Game_Party.ABILITY_DROP_ITEM_DOUBLE);
    }

    ratePreemptive(troopAgi) {
        let rate = this.agility() >= troopAgi ? 0.05 : 0.03;
        if (this.hasRaisePreemptive()) rate *= 4;
        return rate;
    }

    rateSurprise(troopAgi) {
        let rate = this.agility() >= troopAgi ? 0.03 : 0.05;
        if (this.hasCancelSurprise()) rate = 0;
        return rate;
    }

    performVictory() {
        for (const actor of this.members()) actor.performVictory();
    }

    performEscape() {
        for (const actor of this.members()) actor.performEscape();
    }

    removeBattleStates() {
        for (const actor of this.members()) actor.removeBattleStates();
    }

    requestMotionRefresh() {
        for (const actor of this.members()) actor.requestMotionRefresh();
    }

    onEscapeFailure() {
        for (const actor of this.members()) actor.onEscapeFailure();
    }
};

Game_Party.ABILITY_ENCOUNTER_HALF = 0;
Game_Party.ABILITY_ENCOUNTER_NONE = 1;
Game_Party.ABILITY_CANCEL_SURPRISE = 2;
Game_Party.ABILITY_RAISE_PREEMPTIVE = 3;
Game_Party.ABILITY_GOLD_DOUBLE = 4;
Game_Party.ABILITY_DROP_ITEM_DOUBLE = 5;

//-----------------------------------------------------------------------------
// Game_Troop

var Game_Troop = class extends Game_Unit {
    initialize() {
        super.initialize();
        this._interpreter = new Game_Interpreter();
        this.clear();
    }

    isEventRunning() {
        return this._interpreter.isRunning();
    }

    updateInterpreter() {
        this._interpreter.update();
    }

    turnCount() {
        return this._turnCount;
    }

    members() {
        return this._enemies;
    }

    clear() {
        this._interpreter.clear();
        this._troopId = 0;
        this._eventFlags = {};
        this._enemies = [];
        this._turnCount = 0;
        this._namesCount = {};
    }

    troop() {
        return $dataTroops[this._troopId];
    }

    setup(troopId) {
        this.clear();
        this._troopId = troopId;
        this._enemies = [];
        for (const member of this.troop().members) {
            if ($dataEnemies[member.enemyId]) {
                const enemy = new Game_Enemy(member.enemyId, member.x, member.y);
                if (member.hidden) enemy.hide();
                this._enemies.push(enemy);
            }
        }
        this.makeUniqueNames();
    }

    makeUniqueNames() {
        const table = this.letterTable();
        for (const enemy of this.members()) {
            if (enemy.isAlive() && enemy.isLetterEmpty()) {
                const name = enemy.originalName();
                const n = this._namesCount[name] || 0;
                enemy.setLetter(table[n % table.length]);
                this._namesCount[name] = n + 1;
            }
        }
        this.updatePluralFlags();
    }

    updatePluralFlags() {
        for (const enemy of this.members()) {
            const name = enemy.originalName();
            if (this._namesCount[name] >= 2) enemy.setPlural(true);
        }
    }

    letterTable() {
        return $gameSystem.isCJK() ? Game_Troop.LETTER_TABLE_FULL : Game_Troop.LETTER_TABLE_HALF;
    }

    enemyNames() {
        const names = [];
        for (const enemy of this.members()) {
            const name = enemy.originalName();
            if (enemy.isAlive() && !names.includes(name)) names.push(name);
        }
        return names;
    }

    meetsConditions(page) {
        const c = page.conditions;
        if (!c.turnEnding && !c.turnValid && !c.enemyValid && !c.actorValid && !c.switchValid) return false;
        if (c.turnEnding) {
            if (!BattleManager.isTurnEnd()) return false;
        }
        if (c.turnValid) {
            const n = this._turnCount;
            const a = c.turnA;
            const b = c.turnB;
            if (b === 0 && n !== a) return false;
            if (b > 0 && (n < 1 || n < a || n % b !== a % b)) return false;
        }
        if (c.enemyValid) {
            const enemy = $gameTroop.members()[c.enemyIndex];
            if (!enemy || enemy.hpRate() * 100 > c.enemyHp) return false;
        }
        if (c.actorValid) {
            const actor = $gameActors.actor(c.actorId);
            if (!actor || actor.hpRate() * 100 > c.actorHp) return false;
        }
        if (c.switchValid) {
            if (!$gameSwitches.value(c.switchId)) return false;
        }
        return true;
    }

    setupBattleEvent() {
        if (!this._interpreter.isRunning()) {
            if (this._interpreter.setupReservedCommonEvent()) return;
            const pages = this.troop().pages;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (this.meetsConditions(page) && !this._eventFlags[i]) {
                    this._interpreter.setup(page.list);
                    if (page.span <= 1) this._eventFlags[i] = true;
                    break;
                }
            }
        }
    }

    increaseTurn() {
        const pages = this.troop().pages;
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            if (page.span === 1) this._eventFlags[i] = false;
        }
        this._turnCount++;
    }

    expTotal() {
        return this.deadMembers().reduce((r, enemy) => r + enemy.exp(), 0);
    }

    goldTotal() {
        const members = this.deadMembers();
        return members.reduce((r, enemy) => r + enemy.gold(), 0) * this.goldRate();
    }

    goldRate() {
        return $gameParty.hasGoldDouble() ? 2 : 1;
    }

    makeDropItems() {
        const members = this.deadMembers();
        return members.reduce((r, enemy) => r.concat(enemy.makeDropItems()), []);
    }

    isTpbTurnEnd() {
        const members = this.members();
        const turnMax = Math.max(...members.map(member => member.turnCount()));
        return turnMax > this._turnCount;
    }
};

// prettier-ignore
Game_Troop.LETTER_TABLE_HALF = [
    " A"," B"," C"," D"," E"," F"," G"," H"," I"," J"," K"," L"," M",
    " N"," O"," P"," Q"," R"," S"," T"," U"," V"," W"," X"," Y"," Z"
];
// prettier-ignore
Game_Troop.LETTER_TABLE_FULL = [
    "Ａ","Ｂ","Ｃ","Ｄ","Ｅ","Ｆ","Ｇ","Ｈ","Ｉ","Ｊ","Ｋ","Ｌ","Ｍ",
    "Ｎ","Ｏ","Ｐ","Ｑ","Ｒ","Ｓ","Ｔ","Ｕ","Ｖ","Ｗ","Ｘ","Ｙ","Ｚ"
];
