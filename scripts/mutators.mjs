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
function postActivityConsumption(activity, usageConfig, dialogConfig, messageConfig) {
  if (activity.type !== "save") return;

  const subjects = {
    activity: activity,
    item: activity.item,
    actor: activity.item.actor,
  };

  const rollData = activity.getRollData({deterministic: true});

  // Get bonuses:
  const bonuses = filterings.itemCheck(subjects, "save", {spellLevel: rollData.item.level});
  if (!bonuses.size) return;
  // const id = registry.register(bonuses); // TODO: useless

  _addTargetData({data: rollData});
  const totalBonus = bonuses.all.reduce((acc, bonus) => {
    return acc + dnd5e.utils.simplifyBonus(bonus.bonuses.bonus, rollData);
  }, 0);

  activity.save.dc.value += totalBonus;
}

/* -------------------------------------------------- */

function preRollD20(config, dialog, message) {
  console.warn("D20", {config, dialog, message});
  return;
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
  const details = {spellLevel: config.subject.getRollData().item.level};
  const collection = filterings.itemCheck(subjects, "attack", details);

  const id = registry.register({
    collection: collection,
    configurations: {config, dialog, message},
    details: details,
    subjects: subjects,
  });
  foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);
}

Hooks.on("dnd5e.postAttackRollConfiguration", function(rolls, config, dialog, message) {
  const id = dialog.options?.babonus?.registry;
  if (!id) return;

  const {collection, configurations, details, subjects} = registry.get(id);
  registry.delete(id);

  // The roll configuration dialog was cancelled.
  if (!rolls.length) return;

  _addTargetData(config);

  const mods = {criticalSuccess: 0, criticalFailure: 0};
  const parts = [];

  const rollData = rolls[0].data;
  for (const bonus of collection.applyingBonuses(subjects, details)) {
    if (bonus.hasAdditiveBonus) parts.push(bonus.bonuses.bonus);
    if (bonus.hasPropertyBonuses) {
      mods.criticalSuccess += dnd5e.utils.simplifyBonus(bonus.bonuses.criticalRange, rollData);
      mods.criticalFailure += dnd5e.utils.simplifyBonus(bonus.bonuses.fumbleRange, rollData);
    }
  }
  parts.unshift(rolls[0].formula);

  const options = foundry.utils.deepClone(rolls[0].options);
  // Add modifiers to raise/lower the critical and fumble.
  options.criticalSuccess = (options.criticalSuccess ?? 20) - mods.criticalSuccess;
  options.criticalFailure = (options.criticalFailure ?? 1) + mods.criticalFailure;

  // Don't set crit to below 1, and don't set fumble to below 1 unless allowed.
  if (options.criticalSuccess < 1) options.criticalSuccess = 1;
  if ((options.criticalFailure < 1) && !game.settings.get(MODULE.ID, SETTINGS.FUMBLE)) options.criticalFailure = 1;

  rolls[0] = new rolls[0].constructor(parts.join(" + "), rollData, options);
  rolls[0].configureModifiers();
});

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

  const subjects = {activity: config.subject, item: item, actor: item.actor};
  const details = {spellLevel: config.subject.getRollData().item.level, attackMode: config.attackMode ?? null};
  const collection = filterings.itemCheck(subjects, "damage", details);

  const id = registry.register({
    collection: collection,
    configurations: {config, dialog, message},
    details: details,
    subjects: subjects,
  });
  foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);
}

Hooks.on("dnd5e.postDamageRollConfiguration", function(rolls, config, dialog, message) {
  const id = dialog.options?.babonus?.registry;
  if (!id) return;

  const {collection, configurations, details, subjects} = registry.get(id);
  registry.delete(id);

  if (!rolls.length) return;

  _addTargetData(config);

  const rollData = config.rolls[0].data;
  for (const bonus of collection.applyingBonuses(subjects, details)) {
    if (!bonus.hasAdditiveBonus) continue;
    const options = {
      properties: [...config.rolls[0].options.properties ?? []],
      type: bonus.bonuses.damageType.first(),
      types: Array.from(bonus.bonuses.damageType),
    };
    rolls.push(new dnd5e.dice.DamageRoll(bonus.bonuses.bonus, rollData, options));
  }
});

/* -------------------------------------------------- */

/**
 * When you roll a saving throw.
 */
function _preRollSave(...rest) {
  console.warn("SAVE", {rest});
  return;
  // get bonus:
  const bonuses = filterings.throwCheck({actor}, details);
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

  // Gather up all bonuses.
  const accum = {targetValue: 0, critical: 0};
  for (const bonus of bonuses.nonoptional) {
    if (bonus.hasAdditiveBonus) rollConfig.parts.push(bonus.bonuses.bonus);
    accum.targetValue += dnd5e.utils.simplifyBonus(bonus.bonuses.targetValue, rollConfig.data);
    accum.critical += dnd5e.utils.simplifyBonus(bonus.bonuses.deathSaveCritical, rollConfig.data);
  }

  const id = registry.register({
    actor: actor,
    bonuses: bonuses,
    modifiers: new foundry.utils.Collection(), // TODO: 4.1, see attack roll method
    details: details,
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
 * @param {AbilityRollProcessConfiguration} config  Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog     Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message   Configuration for the roll message.
 */
function preRollAbilitySave(config, dialog, message) {
  console.warn("ABILITY SAVE", {config, dialog, message});
  return;
  return _preRollSave(actor, rollConfig, {
    ability: abilityId,
    isConcentration: rollConfig.isConcentration ?? false,
    isDeath: false,
  });
}

/* -------------------------------------------------- */

/**
 * When you roll a death saving throw.
 */
function preRollDeathSave(config, dialog, message) {
  console.warn("DEATH SAVE", {config, dialog, message});
  return;
  return _preRollSave(actor, rollConfig, {
    ability: rollConfig.ability,
    isConcentration: false,
    isDeath: true,
  });
}

/* -------------------------------------------------- */

function preRollConcentration(config, dialog, message) {
  console.warn("CONCENTRATION", {config, dialog, message});
  return; // TODO
}

/* -------------------------------------------------- */

/**
 * When you roll an ability check...
 * @param {AbilityRollProcessConfiguration} config  Configuration information for the roll.
 * @param {BasicRollDialogConfiguration} dialog     Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message   Configuration for the roll message.
 */
function preRollAbilityTest(config, dialog, message) {
  console.warn("ABILITY CHECK", {config, dialog, message});
  return;
  const bonuses = filterings.testCheck({actor}, {abilityId});
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

  for (const bonus of bonuses.nonoptional) {
    if (bonus.hasAdditiveBonus) rollConfig.parts.push(bonus.bonuses.bonus);
  }

  const id = registry.register({
    actor: actor,
    bonuses: bonuses,
    modifiers: new foundry.utils.Collection(), // TODO: 4.1, see attack method
  });

  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
}

/* -------------------------------------------------- */

/**
 * When you make a skill check.
 * @TODO: correct ability used?
 * @param {SkillToolRollProcessConfiguration} config  Configuration information for the roll.
 * @param {SkillToolRollDialogConfiguration} dialog   Configuration for the roll dialog.
 * @param {BasicRollMessageConfiguration} message     Configuration for the roll message.
 */
function preRollSkill(config, dialog, message) {
  console.warn("SKILL", {config, dialog, message});
  return;
  const abilityId = actor.system.skills[skillId].ability;
  const bonuses = filterings.testCheck({actor}, {abilityId, skillId});
  if (!bonuses.size) return;
  _addTargetData(rollConfig);

  for (const bonus of bonuses.nonoptional) {
    if (bonus.hasAdditiveBonus) rollConfig.parts.push(bonus.bonuses.bonus);
  }

  const id = registry.register({
    actor: actor,
    bonuses: bonuses,
    modifiers: new foundry.utils.Collection(), // TODO: 4.1, see attack method
  });

  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE.ID}.registry`, id);
}

/* -------------------------------------------------- */

/**
 * When you roll a tool check...
 * @TODO Find the correct ability used, pending the system's roll refactor.
 */
function preRollToolCheck(config, dialog, message) {
  console.warn("TOOL CHECK", {config, dialog, message});
  return;
  const subjects = {
    actor: actor,
    item: config.item,
  };
  const abilityId = config.ability || config.data.defaultAbility;
  const bonuses = filterings.testCheck(subjects, {abilityId, toolId});
  if (!bonuses.size) return;
  _addTargetData(config);

  for (const bonus of bonuses.nonoptional) {
    if (bonus.hasAdditiveBonus) config.parts.push(bonus.bonuses.bonus);
  }

  const id = registry.register({
    ...subjects,
    bonuses: bonuses,
    modifiers: new foundry.utils.Collection(), // TODO: see 4.1 and attack method
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

  const modifiers = new foundry.utils.Collection();
  const id = registry.register({
    actor: actor,
    bonuses: bonuses,
    modifiers: modifiers,
    configurations: {config, dialog, message},
  });
  foundry.utils.setProperty(dialog, `options.${MODULE.ID}.registry`, id);

  for (const bonus of bonuses.nonoptional) {
    if (bonus.hasAdditiveBonus) parts.push(bonus.bonuses.bonus);
  }

  // Add die modifiers.
  for (const bonus of bonuses.nonoptional) {
    if (!bonus.hasDiceModifiers) continue;
    for (const {data} of config.rolls) { // intentionally not using the original parts
      if (bonus._halted) break;
      const halted = bonus.bonuses.modifiers.modifyParts(parts, data);
      if (halted) bonus._halted = true;
    }
    if (!bonus._halted) modifiers.set(bonus.uuid, bonus);
  }

  // Force dialog if there is an optional bonus.
  if (bonuses.optionals.size) dialog.configure = true;

  // Replace parts.
  config.rolls[0].parts = parts;
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
    templateDisposition: disp,
  });
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
  postActivityConsumption,
  preCreateActivityTemplate,
  preRollAbilitySave,
  preRollAbilityTest,
  preRollAttack,
  preRollConcentration,
  preRollD20,
  preRollDamage,
  preRollDeathSave,
  preRollHitDie,
  preRollSkill,
  preRollToolCheck,
};
