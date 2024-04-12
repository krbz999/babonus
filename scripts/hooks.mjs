import {OptionalSelector} from "./applications/optional-selector.mjs";
import {MODULE, SETTINGS} from "./constants.mjs";
import buttons from "./helpers/header-button.mjs";
import {RollHooks} from "./helpers/roll-hooks.mjs";
import {createAPI} from "./api.mjs";
import {CharacterSheetTab} from "./applications/character-sheet-tab.mjs";

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
  }) ?? await Macro.create(data);
  return game.user.assignHotbarMacro(macro, slot);
}

/**
 * Setup the global 'trees' for proficiency searching.
 * @returns {Promise<object>}     The object of proficiency or trait trees.
 */
async function setupTree() {
  const trees = {};
  for (const k of ["languages", "weapon", "armor", "tool"]) {
    trees[k] = await dnd5e.documents.Trait.choices(k);
  }
  return trees;
}

// General setup.
Hooks.once("init", _createSettings);
Hooks.once("setup", createAPI);
Hooks.once("setup", _preloadPartials);
Hooks.on("hotbarDrop", _onHotbarDrop);
Hooks.once("setup", CharacterSheetTab.setup);

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", buttons.effect);
Hooks.on("getActorSheetHeaderButtons", buttons.actor);
Hooks.on("getDialogHeaderButtons", buttons.dialog);
Hooks.on("getItemSheetHeaderButtons", buttons.item);
Hooks.on("renderDialog", _renderDialog);

// Roll hooks. Delay these to let other modules modify behaviour first.
Hooks.once("ready", async function() {
  Hooks.on("dnd5e.preDisplayCard", RollHooks.preDisplayCard);
  Hooks.on("dnd5e.preRollAbilitySave", RollHooks.preRollAbilitySave);
  Hooks.on("dnd5e.preRollAbilityTest", RollHooks.preRollAbilityTest);
  Hooks.on("dnd5e.preRollAttack", RollHooks.preRollAttack);
  Hooks.on("dnd5e.preRollDamage", RollHooks.preRollDamage);
  Hooks.on("dnd5e.preRollDeathSave", RollHooks.preRollDeathSave);
  Hooks.on("dnd5e.preRollHitDie", RollHooks.preRollHitDie);
  Hooks.on("dnd5e.preRollSkill", RollHooks.preRollSkill);
  Hooks.on("dnd5e.preRollToolCheck", RollHooks.preRollToolCheck);
  Hooks.on("dnd5e.preCreateItemTemplate", RollHooks.preCreateItemTemplate);

  babonus.trees = await setupTree();
});
