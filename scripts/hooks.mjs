import {OptionalSelector} from "./applications/rollConfigApp.mjs";
import {MODULE, SETTINGS} from "./constants.mjs";
import {buttons} from "./helpers/headerButtons.mjs";
import {RollHooks} from "./helpers/rollHooks.mjs";
import {createAPI} from "./api.mjs";

/** Render the optional bonus selector on a roll dialog. */
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

/** Handlebars helpers. */
function _handlebarsHelpers() {
  /** Helper to capitalize each value. If more than one is given, also concatenate. */
  Handlebars.registerHelper("babonusCapitalize", function(...values) {
    return values.reduce((acc, v) => {
      if (typeof v === "string") return acc + v.capitalize();
      return acc;
    }, "");
  });
}

/* Preload all template partials for the builder. */
async function _preloadPartials() {
  console.log("Build-a-Bonus | Loading template partials.");
  return loadTemplates([
    "modules/babonus/templates/parts/bonuses-modifiers.hbs",
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

export const moduleHooks = {
  buttons: buttons,
  createSettings: _createSettings,
  handlebars: _handlebarsHelpers,
  loadPartials: _preloadPartials,
  renderDialog: _renderDialog,
  rolls: RollHooks,
  setupAPI: createAPI
};
