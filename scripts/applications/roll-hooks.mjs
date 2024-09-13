import {MODULE, SETTINGS} from "../constants.mjs";
import {FilterManager} from "./filter-manager.mjs";

/**
 * Utility extension of Map to keep track of rolls and bonuses that apply to them.
 */
class RollRegister extends Map {
  /**
   * Register an object of data with a generated id.
   * @param {object} config     The data to store.
   * @returns {string}          Randomly generated id to later retrieve the stored data.
   */
  register(config) {
    const id = foundry.utils.randomID();
    this.set(id, config);
    return id;
  }
}

/* -------------------------------------------------- */

/**
 * The registry of rolls being made.
 * @type {RollRegister}
 */
export const registry = new RollRegister();

/* -------------------------------------------------- */

/** Utility class for the various roll hooks. */
export class RollHooks {
  /**
   * When you force a saving throw...
   * @param {Activity} activity                           Activity being used.
   * @param {ActivityUseConfiguration} usageConfig        Configuration info for the activation.
   * @param {ActivityDialogConfiguration} dialogConfig    Configuration info for the usage dialog.
   * @param {ActivityMessageConfiguration} messageConfig  Configuration info for the created chat message.
   */
  static preUseActivity(activity, usageConfig, dialogConfig, messageConfig) {
    if (activity.type !== "save") return;

    const subjects = {
      activity: activity,
      item: activity.item,
      actor: activity.item.actor
    };

    // Get bonuses:
    const bonuses = FilterManager.itemCheck(subjects, "save", {spellLevel: activity.item.system.level});
    if (!bonuses.size) return;
    // const id = registry.register(bonuses); // TODO: useless

    const rollData = activity.getRollData({deterministic: true});
    RollHooks._addTargetData({data: rollData});
    const totalBonus = bonuses.reduce((acc, bab) => {
      return acc + dnd5e.utils.simplifyBonus(bab.bonuses.bonus, rollData);
    }, 0);

    activity.save.dc.value += totalBonus;
  }

  /* -------------------------------------------------- */

  /**
   * When you make an attack roll...
   * @param {AttackRollProcessConfiguration} config  Configuration data for the pending roll.
   * @param {BasicRollDialogConfiguration} dialog    Presentation data for the roll configuration dialog.
   * @param {BasicRollMessageConfiguration} message  Configuration data for the roll's message.
   */
  static preRollAttack(config, dialog, message) {
    const item = config.subject?.item;
    if (!item) return;

    const subjects = {activity: config.subject, item: item, actor: item.actor};
    // get bonuses:
    const spellLevel = config.rolls[0].data.scaling.value;
    const bonuses = FilterManager.itemCheck(subjects, "attack", {spellLevel});
    if (!bonuses.size) return;
    RollHooks._addTargetData(config);

    const {data: rollData} = config.rolls[0];

    // Gather up all bonuses.
    const optionals = [];
    const mods = {criticalSuccess: 0, criticalFailure: 0};
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      const valid = !!bonus && Roll.validate(bonus);
      if (valid) {
        if (bab.isOptional) optionals.push(bab);
        else config.rolls[0].parts.push(bonus);
      }
      mods.criticalSuccess += dnd5e.utils.simplifyBonus(bab.bonuses.criticalRange, rollData);
      mods.criticalFailure += dnd5e.utils.simplifyBonus(bab.bonuses.fumbleRange, rollData);
    }

    const id = registry.register({
      ...subjects,
      optionals: optionals,
      spellLevel: spellLevel,
      bonuses: bonuses,
      configurations: {config, dialog, message}
    });

    // Add parts.
    foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

    for (const {options} of config.rolls) {
      // Add modifiers to raise/lower the criticial and fumble.
      options.criticalSuccess = (options.criticalSuccess ?? 20) - mods.criticalSuccess;
      options.criticalFailure = (options.criticalFailure ?? 1) + mods.criticalFailure;

      // Don't set crit to below 1, and don't set fumble to below 1 unless allowed.
      if (options.criticalSuccess < 1) options.criticalSuccess = 1;
      if ((options.criticalFailure < 1) && !game.settings.get(MODULE.ID, SETTINGS.FUMBLE)) options.criticalFailure = 1;
    }
  }

  /* -------------------------------------------------- */

  /**
   * When you make a damage roll...
   * @param {DamageRollProcessConfiguration} config  Configuration data for the pending roll.
   * @param {BasicRollDialogConfiguration} dialog    Presentation data for the roll configuration dialog.
   * @param {BasicRollMessageConfiguration} message  Configuration data for the roll's message.
   */
  static preRollDamage(config, dialog, message) {
    const item = config.subject?.item;
    if (!item) return;
    // get bonus:
    const spellLevel = config.rolls[0].data.scaling.value;

    const subjects = {
      activity: config.subject,
      item: item,
      actor: item.actor
    };
    const bonuses = FilterManager.itemCheck(subjects, "damage", {spellLevel});
    if (!bonuses.size) return;
    RollHooks._addTargetData(config);

    const id = registry.register({
      ...subjects,
      optionals: RollHooks._getDamageParts(bonuses, config),
      spellLevel: spellLevel,
      bonuses: bonuses,
      configurations: {config, dialog, message}
    });

    // Add parts.
    foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

    // Add to critical dice and critical damage.
    config.critical ??= {};

    // add to crit bonus dice:
    config.critical.bonusDice = bonuses.reduce((acc, bab) => {
      return acc + dnd5e.utils.simplifyBonus(bab.bonuses.criticalBonusDice, config.rolls[0].data);
    }, config.critical.bonusDice ?? 0);
    if (config.critical.bonusDice < 0) config.critical.bonusDice = 0;

    // add to crit damage:
    config.critical.bonusDamage = bonuses.reduce((acc, bab) => {
      const bonus = bab.bonuses.criticalBonusDamage;
      const valid = !!bonus && Roll.validate(bonus);
      if (!valid) return acc;
      return `${acc} + ${bonus}`;
    }, config.critical.bonusDamage ?? "");

    // Modify the parts if there are modifiers in the bab.
    for (const bab of bonuses) {
      for (const {parts, data} of config.rolls) {
        if (bab._halted) break;
        const halted = bab.bonuses.modifiers.modifyParts(parts, data ?? {});
        if (halted) bab._halted = true;
      }
    }
  }

  /* -------------------------------------------------- */

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
    const bonuses = FilterManager.throwCheck({actor}, {ability, isDeath, isConcentration});
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

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * When you roll an ability check...
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} abilityId      The key for the ability being used.
   */
  static preRollAbilityTest(actor, rollConfig, abilityId) {
    const bonuses = FilterManager.testCheck({actor}, abilityId);
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getParts(bonuses, rollConfig),
      actor: actor,
      bonuses: bonuses
    });

    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
  }

  /* -------------------------------------------------- */

  /**
   * When you roll a skill...
   * @TODO Find the correct ability used, pending the system's roll refactor.
   * @param {Actor5e} actor         The actor that is making the roll.
   * @param {object} rollConfig     The configuration for the roll.
   * @param {string} skillId        The key for the skill being used.
   */
  static preRollSkill(actor, rollConfig, skillId) {
    const abilityId = actor.system.skills[skillId].ability;
    const bonuses = FilterManager.testCheck({actor}, abilityId, {skillId});
    if (!bonuses.size) return;
    RollHooks._addTargetData(rollConfig);

    const id = registry.register({
      optionals: RollHooks._getParts(bonuses, rollConfig),
      actor: actor,
      bonuses: bonuses
    });

    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
  }

  /* -------------------------------------------------- */

  /**
   * When you roll a tool check...
   * @TODO Find the correct ability used, pending the system's roll refactor.
   * @param {Actor5e} actor     The actor that is making the roll.
   * @param {object} config     The configuration for the roll.
   * @param {string} toolId     The key for the tool being used.
   */
  static preRollToolCheck(actor, config, toolId) {
    const subjects = {
      actor: actor,
      item: config.item
    };
    const abilityId = config.ability || config.data.defaultAbility;
    const bonuses = FilterManager.testCheck(subjects, abilityId, {toolId});
    if (!bonuses.size) return;
    RollHooks._addTargetData(config);

    const id = registry.register({
      ...subjects,
      optionals: RollHooks._getParts(bonuses, config),
      bonuses: bonuses
    });

    foundry.utils.setProperty(config, `dialogOptions.${MODULE.ID}.registry`, id);
  }

  /* -------------------------------------------------- */

  /**
   * When you roll a hit die...
   * @param {HitDieRollProcessConfiguration} config  Configuration information for the roll.
   * @param {BasicRollDialogConfiguration} dialog    Configuration for the roll dialog.
   * @param {BasicRollMessageConfiguration} message  Configuration for the roll message.
   */
  static preRollHitDie(config, dialog, message) {
    const actor = config.subject;
    const bonuses = FilterManager.hitDieCheck({actor});
    if (!bonuses.size) return;
    RollHooks._addTargetData(config);

    // Construct an array of parts.
    const parts = [`1${config.denomination}`, `@abilities.${CONFIG.DND5E.defaultAbilities.hitPoints}.mod`];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      if (!!bonus && Roll.validate(bonus)) parts.push(bonus);
    }

    // Add die modifiers.
    for (const bonus of bonuses) {
      bonus.bonuses.modifiers.modifyParts(parts, config.rolls[0].data);
    }

    // TODO: Force dialog when situational bonuses are implemented.
    // dialog.configure = true;

    const id = registry.register({
      optionals: [], // RollHooks._getParts(bonuses, config),
      actor: actor,
      bonuses: bonuses,
      configurations: {config, dialog, message}
    });

    foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

    // Replace parts.
    if (parts.length) {
      const [denom, mod, ...rest] = parts;
      config.rolls[0].parts = [`max(0, ${[denom, mod].join(" + ")})`, ...rest];
    }
  }

  /* -------------------------------------------------- */

  /**
   * Inject babonus data on templates created by items.
   * @param {Activity} activity       Activity for which the template is being placed.
   * @param {object} templateData     Data used to create the new template.
   */
  static preCreateActivityTemplate(activity, templateData) {
    const item = activity.item;
    if (!item?.isEmbedded) return;
    const [tokenDocument] = item.actor.isToken ? [item.actor.token] : item.actor.getActiveTokens(false, true);
    const disp = tokenDocument?.disposition ?? item.actor.prototypeToken.disposition;

    const bonusData = babonus.getCollection(item).reduce((acc, bonus) => {
      if (bonus.aura.isTemplate) acc.push(bonus.toObject());
      return acc;
    }, []);
    if (foundry.utils.isEmpty(bonusData)) return;
    foundry.utils.setProperty(templateData, `flags.${MODULE.ID}`, {
      bonuses: bonusData,
      templateDisposition: disp
    });
  }

  /* -------------------------------------------------- */

  /**
   * Gather optional bonuses and put non-optional bonuses into the roll config.
   * @param {Babonus[]} bonuses     An array of babonuses to apply.
   * @param {object} config         The roll config for this roll. **will be mutated**
   * @returns {string[]}            An array of optional bonuses to modify a roll.
   */
  static _getDamageParts(bonuses, config) {
    const optionals = [];
    for (const bab of bonuses) {
      const bonus = bab.bonuses.bonus;
      if (!bonus) continue;

      if (bab.isOptional) {
        optionals.push(bab);
        continue;
      }

      let existing;
      if (bab.hasDamageType) existing = config.rolls.find(config => config.options.types.includes(bab.bonuses.damageType));
      else existing = config.rolls[0];

      if (existing) existing.parts.push(bonus);
      else config.rolls.push({
        data: config.rolls[0].data,
        options: {
          type: bab.bonuses.damageType,
          properties: [...config.rolls[0].options.properties ?? []]
        },
        parts: [bonus]
      });
    }
    return optionals;
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * Add the target's roll data to the actor's roll data.
   * @param {object} config               The roll config for this roll. **will be mutated**
   * @param {boolean} [deterministic]     Whether to force flat values for properties that could be a die or flat term.
   */
  static _addTargetData(config, deterministic = false) {
    const target = game.user.targets.first();
    if (target?.actor) {
      for (const {data} of config.rolls) {
        data.target = target.actor.getRollData({deterministic});
      }
    }
  }
}
