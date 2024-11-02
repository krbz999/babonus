import {MODULE, SETTINGS} from "./constants.mjs";
import * as filterings from "./applications/filterings.mjs";
import api from "./api.mjs";
import applications from "./applications/_module.mjs";
import characterSheetTabSetup from "./applications/character-sheet-tab.mjs";
import enricherSetup from "./applications/enrichers.mjs";
import fields from "./fields/_module.mjs";
import injections from "./applications/injections.mjs";
import models from "./models/_module.mjs";
import mutators from "./mutators.mjs";
import OptionalSelector from "./applications/optional-selector.mjs";
import registry from "./registry.mjs";

// Setup API object.
globalThis.babonus = {
  ...api,
  abstract: {
    DataModels: models.Babonus,
    DataFields: {
      fields: fields,
      models: models,
    },
    TYPES: Object.keys(models.Babonus),
    applications: applications,
  },
  filters: {...filterings.filters},
};

/* -------------------------------------------------- */

/**
 * Render the optional bonus selector on a roll dialog.
 * @param {Dialog} dialog     The dialog being rendered.
 */
async function _renderDialog(dialog) {
  const m = dialog.options.babonus;
  if (!m) return;
  const r = registry.get(m.registry);
  if (!r) return;
  r.dialog = dialog;
  new OptionalSelector(m.registry).render();
}

/* -------------------------------------------------- */

/* Settings. */
function _createSettings() {
  game.settings.register(MODULE.ID, SETTINGS.PLAYERS, {
    name: "BABONUS.SettingsShowBuilderForPlayersName",
    hint: "BABONUS.SettingsShowBuilderForPlayersHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE.ID, SETTINGS.LABEL, {
    name: "BABONUS.SettingsDisplayLabelName",
    hint: "BABONUS.SettingsDisplayLabelHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE.ID, SETTINGS.SCRIPT, {
    name: "BABONUS.SettingsDisableCustomScriptFilterName",
    hint: "BABONUS.SettingsDisableCustomScriptFilterHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });

  game.settings.register(MODULE.ID, SETTINGS.AURA, {
    name: "BABONUS.SettingsShowAuraRangesName",
    hint: "BABONUS.SettingsShowAuraRangesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
  });

  game.settings.register(MODULE.ID, SETTINGS.RADIUS, {
    name: "BABONUS.SettingsPadAuraRadius",
    hint: "BABONUS.SettingsPadAuraRadiusHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Allow for modifiers to the fumble range to go below 1?
  game.settings.register(MODULE.ID, SETTINGS.FUMBLE, {
    name: "BABONUS.SettingsAllowFumbleNegationName",
    hint: "BABONUS.SettingsAllowFumbleNegationHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
  });

  game.settings.register(MODULE.ID, SETTINGS.SHEET_TAB, {
    name: "BABONUS.SettingsShowSheetTab",
    hint: "BABONUS.SettingsShowSheetTabHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true,
  });
}

/* -------------------------------------------------- */

/**
 * On-drop handler for the hotbar.
 * @param {Hotbar} bar                The hotbar application.
 * @param {object} dropData           The drop data.
 * @param {string} dropData.type      The type of the dropped document.
 * @param {string} dropData.uuid      The uuid of the dropped document.
 * @param {number} slot               The slot on the hotbar where it was dropped.
 */
async function _onHotbarDrop(bar, {type, uuid}, slot) {
  if (type !== "Babonus") return;
  const bonus = await babonus.fromUuid(uuid);
  const data = {
    img: bonus.img,
    command: `babonus.hotbarToggle("${uuid}");`,
    name: `${game.i18n.localize("BABONUS.ToggleBonus")}: ${bonus.name}`,
    type: CONST.MACRO_TYPES.SCRIPT,
  };
  const macro = game.macros.find(m => {
    return Object.entries(data).every(([k, v]) => m[k] === v) && m.isAuthor;
  }) ?? await Macro.implementation.create(data);
  return game.user.assignHotbarMacro(macro, slot);
}

/* -------------------------------------------------- */

/** Setup the global 'trees' for proficiency searching. */
async function setupTree() {
  const trees = {};
  for (const k of ["languages", "weapon", "armor", "tool", "skills"]) {
    trees[k] = await dnd5e.documents.Trait.choices(k);
  }
  babonus.trees = trees;
}

/* -------------------------------------------------- */

// General setup.
Hooks.once("init", _createSettings);
Hooks.once("init", enricherSetup);
Hooks.once("init", () => game.modules.get(MODULE.ID).api = globalThis.babonus);
Hooks.on("hotbarDrop", _onHotbarDrop);
Hooks.once("setup", () => characterSheetTabSetup());

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", (...T) => injections.HeaderButton.inject(...T));
Hooks.on("getActorSheetHeaderButtons", (...T) => injections.HeaderButton.inject(...T));
Hooks.on("getDialogHeaderButtons", (...T) => injections.HeaderButtonDialog.inject(...T));
Hooks.on("getItemSheetHeaderButtons", (...T) => injections.HeaderButton.inject(...T));
Hooks.on("renderDialog", _renderDialog);
Hooks.on("renderRollConfigurationDialog", _renderDialog);
Hooks.on("renderRegionConfig", injections.injectRegionConfigElement);

// Roll hooks. Delay these to let other modules modify behaviour first.
Hooks.once("ready", function() {
  Hooks.callAll("babonus.preInitializeRollHooks");

  // Save dcs
  Hooks.on("dnd5e.postActivityConsumption", mutators.postActivityConsumption);

  for (const name of [
    "d20Test",
    "savingThrow", "concentration", "deathSave",
    "abilityCheck", "skill", "tool",
    "attack", "damage",
    "hitDie",
  ]) {
    Hooks.on(`dnd5e.post${name.capitalize()}RollConfiguration`, (rolls, c, d, m) => {
      console.warn(name, {rolls, config: c, dialog: d, message: m});
    });
  }

  // All d20s
  Hooks.on("dnd5e.preRollD20TestV2", mutators.preRollD20);

  // Saving throws
  Hooks.on("dnd5e.preRollSavingThrowV2", mutators.preRollAbilitySave);
  Hooks.on("dnd5e.preRollConcentrationV2", mutators.preRollConcentration);
  Hooks.on("dnd5e.preRollDeathSaveV2", mutators.preRollDeathSave);

  // Checks
  Hooks.on("dnd5e.preRollAbilityCheckV2", mutators.preRollAbilityTest);
  Hooks.on("dnd5e.preRollSkillV2", mutators.preRollSkill);
  Hooks.on("dnd5e.preRollToolV2", mutators.preRollToolCheck);

  // Attacks
  Hooks.on("dnd5e.preRollAttackV2", mutators.preRollAttack);

  // Damage
  Hooks.on("dnd5e.preRollDamageV2", mutators.preRollDamage);

  // Hit dice
  Hooks.on("dnd5e.preRollHitDieV2", mutators.preRollHitDie);

  // Store data on templates
  Hooks.on("dnd5e.preCreateActivityTemplate", mutators.preCreateActivityTemplate);

  Hooks.callAll("babonus.initializeRollHooks");
});

Hooks.once("init", function() {
  const hook = game.modules.get("babele")?.active && (game.babele?.initialized === false) ? "babele.ready" : "ready";
  Hooks.once(hook, () => setupTree());
});

Hooks.once("i18nInit", function() {
  for (const model of Object.values(babonus.abstract.DataFields.models.Babonus)) {
    Localization.localizeDataModel(model);
  }

  const localizeObject = object => {
    for (const [k, v] of Object.entries(object)) {
      object[k] = game.i18n.localize(v);
    }
  };

  localizeObject(MODULE.ATTACK_MODES_CHOICES);
  localizeObject(MODULE.CONSUMPTION_TYPES);
  localizeObject(MODULE.DISPOSITION_TYPES);
  localizeObject(MODULE.HEALTH_PERCENTAGES_CHOICES);
  localizeObject(MODULE.MODIFIER_MODES);
  localizeObject(MODULE.SPELL_COMPONENT_CHOICES);
  localizeObject(MODULE.TOKEN_SIZES_CHOICES);
});
