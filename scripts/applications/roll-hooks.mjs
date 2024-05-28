import {MODULE, SETTINGS} from "../constants.mjs";

class RollRegister extends Map {
  register(bonuses) {
    const id = foundry.utils.randomID();
    this.set(id, bonuses);
    return id;
  }
}
export const registry = new RollRegister();

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
    const bonuses = babonus.abstract.applications.FilterManager.itemCheck(item, "save", {spellLevel: item.system.level});
    if (!bonuses.size) return;
    const id = registry.register(bonuses);

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
    for (const button of saveButtons) {
      button.dataset.dc = dc;
      button.innerHTML = `<i class="fa-solid fa-shield-heart"></i> ${game.i18n.format("DND5E.SavingThrowDC", {
        dc: dc,
        ability: CONFIG.DND5E.abilities[button.dataset.ability]?.label ?? ""
      })}`;
    }
    foundry.utils.setProperty(chatData, `flags.${MODULE.ID}.saveDC`, dc);
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
    const bonuses = babonus.abstract.applications.FilterManager.itemCheck(item, "attack", {spellLevel});
    if (!bonuses.size) return;
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

    const id = registry.register({
      optionals: optionals,
      actor: item.actor,
      spellLevel: spellLevel,
      item: item,
      bonuses: bonuses
    });

    // Add parts.
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);

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
    const bonuses = babonus.abstract.applications.FilterManager.itemCheck(item, "damage", {spellLevel});
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getDamageParts(bonuses, rollConfig, "rollConfigs"),
      actor: item.actor,
      spellLevel: spellLevel,
      item: item,
      bonuses: bonuses
    });

    // add to parts:
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);

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
      for (const {parts} of rollConfig.rollConfigs) {
        if (bab._halted) break;
        const halted = bab.bonuses.modifiers.modifyParts(parts, rollConfig.data);
        if (halted) bab._halted = true;
      }
    }
  }

  /**
   * When you roll a saving throw...
   * @param {Actor5e} actor                         The actor that is making the roll.
   * @param {object} rollConfig                     The configuration for the roll.
   * @param {object} [options]                      Properties of the saving throw.
   * @param {string} [options.ability]              The ability used for the saving throw.
   * @param {boolean} [options.isConcentration]     Is this a concentration saving throw?
   * @param {boolean} [options.isDeath]             Is this a death saving throw?
   */
  static preRollSave(actor, rollConfig, {ability, isDeath, isConcentration} = {}) {
    // get bonus:
    const bonuses = babonus.abstract.applications.FilterManager.throwCheck(actor, {ability, isDeath, isConcentration});
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    // Gather up all bonuses.
    const accum = {targetValue: 0, critical: 0};
    const optionals = [];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      const valid = !!bonus && Roll.validate(bonus);
      if (valid) {
        if (bab.isOptional) optionals.push(bab);
        else rollConfig.parts.push(bonus);
      }
      accum.targetValue += dnd5e.utils.simplifyBonus(bab.bonuses.targetValue, rollConfig.data);
      accum.critical += dnd5e.utils.simplifyBonus(bab.bonuses.deathSaveCritical, rollConfig.data);
    }

    const id = registry.register({
      optionals: optionals,
      actor: actor,
      bonuses: bonuses
    });

    // Add parts.
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);

    // Add modifiers to raise/lower the target value and critical threshold.
    if (Number.isNumeric(rollConfig.targetValue)) {
      rollConfig.targetValue = Number(rollConfig.targetValue) - accum.targetValue;
    }
    if (isDeath) rollConfig.critical = (rollConfig.critical ?? 20) - accum.critical;
  }

  /**
   * When you roll an ability or concentration saving throw...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} abilityId      The key for the ability being used.
   */
  static preRollAbilitySave(actor, rollConfig, abilityId) {
    return RollHooks.preRollSave(actor, rollConfig, {
      ability: abilityId,
      isConcentration: rollConfig.isConcentration ?? false,
      isDeath: false
    });
  }

  /**
   * When you roll a death saving throw...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   */
  static preRollDeathSave(actor, rollConfig) {
    return RollHooks.preRollSave(actor, rollConfig, {
      ability: rollConfig.ability,
      isConcentration: false,
      isDeath: true
    });
  }

  /**
   * When you roll an ability check...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} abilityId      The key for the ability being used.
   */
  static preRollAbilityTest(actor, rollConfig, abilityId) {
    const bonuses = babonus.abstract.applications.FilterManager.testCheck(actor, abilityId);
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getParts(bonuses, rollConfig),
      actor: actor,
      bonuses: bonuses
    });

    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
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
    const bonuses = babonus.abstract.applications.FilterManager.testCheck(actor, abilityId, {skillId});
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getParts(bonuses, rollConfig),
      actor: actor,
      bonuses: bonuses
    });

    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
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
    const bonuses = babonus.abstract.applications.FilterManager.testCheck(actor, abilityId, {
      toolId,
      item: rollConfig.item ?? null
    });
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getParts(bonuses, rollConfig),
      actor: actor,
      bonuses: bonuses
    });

    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
  }

  /**
   * When you roll a hit die...
   * @param {Actor5e} actor           The actor that is making the roll.
   * @param {object} rollConfig       The configuration for the roll.
   * @param {string} denomination     The denomination of the die, e.g., 'd8'.
   */
  static preRollHitDie(actor, rollConfig, denomination) {
    const bonuses = babonus.abstract.applications.FilterManager.hitDieCheck(actor);
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    // Construct an array of parts.
    const parts = [`1${denomination} + @abilities.con.mod`];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      if (!!bonus && Roll.validate(bonus)) parts.push(bonus);
    }

    // Add die modifiers.
    for (const bonus of bonuses) {
      bonus.bonuses.modifiers.modifyParts(parts, rollConfig.data);
    }

    // Construct the replacement formula.
    rollConfig.formula = `max(0, ${parts.join(" + ")})`;
  }

  /**
   * Inject babonus data on templates created by items.
   * @param {Item5e} item             The item that creates the template.
   * @param {object} templateData     The template data to create the template.
   */
  static preCreateItemTemplate(item, templateData) {
    if (!item?.isEmbedded) return;
    const tokenDocument = item.actor.token ?? item.actor.getActiveTokens(false, true)[0];
    const disp = tokenDocument?.disposition ?? item.actor.prototypeToken.disposition;

    const bonusData = babonus.getCollection(item).reduce((acc, bab) => {
      if (bab.aura.isTemplate) acc[bab.id] = bab.toObject();
      return acc;
    }, {});
    if (foundry.utils.isEmpty(bonusData)) return;
    foundry.utils.setProperty(templateData, `flags.${MODULE.ID}`, {
      bonuses: bonusData,
      templateDisposition: disp
    });
  }

  /**
   * Gather optional bonuses and put non-optional bonuses into the roll config.
   * @param {Babonus[]} bonuses     An array of babonuses to apply.
   * @param {object} rollConfig     The roll config for this roll. **will be mutated**
   * @returns {string[]}            An array of optional bonuses to modify a roll.
   */
  static _getDamageParts(bonuses, rollConfig) {
    const optionals = [];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      if (!bonus) continue;

      if (bab.isOptional) {
        optionals.push(bab);
        continue;
      }

      let existing;
      if (bab.hasDamageType) existing = rollConfig.rollConfigs.find(config => config.type === bab.bonuses.damageType);
      else existing = rollConfig.rollConfigs[0];

      if (existing) existing.parts.push(bonus);
      else rollConfig.rollConfigs.push({
        parts: [bonus],
        type: bab.bonuses.damageType,
        properties: [...rollConfig.rollConfigs[0].properties ?? []]
      });
    }
    return optionals;
  }

  /**
   * Gather optional bonuses and put non-optional bonuses into the roll config.
   * @param {Babonus[]} bonuses     An array of babonuses to apply.
   * @param {object} rollConfig     The roll config for this roll. **will be mutated**
   * @returns {string[]}            An array of optional bonuses to modify a roll.
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
}
