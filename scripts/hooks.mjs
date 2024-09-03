import {MODULE, SETTINGS} from "./constants.mjs";
import {
  HeaderButtonActor,
  HeaderButtonDialog,
  HeaderButtonEffect,
  HeaderButtonItem,
  injectRegionConfigElement
} from "./applications/header-button.mjs";
import {createAPI} from "./api.mjs";
import {RollHooks, registry} from "./applications/roll-hooks.mjs";
import {OptionalSelector} from "./applications/optional-selector.mjs";
import characterSheetTabSetup from "./applications/character-sheet-tab.mjs";
import enricherSetup from "./applications/enrichers.mjs";

/**
 * Render the optional bonus selector on a roll dialog.
 * @TODO Await system PR that should allow for more data to be passed along, as well as the roll refactor.
 * @param {Dialog} dialog     The dialog being rendered.
 */
async function _renderDialog(dialog) {
  const m = dialog.options.babonus;
  if (!m) return;
  const r = registry.get(m.registry);
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
    default: true
  });

  game.settings.register(MODULE.ID, SETTINGS.LABEL, {
    name: "BABONUS.SettingsDisplayLabelName",
    hint: "BABONUS.SettingsDisplayLabelHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE.ID, SETTINGS.SCRIPT, {
    name: "BABONUS.SettingsDisableCustomScriptFilterName",
    hint: "BABONUS.SettingsDisableCustomScriptFilterHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register(MODULE.ID, SETTINGS.AURA, {
    name: "BABONUS.SettingsShowAuraRangesName",
    hint: "BABONUS.SettingsShowAuraRangesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register(MODULE.ID, SETTINGS.RADIUS, {
    name: "BABONUS.SettingsPadAuraRadius",
    hint: "BABONUS.SettingsPadAuraRadiusHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  // Allow for modifiers to the fumble range to go below 1?
  game.settings.register(MODULE.ID, SETTINGS.FUMBLE, {
    name: "BABONUS.SettingsAllowFumbleNegationName",
    hint: "BABONUS.SettingsAllowFumbleNegationHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register(MODULE.ID, SETTINGS.SHEET_TAB, {
    name: "BABONUS.SettingsShowSheetTab",
    hint: "BABONUS.SettingsShowSheetTabHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
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
    type: CONST.MACRO_TYPES.SCRIPT
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
Hooks.once("setup", createAPI);
Hooks.on("hotbarDrop", _onHotbarDrop);
Hooks.once("setup", () => characterSheetTabSetup());

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", (...T) => HeaderButtonEffect.inject(...T));
Hooks.on("getActorSheetHeaderButtons", (...T) => HeaderButtonActor.inject(...T));
Hooks.on("getDialogHeaderButtons", (...T) => HeaderButtonDialog.inject(...T));
Hooks.on("getItemSheetHeaderButtons", (...T) => HeaderButtonItem.inject(...T));
Hooks.on("renderDialog", _renderDialog);
Hooks.on("renderRegionConfig", injectRegionConfigElement);

// Roll hooks. Delay these to let other modules modify behaviour first.
Hooks.once("ready", function() {
  Hooks.callAll("babonus.preInitializeRollHooks");

  Hooks.on("dnd5e.preDisplayCard", RollHooks.preDisplayCard);
  Hooks.on("dnd5e.preRollAbilitySave", RollHooks.preRollAbilitySave);
  Hooks.on("dnd5e.preRollAbilityTest", RollHooks.preRollAbilityTest);
  Hooks.on("dnd5e.preRollAttackV2", RollHooks.preRollAttack);
  Hooks.on("dnd5e.preRollDamageV2", RollHooks.preRollDamage);
  Hooks.on("dnd5e.preRollDeathSave", RollHooks.preRollDeathSave);
  Hooks.on("dnd5e.preRollHitDieV2", RollHooks.preRollHitDie);
  Hooks.on("dnd5e.preRollSkill", RollHooks.preRollSkill);
  Hooks.on("dnd5e.preRollToolCheck", RollHooks.preRollToolCheck);
  Hooks.on("dnd5e.preCreateItemTemplate", RollHooks.preCreateItemTemplate);
  setupTree();

  Hooks.callAll("babonus.initializeRollHooks");
});
