import {MODULE, SETTINGS} from "./constants.mjs";
import * as filterings from "./applications/filterings.mjs";
import registry from "./registry.mjs";

/**
 * @typedef {object} SavingThrowDetails
 * @property {string} [ability]               The ability used for the saving throw.
 * @property {boolean} [isConcentration]      Whether this saving throw is to maintain concentration.
 * @property {boolean} [isDeath]              Whether this is a death saving throw.
 */

/* -------------------------------------------------- */
/*   Mutators                                         */
/* -------------------------------------------------- */

/**
 * When you force a saving throw...
 * @param {Activity} activity                           Activity being used.
 * @param {ActivityUseConfiguration} usageConfig        Configuration info for the activation.
 * @param {ActivityDialogConfiguration} dialogConfig    Configuration info for the usage dialog.
 * @param {ActivityMessageConfiguration} messageConfig  Configuration info for the created chat message.
 */
function preUseActivity(activity, usageConfig, dialogConfig, messageConfig) {
  if (activity.type !== "save") return;

  const subjects = {
    activity: activity,
    item: activity.item,
    actor: activity.item.actor
  };

  // Get bonuses:
  const bonuses = filterings.itemCheck(subjects, "save", {spellLevel: activity.item.system.level});
  if (!bonuses.size) return;
  // const id = registry.register(bonuses); // TODO: useless

  const rollData = activity.getRollData({deterministic: true});
  _addTargetData({data: rollData});
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
function preRollAttack(config, dialog, message) {
  const item = config.subject?.item;
  if (!item) return;

  const subjects = {activity: config.subject, item: item, actor: item.actor};
  // get bonuses:
  const spellLevel = config.rolls[0].data.scaling.value;
  const bonuses = filterings.itemCheck(subjects, "attack", {spellLevel});
  if (!bonuses.size) return;
  _addTargetData(config);

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
function preRollDamage(config, dialog, message) {
  const item = config.subject?.item;
  if (!item) return;

  // get bonus:
  const spellLevel = config.rolls[0].data.scaling.value;
  const attackMode = config.attackMode ?? null;

  const subjects = {activity: config.subject, item: item, actor: item.actor};
  const bonuses = filterings.itemCheck(subjects, "damage", {spellLevel, attackMode});
  if (!bonuses.size) return;
  _addTargetData(config);

  const optionals = [];
  const id = registry.register({
    ...subjects,
    optionals: optionals,
    spellLevel: spellLevel,
    bonuses: bonuses,
    configurations: {config, dialog, message},
    attackMode: attackMode
  });
  foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

  // Add to critical dice and critical damage.
  const critical = config.critical ??= {};
  critical.bonusDice ??= 0;
  critical.bonusDamage ??= "";

  for (const bonus of bonuses) {
    if (bonus.isOptional) {
      optionals.push(bonus);
      continue;
    }

    const rollData = config.rolls[0].data;
    const {criticalBonusDamage: damage, criticalBonusDice: dice} = bonus.bonuses;

    // Add to crit bonus dice.
    if (dice) critical.bonusDice + dnd5e.utils.simplifyBonus(dice, rollData);

    // Add to crit damage.
    if (damage) critical.bonusDamage ? `${critical.bonusDamage} + ${damage}` : damage;

    // Add damage parts.
    if (bonus.bonuses.bonus) {
      const roll = config.rolls.find(config => {
        if (!bonus.hasDamageType) return true;
        return config.options.types.includes(bonus.bonuses.damageType);
      });

      if (roll) {
        roll.parts.push(bonus.bonuses.bonus);
      } else {
        config.rolls.push({
          data: rollData,
          parts: [bonus.bonuses.bonus],
          options: {
            properties: [...config.rolls[0].options.properties ?? []],
            type: bonus.bonuses.damageType,
            types: [bonus.bonuses.damageType]
          }
        });
      }
    }
  }

  // Add dice modifiers.
  for (const bonus of bonuses) {
    if (bonus.isOptional) continue;
    for (const {parts, data} of config.rolls) {
      if (bonus._halted) break;
      const halted = bonus.bonuses.modifiers.modifyParts(parts, data ?? rollData);
      if (halted) bonus._halted = true;
    }
  }

  // Adjust values to fit within sensible bounds.
  if (critical.bonusDice < 0) critical.bonusDice = 0;
  if (critical.bonusDamage && !Roll.validate(critical.bonusDamage)) {
    console.warn("Critical bonus damage resulted in invalid formula:", critical.bonusDamage);
    critical.bonusDamage = "";
  }
}

/* -------------------------------------------------- */

/**
 * When you roll a saving throw...
 * @param {Actor5e} actor                   The actor that is making the roll.
 * @param {object} rollConfig               The configuration for the roll.
 * @param {SavingThrowDetails} details      Properties of the saving throw.
 */
function _preRollSave(actor, rollConfig, details) {
  // get bonus:
  const bonuses = filterings.throwCheck({actor}, details);
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

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
    bonuses: bonuses,
    details: details
  });

  // Add parts.
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);

  // Add modifiers to raise/lower the target value and critical threshold.
  if (Number.isNumeric(rollConfig.targetValue)) {
    rollConfig.targetValue = Number(rollConfig.targetValue) - accum.targetValue;
  }
  if (details.isDeath) {
    rollConfig.critical = (rollConfig.critical ?? 20) - accum.critical;

    // Target value cannot be higher than the critical threshold.
    rollConfig.targetValue = Math.min(rollConfig.critical, rollConfig.targetValue);
  }
}

/* -------------------------------------------------- */

/**
 * When you roll an ability or concentration saving throw...
 * @param {Actor5e} actor         The actor that is making the roll.
 * @param {object} rollConfig     The configuration for the roll.
 * @param {string} abilityId      The key for the ability being used.
 */
function preRollAbilitySave(actor, rollConfig, abilityId) {
  return _preRollSave(actor, rollConfig, {
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
function preRollDeathSave(actor, rollConfig) {
  return _preRollSave(actor, rollConfig, {
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
function preRollAbilityTest(actor, rollConfig, abilityId) {
  const bonuses = filterings.testCheck({actor}, abilityId);
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

  const id = registry.register({
    optionals: _getParts(bonuses, rollConfig),
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
function preRollSkill(actor, rollConfig, skillId) {
  const abilityId = actor.system.skills[skillId].ability;
  const bonuses = filterings.testCheck({actor}, abilityId, {skillId});
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

  const id = registry.register({
    optionals: _getParts(bonuses, rollConfig),
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
function preRollToolCheck(actor, config, toolId) {
  const subjects = {
    actor: actor,
    item: config.item
  };
  const abilityId = config.ability || config.data.defaultAbility;
  const bonuses = filterings.testCheck(subjects, abilityId, {toolId});
  if (!bonuses.size) return;
  _addTargetData(config);

  const id = registry.register({
    ...subjects,
    optionals: _getParts(bonuses, config),
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
function preRollHitDie(config, dialog, message) {
  const actor = config.subject;
  const bonuses = filterings.hitDieCheck({actor});
  if (!bonuses.size) return;
  _addTargetData(config);

  // Construct an array of parts.
  const parts = [`1${config.denomination}`, `@abilities.${CONFIG.DND5E.defaultAbilities.hitPoints}.mod`];

  const optionals = [];
  const id = registry.register({
    optionals: optionals,
    actor: actor,
    bonuses: bonuses,
    configurations: {config, dialog, message}
  });
  foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

  for (const bonus of bonuses) {
    if (bonus.isOptional) {
      optionals.push(bonus);
      continue;
    }

    // Add bonus.
    if (bonus.bonuses.bonus && Roll.validate(bonus.bonuses.bonus)) parts.push(bonus.bonuses.bonus);
  }

  // Add die modifiers.
  for (const bonus of bonuses) {
    if (bonus.isOptional) continue;
    bonus.bonuses.modifiers.modifyParts(parts, config.rolls[0].data);
  }

  // Force dialog if there is an optional bonus.
  if (optionals.length) dialog.configure = true;

  // Replace parts.
  const [denom, mod, ...rest] = parts;
  config.rolls[0].parts = [`max(0, ${[denom, mod].join(" + ")})`, ...rest];
}

/* -------------------------------------------------- */

/**
 * Inject babonus data on templates created by items.
 * @param {Activity} activity       Activity for which the template is being placed.
 * @param {object} templateData     Data used to create the new template.
 */
function preCreateActivityTemplate(activity, templateData) {
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
 * @param {object} rollConfig     The roll config for this roll. **will be mutated**
 * @returns {string[]}            An array of optional bonuses to modify a roll.
 */
function _getParts(bonuses, rollConfig) {
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
function _addTargetData(config, deterministic = false) {
  const target = game.user.targets.first();
  if (target?.actor) {
    for (const {data} of config.rolls) {
      data.target = target.actor.getRollData({deterministic});
    }
  }
}

/* -------------------------------------------------- */

export default {
  preCreateActivityTemplate,
  preRollAbilitySave,
  preRollAbilityTest,
  preRollAttack,
  preRollDamage,
  preRollDeathSave,
  preRollHitDie,
  preRollSkill,
  preRollToolCheck,
  preUseActivity
};
