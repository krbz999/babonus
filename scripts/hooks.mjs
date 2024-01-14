import {OptionalSelector} from "./applications/optional-selector.mjs";
import {MODULE, SETTINGS} from "./constants.mjs";
import buttons from "./helpers/header-button.mjs";
import {RollHooks} from "./helpers/roll-hooks.mjs";
import {createAPI} from "./api.mjs";

/**
 * Render the optional bonus selector on a roll dialog.
 * @TODO Await system PR that should allow for more data to be passed along, as well as the roll refactor.
 * @param {Dialog} dialog     The dialog being rendered.
 */
async function _renderDialog(dialog) {
  const optionals = dialog.options.babonus?.optionals;
  if (!optionals?.length) return;
  dialog.options.babonus.dialog = dialog;
  new OptionalSelector(dialog.options.babonus).render();
}

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
}

/* Preload all template partials for the builder. */
async function _preloadPartials() {
  console.log("Build-a-Bonus | Loading template partials.");
  return loadTemplates([
    "modules/babonus/templates/parts/checkboxes-select.hbs",
    "modules/babonus/templates/parts/checkboxes.hbs",
    "modules/babonus/templates/parts/range-select.hbs",
    "modules/babonus/templates/parts/select-number-checkbox.hbs",
    "modules/babonus/templates/parts/text-dash-text.hbs",
    "modules/babonus/templates/parts/text-keys.hbs",
    "modules/babonus/templates/parts/text-select-text.hbs",
    "modules/babonus/templates/parts/textarea.hbs"
  ]);
}
// General setup.
Hooks.once("setup", createAPI);
Hooks.once("setup", _createSettings);
Hooks.once("setup", _preloadPartials);

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", buttons.effect);
Hooks.on("getActorSheetHeaderButtons", buttons.actor);
Hooks.on("getDialogHeaderButtons", buttons.dialog);
Hooks.on("getItemSheetHeaderButtons", buttons.item);
Hooks.on("renderDialog", _renderDialog);

// Roll hooks. Delay these to let other modules modify behaviour first.
Hooks.once("ready", function() {
  Hooks.on("dnd5e.preDisplayCard", RollHooks.preDisplayCard);
  Hooks.on("dnd5e.preRollAbilitySave", RollHooks.preRollAbilitySave);
  Hooks.on("dnd5e.preRollAbilityTest", RollHooks.preRollAbilityTest);
  Hooks.on("dnd5e.preRollAttack", RollHooks.preRollAttack);
  Hooks.on("dnd5e.preRollDamage", RollHooks.preRollDamage);
  Hooks.on("dnd5e.preRollDeathSave", RollHooks.preRollDeathSave);
  Hooks.on("dnd5e.preRollHitDie", RollHooks.preRollHitDie);
  Hooks.on("dnd5e.preRollSkill", RollHooks.preRollSkill);
  Hooks.on("dnd5e.preRollToolCheck", RollHooks.preRollToolCheck);
  Hooks.on("preCreateMeasuredTemplate", RollHooks.preCreateMeasuredTemplate);
});
