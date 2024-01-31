import {FilterManager} from "../filter-manager.mjs";
import {MODULE, SETTINGS} from "../constants.mjs";
import {BabonusWorkshop} from "../applications/babonus-workshop.mjs";

/** Utility class for the various roll hooks. */
export class RollHooks {

  /**
   * When you force a saving throw...
   * @param {Item5e} item         The item whose card is being displayed.
   * @param {object} chatData     The chat data for the display.
   */
  static preDisplayCard(item, chatData) {
    if (!item.hasSave) return;

    // Get bonuses:
    const bonuses = FilterManager.itemCheck(item, "save", {spellLevel: item.system.level});
    if (!bonuses.length) return;
    const rollConfig = {data: item.getRollData({deterministic: true})};
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
    chatData.flags[MODULE.ID] = {saveDC: dc};
    chatData.content = div.innerHTML;
  }

  /**
   * When you make an attack roll...
   * @param {Item5e} [item]         The item that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   */
  static preRollAttack(item, rollConfig) {
    if (!item) return;
    // get bonuses:
    const spellLevel = rollConfig.data.item.level;
    const bonuses = FilterManager.itemCheck(item, "attack", {spellLevel});
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
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {
      optionals, actor: item.actor, spellLevel, item, bonuses
    });

    // Add modifiers to raise/lower the criticial and fumble.
    rollConfig.critical = (rollConfig.critical ?? 20) - mods.critical;
    rollConfig.fumble = (rollConfig.fumble ?? 1) + mods.fumble;

    // Don't set crit to below 1, and don't set fumble to below 1 unless allowed.
    if (rollConfig.critical < 1) rollConfig.critical = 1;
    if ((rollConfig.fumble < 1) && !game.settings.get(MODULE.ID, SETTINGS.FUMBLE)) rollConfig.fumble = 1;
  }

  /**
   * When you make a damage roll...
   * @param {Item5e} [item]         The item that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   */
  static preRollDamage(item, rollConfig) {
    if (!item) return;
    // get bonus:
    const spellLevel = rollConfig.data.item.level;
    const bonuses = FilterManager.itemCheck(item, "damage", {spellLevel});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // add to parts:
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {
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

    // Modify the parts if there are modifiers in the bab.
    for (const bab of bonuses) {
      RollHooks._addDieModifier(rollConfig.parts, rollConfig.data, bab);
    }
  }

  /**
   * When you roll a death saving throw...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   */
  static preRollDeathSave(actor, rollConfig) {
    // get bonus:
    const bonuses = FilterManager.throwCheck(actor, "death", {});
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
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {optionals, actor, bonuses});

    // Add modifiers to raise/lower the target value and crtical threshold.
    rollConfig.targetValue = (rollConfig.targetValue ?? 10) - death.targetValue;
    rollConfig.critical = (rollConfig.critical ?? 20) - death.critical;
  }

  /**
   * When you roll a saving throw...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} abilityId      The key for the ability being used.
   */
  static preRollAbilitySave(actor, rollConfig, abilityId) {
    // get bonus:
    const bonuses = FilterManager.throwCheck(actor, abilityId, {isConcSave: rollConfig.isConcSave});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // add to parts:
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {optionals, actor, bonuses});
  }

  /**
   * When you roll an ability check...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} abilityId      The key for the ability being used.
   */
  static preRollAbilityTest(actor, rollConfig, abilityId) {
    const bonuses = FilterManager.testCheck(actor, abilityId);
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {optionals, actor, bonuses});
  }

  /**
   * When you roll a skill...
   * @TODO Find the correct ability used, pending the system's roll refactor.
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} skillId        The key for the skill being used.
   */
  static preRollSkill(actor, rollConfig, skillId) {
    const abilityId = actor.system.skills[skillId].ability;
    const bonuses = FilterManager.testCheck(actor, abilityId, {skillId});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {optionals, actor, bonuses});
  }

  /**
   * When you roll a tool check...
   * @TODO Find the correct ability used, pending the system's roll refactor.
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} toolId         The key for the tool being used.
   */
  static preRollToolCheck(actor, rollConfig, toolId) {
    const abilityId = rollConfig.ability || rollConfig.data.defaultAbility;
    const bonuses = FilterManager.testCheck(actor, abilityId, {toolId});
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);
    const optionals = RollHooks._getParts(bonuses, rollConfig);
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}`, {optionals, actor, bonuses});
  }

  /**
   * When you roll a hit die...
   * @param {Actor5e} actor           The actor that is making the roll.
   * @param {object} rollConfig       The configuration for the roll.
   * @param {string} denomination     The denomination of the die, e.g., 'd8'.
   */
  static preRollHitDie(actor, rollConfig, denomination) {
    const bonuses = FilterManager.hitDieCheck(actor);
    if (!bonuses.length) return;
    RollHooks._addTargetData(rollConfig);

    // Construct an array of parts.
    const parts = [`1${denomination} + @abilities.con.mod`];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      if (!!bonus && Roll.validate(bonus)) parts.push(bonus);
    }

    // Add die modifiers.
    for (const bonus of bonuses) {
      RollHooks._addDieModifier(parts, rollConfig.data, bonus);
    }

    // Construct the replacement formula.
    rollConfig.formula = `max(0, ${parts.join(" + ")})`;
  }

  /**
   * Inject babonus data on created templates if they have an associated item.
   * @TODO Make use of new hooks in dnd5e v2.5.
   * @param {MeasuredTemplateDocument5e} templateDoc      The ability template being created.
   */
  static preCreateMeasuredTemplate(templateDoc) {
    const item = fromUuidSync(templateDoc.flags.dnd5e?.origin ?? "");
    if (!item?.actor) return;
    const tokenDocument = item.actor.token ?? item.actor.getActiveTokens(false, true)[0];
    const disp = tokenDocument?.disposition ?? item.actor.prototypeToken.disposition;

    const bonusData = BabonusWorkshop._getCollection(item).reduce((acc, bab) => {
      if (bab.aura.isTemplate) acc[`flags.${MODULE.ID}.bonuses.${bab.id}`] = bab.toObject();
      return acc;
    }, {});
    if (foundry.utils.isEmpty(bonusData)) return;
    bonusData["flags.babonus.templateDisposition"] = disp;
    templateDoc.updateSource(bonusData);
  }

  /**
   * Gather optional bonuses and put non-optional bonuses into the roll config.
   * @param {Babonus[]} bonuses     An array of babonuses to apply.
   * @param {object} rollConfig     The roll config for this roll. **will be mutated**
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
   * @param {object} rollConfig           The roll config for this roll. **will be mutated**
   * @param {boolean} [deterministic]     Whether to force flat values for properties that could be a die or flat term.
   */
  static _addTargetData(rollConfig, deterministic = false) {
    const target = game.user.targets.first();
    if (target?.actor) rollConfig.data.target = target.actor.getRollData({deterministic});
  }

  /**
   * Add modifiers to the dice rolls of a roll.
   * @param {string[]} parts      The individual parts of the roll. **will be mutated**
   * @param {object} data         The roll data.
   * @param {Babonus} bab         The babonus with possible modifiers.
   */
  static _addDieModifier(parts, data, bab) {
    if (!bab.bonuses.modifiers.hasModifiers) return;
    const first = bab.bonuses.modifiers.config.first;
    let changed = false;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const roll = new CONFIG.Dice.DamageRoll(part, data);
      if (!roll.dice.length) continue;

      for (const die of roll.dice) {
        if (first && changed) break;
        bab.bonuses.modifiers.modifyDie(die);
        changed = true;
      }
      parts[i] = Roll.fromTerms(roll.terms).formula;
      if (first && changed) return;
    }
  }
}
