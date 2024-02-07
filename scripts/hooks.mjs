import {OptionalSelector} from "./applications/optional-selector.mjs";
import {MODULE, SETTINGS} from "./constants.mjs";
import buttons from "./helpers/header-button.mjs";
import {RollHooks} from "./helpers/roll-hooks.mjs";
import {createAPI} from "./api.mjs";
import {BabonusWorkshop} from "./applications/babonus-workshop.mjs";

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
    default: true,
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
 * Handle rendering a new tab on the v2 character sheet.
 * @param {ActorSheet5eCharacter2} sheet      The rendered sheet.
 * @param {HTMLElement} html                  The element of the sheet.
 */
async function _onRenderCharacterSheet2(sheet, [html]) {
  const template = "modules/babonus/templates/subapplications/character-sheet-tab.hbs";
  const rollData = sheet.document.getRollData();
  const bonuses = await babonus.getCollection(sheet.actor).reduce(async (acc, bonus) => {
    acc = await acc;
    const section = acc[bonus.type] ?? {};
    section.label ??= "BABONUS.Type" + bonus.type.capitalize();
    section.key ??= bonus.type;
    section.bonuses ??= [];
    section.bonuses.push({
      bonus: bonus,
      labels: bonus.sheet._prepareLabels().slice(1).filterJoin(" &bull; "),
      tooltip: await TextEditor.enrichHTML(bonus.description, {rollData})
    });
    acc[bonus.type] ??= section;
    return acc;
  }, {});
  bonuses.all = {label: "BABONUS.Bonuses", key: "all", bonuses: []};
  const div = document.createElement("DIV");
  const isActive = sheet._tabs[0].active === MODULE.ID ? "active" : "";
  const isEdit = sheet.constructor.MODES.EDIT === sheet._mode;

  sheet._filters[MODULE.ID] ??= {name: "", properties: new Set()};
  div.innerHTML = await renderTemplate(template, {
    ICON: MODULE.ICON,
    parentName: sheet.document.name,
    isActive: isActive,
    isEdit: isEdit,
    sections: Object.values(bonuses).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
  });

  div.querySelectorAll("[data-action]").forEach(n => {
    const id = n.closest("[data-item-id]")?.dataset.itemId;
    const bonus = babonus.getId(sheet.document, id);
    switch (n.dataset.action) {
      case "toggle": n.addEventListener("click", (event) => bonus.toggle()); break;
      case "edit": n.addEventListener("click", (event) => bonus.sheet.render(true)); break;
      case "delete": n.addEventListener("click", (event) => bonus.delete()); break;
      case "otter-dance": n.addEventListener("click", BabonusWorkshop.prototype._onOtterDance); break;
    }
  });

  html.querySelector(".tab-body").appendChild(div.firstElementChild);

  html.querySelector("button.create-child").addEventListener("click", _createChildBonus.bind(sheet));
}

async function _createChildBonus() {
  if (this._tabs[0]?.active !== MODULE.ID) return;
  const template = "systems/dnd5e/templates/apps/document-create.hbs";
  const data = {
    folders: [],
    folder: null,
    hasFolders: false,
    name: game.i18n.localize("BABONUS.NewBabonus"),
    type: babonus.abstract.TYPES[0],
    types: babonus.abstract.TYPES.reduce((acc, type) => {
      const label = game.i18n.localize(`BABONUS.Type${type.capitalize()}`);
      acc.push({
        type: type,
        label: label,
        icon: babonus.abstract.DataModels[type].defaultImg
      });
      return acc;
    }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
  };
  const title = game.i18n.localize("BABONUS.Create");
  return Dialog.prompt({
    content: await renderTemplate(template, data),
    label: title,
    title: title,
    render: (html) => {
      const app = html.closest(".app");
      app.querySelectorAll(".window-header .header-button").forEach(btn => {
        const label = btn.innerText;
        const icon = btn.querySelector("i");
        btn.innerHTML = icon.outerHTML;
        btn.dataset.tooltip = label;
        btn.setAttribute("aria-label", label);
      });
      app.querySelector(".document-name").select();
    },
    callback: async (html) => {
      const data = new FormDataExtended(html.querySelector("FORM")).object;
      if (!data.name?.trim()) data.name = game.i18n.localize("BABONUS.NewBabonus");
      const bonus = babonus.createBabonus(data, this.document);
      return babonus.embedBabonus(this.document, bonus);
    },
    rejectClose: false,
    options: {jQuery: false, width: 350, classes: ["dnd5e2", "create-document", "dialog", "babonus"]}
  });
}

/**
 * Add a new tab to the v2 character sheet.
 */
function _addCharacterTab() {
  const cls = dnd5e.applications.actor.ActorSheet5eCharacter2;
  cls.TABS.push({
    tab: MODULE.ID, label: MODULE.NAME, icon: MODULE.ICON
  });
  const fn = cls.prototype._filterChildren;
  class sheet extends cls {
    /** @override */
    _filterChildren(collection, filters) {
      if (collection !== "babonus") return fn.call(this, collection, filters);
      return Array.from(babonus.getCollection(this.document));
    }
  };
  cls.prototype._filterChildren = sheet.prototype._filterChildren;
}

Hooks.once("setup", function() {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHEET_TAB)) return;
  if (!game.user.isGM && !game.settings.get(MODULE.ID, SETTINGS.PLAYERS)) return;
  _addCharacterTab();
  Hooks.on("renderActorSheet5eCharacter2", _onRenderCharacterSheet2);
});

// General setup.
Hooks.once("init", _createSettings);
Hooks.once("setup", createAPI);
Hooks.once("setup", _preloadPartials);
Hooks.on("hotbarDrop", _onHotbarDrop);

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
