import {FILTER} from "../filters.mjs";
import {MODULE} from "../constants.mjs";
import {BabonusWorkshop} from "../applications/babonus.mjs";

/** Utility class for the various roll hooks. */
export class RollHooks {

  /* When you force a saving throw... */
  static preDisplayCard(item, chatData) {
    if (!item.hasSave) return;

    // Get bonuses:
    const bonuses = FILTER.itemCheck(item, "save", {spellLevel: item.system.level});
    if (!bonuses.length) return;
    const rollConfig = {data: item.getRollData()};
    RollHooks._addTargetData(rollConfig);
    const totalBonus = bonuses.reduce((acc, bab) => {
      return acc + dnd5e.utils.simplifyBonus(bab.bonuses.bonus, rollConfig.data);
    }, 0);

    // Get all buttons:
    const div = document.createElement("DIV");
    div.innerHTML = chatData.content;
    const saveButtons = div.querySelectorAll("button[data-action='save']");

    const dc = Math.max(1, item.system.save.dc + totalBonus) || "";
    const actionSave = game.i18n.localize("DND5E.ActionSave");
    for (const button of saveButtons) {
      button.innerText = `${actionSave} ${game.i18n.format("DND5E.SaveDC", {
        dc, ability: CONFIG.DND5E.abilities[button.dataset.ability]?.label ?? ""
      })}`;
    }
    chatData.flags[MODULE] = {saveDC: dc};
    chatData.content = div.innerHTML;
  }

  /** When you make an attack roll... */
  static preRollAttack(item, rollConfig) {
    // get bonuses:
    const spellLevel = rollConfig.data.item.level;
    const bonuses = FILTER.itemCheck(item, "attack", {spellLevel});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // Gather up all bonuses.
    const optionals = [];
    const mods = {critical: 0, fumble: 0};
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      const valid = !!bonus && Roll.validate(bonus);
      if (valid) {
        if (bab.isOptional) optionals.push(bab);
        else rollConfig.parts.push(bonus);
      }
      mods.critical += dnd5e.utils.simplifyBonus(bab.bonuses.criticalRange, rollConfig.data);
      mods.fumble += dnd5e.utils.simplifyBonus(bab.bonuses.fumbleRange, rollConfig.data);
    }

    // Add parts.
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals, actor: item.actor, spellLevel, item, bonuses
    });

    // Add modifiers to raise/lower the criticial and fumble.
    rollConfig.critical = (rollConfig.critical ?? 20) - mods.critical;
    rollConfig.fumble = (rollConfig.fumble ?? 1) + mods.fumble;

    // Don't set crit to below 1, and don't set fumble to below 1 unless explicitly -Infinity.
    if (rollConfig.critical < 1) rollConfig.critical = 1;
    if ((rollConfig.fumble < 1) && (rollConfig.fumble !== -Infinity)) rollConfig.fumble = 1;
  }

  /** When you make a damage roll... */
  static preRollDamage(item, rollConfig) {
    // get bonus:
    const spellLevel = rollConfig.data.item.level;
    const bonuses = FILTER.itemCheck(item, "damage", {spellLevel});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // add to parts:
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals, actor: item.actor, spellLevel, item, bonuses
    });

    // add to crit bonus dice:
    rollConfig.criticalBonusDice = bonuses.reduce((acc, bab) => {
      return acc + dnd5e.utils.simplifyBonus(bab.bonuses.criticalBonusDice, rollConfig.data);
    }, rollConfig.criticalBonusDice ?? 0);
    if (rollConfig.criticalBonusDice < 0) rollConfig.criticalBonusDice = 0;

    // add to crit damage:
    rollConfig.criticalBonusDamage = bonuses.reduce((acc, bab) => {
      const bonus = bab.bonuses.criticalBonusDamage;
      const valid = !!bonus && Roll.validate(bonus);
      if (!valid) return acc;
      return `${acc} + ${bonus}`;
    }, rollConfig.criticalBonusDamage ?? "");
  }

  /** When you roll a death saving throw... */
  static preRollDeathSave(actor, rollConfig) {
    // get bonus:
    const bonuses = FILTER.throwCheck(actor, "death", {});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // Gather up all bonuses.
    const death = {targetValue: 0, critical: 0};
    const optionals = [];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      const valid = !!bonus && Roll.validate(bonus);
      if (valid) {
        if (bab.isOptional) optionals.push(bab);
        else rollConfig.parts.push(bonus);
      }
      death.targetValue += dnd5e.utils.simplifyBonus(bab.bonuses.deathSaveTargetValue, rollConfig.data);
      death.critical += dnd5e.utils.simplifyBonus(bab.bonuses.deathSaveCritical, rollConfig.data);
    }

    // Add parts.
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});

    // Add modifiers to raise/lower the target value and crtical threshold.
    rollConfig.targetValue = (rollConfig.targetValue ?? 10) - death.targetValue;
    rollConfig.critical = (rollConfig.critical ?? 20) - death.critical;
  }

  /** When you roll a saving throw... */
  static preRollAbilitySave(actor, rollConfig, abilityId) {
    // get bonus:
    const bonuses = FILTER.throwCheck(actor, abilityId, {isConcSave: rollConfig.isConcSave});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // add to parts:
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
  }

  /** When you roll an ability check... */
  static preRollAbilityTest(actor, rollConfig, abilityId) {
    const bonuses = FILTER.testCheck(actor, abilityId);
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
  }

  /** When you roll a skill... */
  static preRollSkill(actor, rollConfig, skillId) {
    const abilityId = actor.system.skills[skillId].ability; // TODO: fix in 2.3.0
    const bonuses = FILTER.testCheck(actor, abilityId, {skillId});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
  }

  /** When you roll a tool check... */
  static preRollToolCheck(actor, rollConfig, toolId) {
    const abilityId = rollConfig.ability || rollConfig.data.defaultAbility; // TODO: fix in 2.3.0
    const bonuses = FILTER.testCheck(actor, abilityId, {toolId});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
  }

  /** When you roll a hit die... */
  static preRollHitDie(actor, rollConfig, denomination) {
    const bonuses = FILTER.hitDieCheck(actor);
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    const denom = bonuses.reduce((acc, bab) => {
      const bonus = bab.bonuses.bonus;
      const valid = !!bonus && Roll.validate(bonus);
      if (!valid) return acc;
      return `${acc} + ${bonus}`;
    }, denomination);
    rollConfig.formula = rollConfig.formula.replace(denomination, denom);
  }

  /** Inject babonus data on created templates if they have an associated item. */
  static preCreateMeasuredTemplate(templateDoc) {
    const item = fromUuidSync(templateDoc.flags.dnd5e?.origin ?? "");
    if (!item?.actor) return;
    const tokenDocument = item.actor.token ?? item.actor.getActiveTokens(false, true)[0];
    const disp = tokenDocument?.disposition ?? item.actor.prototypeToken.disposition;

    const bonusData = BabonusWorkshop._getCollection(item).reduce((acc, bab) => {
      if (bab.isTemplateAura) acc[`flags.${MODULE}.bonuses.${bab.id}`] = bab.toObject();
      return acc;
    }, {});
    if (foundry.utils.isEmpty(bonusData)) return;
    bonusData["flags.babonus.templateDisposition"] = disp;
    templateDoc.updateSource(bonusData);
  }

  /**
   * Gather optional bonuses and put non-optional bonuses into the roll config.
   * Mutates rollConfig.
   * @param {Babonus[]} bonuses     An array of babonuses to apply.
   * @param {object} rollConfig     The roll config for this roll.
   * @returns {string[]}            An array of bonuses to modify a roll.
   */
  static _getParts(bonuses, rollConfig) {
    return bonuses.reduce((acc, bab) => {
      const bonus = bab.bonuses.bonus;
      if (!bonus || !Roll.validate(bonus)) return acc;
      if (bab.isOptional) acc.push(bab);
      else rollConfig.parts.push(bonus);
      return acc;
    }, []);
  }

  /**
   * Add the target's roll data to the actor's roll data.
   * Mutates rollConfig.
   * @param {object} rollConfig     The roll config for this roll.
   */
  static _addTargetData(rollConfig) {
    const target = game.user.targets.first();
    if (target?.actor) rollConfig.data.target = target.actor.getRollData();
  }
}
