import {FILTER} from "./filters.mjs";
import {OptionalSelector} from "./applications/rollConfigApp.mjs";
import {
  MODULE, MODULE_ICON,
  SETTING_DISABLE_CUSTOM_SCRIPT_FILTER,
  SETTING_HEADERLABEL,
  SETTING_MIGRATION_VERSION,
  SHOW_AURA_RANGES
} from "./constants.mjs";
import {AppliedBonusesDialog} from "./applications/appliedBonusesDialog.mjs";
import {BabonusWorkshop} from "./applications/babonus.mjs";

/**
 * Helper method to evaluate roll data into an integer.
 * @param {string} bonus      The formula to evaluate.
 * @param {object} data       The available roll data.
 * @returns {number}          The bonus, or zero if invalid.
 */
function _bonusToInt(bonus, data) {
  const f = new Roll(bonus, data).formula;
  if (!Roll.validate(f)) return 0;
  try {
    return Roll.safeEval(f);
  } catch (err) {
    console.warn(err);
    return 0;
  }
}

/* When you force a saving throw... */
export function _preDisplayCard(item, chatData) {
  if (!item.hasSave) return;

  // Get bonuses:
  const bonuses = FILTER.itemCheck(item, "save", {spellLevel: item.system.level});
  if (!bonuses.length) return;
  const data = item.getRollData();
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();
  const totalBonus = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.bonus, data);
  }, 0);

  // Get all buttons:
  const DIV = document.createElement("DIV");
  DIV.innerHTML = chatData.content;
  const saveButtons = DIV.querySelectorAll("button[data-action='save']");

  // Create label (innertext)
  const save = item.system.save;
  const ability = CONFIG.DND5E.abilities[save.ability] ?? ""; // TODO: fix in 2.2.x.
  const savingThrow = game.i18n.localize("DND5E.ActionSave");
  const dc = Math.max(1, save.dc + totalBonus) || "";
  chatData.flags[MODULE] = {saveDC: dc};
  const label = game.i18n.format("DND5E.SaveDC", {dc, ability});
  saveButtons.forEach(b => b.innerText = `${savingThrow} ${label}`);
  chatData.content = DIV.innerHTML;
}

/** When you make an attack roll... */
export function _preRollAttack(item, rollConfig) {
  // get bonuses:
  const spellLevel = rollConfig.data.item.level;
  const bonuses = FILTER.itemCheck(item, "attack", {spellLevel});
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // Gather up all bonuses.
  const parts = [];
  const optionals = [];
  const mods = {critical: 0, fumble: 0};
  for (const bab of bonuses) {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (valid) {
      if (bab.isOptional) optionals.push(bab);
      else parts.push(bonus);
    }
    mods.critical += _bonusToInt(bab.bonuses.criticalRange, data);
    mods.fumble += _bonusToInt(bab.bonuses.fumbleRange, data);
  }

  // Add parts.
  if (parts.length) rollConfig.parts.push(...parts);
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
export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const spellLevel = rollConfig.data.item.level;
  const bonuses = FILTER.itemCheck(item, "damage", {spellLevel});
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const {parts, optionals} = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, {parts: [], optionals: []});
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
    optionals, actor: item.actor, spellLevel, item, bonuses
  });

  // add to crit bonus dice:
  rollConfig.criticalBonusDice = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.criticalBonusDice, data);
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
export function _preRollDeathSave(actor, rollConfig) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, "death", {});
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // Gather up all bonuses.
  const death = {targetValue: 0, critical: 0};
  const parts = [];
  const optionals = [];
  for (const bab of bonuses) {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (valid) {
      if (bab.isOptional) optionals.push(bab);
      else parts.push(bonus);
    }
    death.targetValue += _bonusToInt(bab.bonuses.deathSaveTargetValue, data);
    death.critical += _bonusToInt(bab.bonuses.deathSaveCritical, data);
  }

  // Add parts.
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
    optionals, actor, bonuses
  });

  // Add modifiers to raise/lower the target value and crtical threshold.
  rollConfig.targetValue = (rollConfig.targetValue ?? 10) - death.targetValue;
  rollConfig.critical = (rollConfig.critical ?? 20) - death.critical;
}

/** When you roll a saving throw... */
export function _preRollAbilitySave(actor, rollConfig, abilityId) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, abilityId, {
    isConcSave: rollConfig.isConcSave
  });
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();

  // add to parts:
  const {parts, optionals} = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, {parts: [], optionals: []});
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
    optionals, actor, bonuses
  });
}

/** When you roll an ability check... */
export function _preRollAbilityTest(actor, rollConfig, abilityId) {
  const bonuses = FILTER.testCheck(actor, abilityId);
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();
  const {parts, optionals} = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, {parts: [], optionals: []});
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
}

/** When you roll a skill... */
export function _preRollSkill(actor, rollConfig, skillId) {
  const abilityId = actor.system.skills[skillId].ability; // TODO: fix in 2.2.0
  const bonuses = FILTER.testCheck(actor, abilityId, {skillId});
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();
  const {parts, optionals} = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, {parts: [], optionals: []});
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, actor, bonuses});
}

/** When you roll a tool check... */
export function _preRollToolCheck(item, rollConfig) {
  const abilityId = item.system.ability; // TODO: fix in 2.2.0
  const bonuses = FILTER.testCheck(item, abilityId);
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();
  const {parts, optionals} = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, {parts: [], optionals: []});
  if (parts.length) rollConfig.parts.push(...parts);
  foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {optionals, item, bonuses});
}

/** When you roll initiative... */
export function _preRollInitiative(actor, roll) {
  // This can barely be made functional.
  // Bonuses cannot be shown in the dialog, and optional bonuses cannot be shown and applied either.
}

/** When you roll a hit die... */
export function _preRollHitDie(actor, rollConfig, denomination) {
  const bonuses = FILTER.hitDieCheck(actor);
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();

  const denom = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    return `${acc} + ${bonus}`;
  }, denomination);
  rollConfig.formula = rollConfig.formula.replace(denomination, denom);
}

/** Render the optional bonus selector on a roll dialog. */
export async function _renderDialog(dialog) {
  const optionals = dialog.options.babonus?.optionals;
  if (!optionals?.length) return;
  dialog.options.babonus.dialog = dialog;
  new OptionalSelector(dialog.options.babonus).render();
}

/** Add a header button to display the source of all applied bonuses. */
export function _dialogHeaderButtons(dialog, buttons) {
  const bonuses = dialog.options.babonus?.bonuses;
  if (!bonuses?.length) return;
  buttons.unshift({
    class: "babonuses",
    icon: MODULE_ICON,
    onclick: () => new AppliedBonusesDialog({bonuses, dialog}).render(true)
  });
}

/** Inject babonus data on created templates if they have an associated item. */
export function _preCreateMeasuredTemplate(templateDoc) {
  const item = fromUuidSync(templateDoc.flags.dnd5e?.origin ?? "");
  if (!item) return;
  const actor = item.actor;
  if (!actor) return;
  const tokenDocument = actor.token ?? actor.getActiveTokens(false, true)[0];
  const disp = tokenDocument?.disposition ?? actor.prototypeToken.disposition;

  const bonusData = BabonusWorkshop._getCollection(item).reduce((acc, bab) => {
    if (bab.isTemplateAura) {
      acc[`flags.${MODULE}.bonuses.${bab.id}`] = bab.toObject();
    }
    return acc;
  }, {});
  if (foundry.utils.isEmpty(bonusData)) return;
  bonusData["flags.babonus.templateDisposition"] = disp;
  templateDoc.updateSource(bonusData);
}

/**
 ****************************************************
 *
 *
 *                     SETUP
 *
 *
 ****************************************************
 */

/* Settings. */
export function _createSettings() {
  game.settings.register(MODULE, SETTING_HEADERLABEL, {
    name: "BABONUS.SettingsDisplayLabelName",
    hint: "BABONUS.SettingsDisplayLabelHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE, SETTING_DISABLE_CUSTOM_SCRIPT_FILTER, {
    name: "BABONUS.SettingsDisableCustomScriptFilterName",
    hint: "BABONUS.SettingsDisableCustomScriptFilterHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register(MODULE, SETTING_MIGRATION_VERSION, {
    name: "Migration Version",
    hint: "Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  game.settings.register(MODULE, SHOW_AURA_RANGES, {
    name: "BABONUS.SettingsShowAuraRangesName",
    hint: "BABONUS.SettingsShowAuraRangesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });
}

/* Header Buttons in actors, items, effects. */
export function _addHeaderButtonActor(app, array) {
  if (app.document.type === "group") return;
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);
  const button = {
    class: MODULE, icon: MODULE_ICON,
    onclick: () => new BabonusWorkshop(app.object).render(true)
  }
  if (label) button.label = game.i18n.localize("BABONUS.ModuleTitle");
  array.unshift(button);
}

export function _addHeaderButtonItem(app, array) {
  if (["background", "class", "subclass", "race"].includes(app.object.type)) return;
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);
  const button = {
    class: MODULE, icon: MODULE_ICON,
    onclick: () => new BabonusWorkshop(app.object).render(true)
  }
  if (label) button.label = game.i18n.localize("BABONUS.ModuleTitle");
  array.unshift(button);
}

export function _addHeaderButtonEffect(app, array) {
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);
  const button = {
    class: MODULE, icon: MODULE_ICON,
    onclick: () => new BabonusWorkshop(app.object).render(true)
  }
  if (label) button.label = game.i18n.localize("BABONUS.ModuleTitle");
  array.unshift(button);
}
