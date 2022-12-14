import {
  ILLEGAL_ITEM_TYPES,
  MODULE,
  MODULE_ICON,
  SETTING_DISABLE_CUSTOM_SCRIPT_FILTER,
  SETTING_HEADERLABEL,
  SETTING_MIGRATION_VERSION
} from "./constants.mjs";
import { _openWorkshop } from "./helpers/helpers.mjs";

export function _setup() {
  CONFIG.DND5E.characterFlags[MODULE] = {
    name: game.i18n.localize("BABONUS.SpecialTraitsName"),
    hint: game.i18n.localize("BABONUS.SpecialTraitsHint"),
    section: game.i18n.localize("BABONUS.ModuleTitle"),
    type: Boolean
  }

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
}

export function _renderActorSheetFlags(app, html) {
  const input = html[0].querySelector("input[name='flags.dnd5e.babonus']");
  const button = document.createElement("A");
  button.name = "flags.dnd5e.babonus";
  const label = game.i18n.localize("BABONUS.ModuleTitle");
  button.innerHTML = `<i class="${MODULE_ICON}"></i> ${label}`;
  input.replaceWith(button);
  button.addEventListener("click", () => {
    _openWorkshop(app.object);
  });
}

export function _getItemSheetHeaderButtons(app, array) {
  if (ILLEGAL_ITEM_TYPES.includes(app.object.type)) return;
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);

  const headerButton = {
    class: MODULE,
    icon: MODULE_ICON,
    onclick: () => {
      _openWorkshop(app.object);
    }
  }
  if (label) {
    const header = "BABONUS.ModuleTitle";
    headerButton.label = game.i18n.localize(header);
  }
  array.unshift(headerButton);
}

export function _getActiveEffectConfigHeaderButtons(app, array) {
  const label = game.settings.get(MODULE, SETTING_HEADERLABEL);

  const headerButton = {
    class: MODULE,
    icon: MODULE_ICON,
    onclick: async () => {
      _openWorkshop(app.object);
    }
  }
  if (label) {
    const header = "BABONUS.ModuleTitle";
    headerButton.label = game.i18n.localize(header);
  }
  array.unshift(headerButton);
}
