import {MODULE, SETTINGS} from "../constants.mjs";
import AppliedBonusesDialog from "./applied-bonuses-dialog.mjs";

/**
 * Utility class for injecting header buttons onto actor, item, and effect sheets.
 */
class HeaderButton {
  constructor(application) {
    this.#application = application;
  }

  /* -------------------------------------------------- */

  /**
   * The sheet that is having a header button or tab attached.
   */
  #application = null;

  /* -------------------------------------------------- */

  /**
   * Should the button be available for this user?
   * @type {boolean}
   */
  get showButton() {
    return game.settings.get(MODULE.ID, SETTINGS.PLAYERS) || game.user.isGM;
  }

  /* -------------------------------------------------- */

  /**
   * Should the label be shown in a header button or just icon?
   * @type {boolean}
   */
  get showLabel() {
    switch (this.#application.constructor.name) {
      case "ActorSheet5eCharacter2":
      case "ActorSheet5eNPC2":
      case "ItemSheet5e2":
      case "ContainerSheet2":
        return true;
      default:
        return game.settings.get(MODULE.ID, SETTINGS.LABEL);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Does this application show a tab instead of a button?
   * @type {boolean}
   */
  get showTab() {
    switch (this.#application.constructor.name) {
      case "ActorSheet5eCharacter2":
      case "ActorSheet5eNPC2":
        return game.settings.get(MODULE.ID, SETTINGS.SHEET_TAB);
      default:
        return false;
    }
  }

  /* -------------------------------------------------- */

  /**
   * The invalid document types that should prevent the button from being shown.
   * @type {Set<string>}
   */
  get invalidTypes() {
    switch (this.#application.document.documentName) {
      case "Actor":
        return new Set(["group"]);
      default:
        return new Set();
    }
  }

  /* -------------------------------------------------- */

  /**
   * The button label.
   * @type {string}
   */
  get label() {
    return game.i18n.localize("BABONUS.ModuleTitle");
  }

  /* -------------------------------------------------- */

  /**
   * Inject the button in the application's header.
   * @param {Application} application     The rendered application.
   * @param {object[]} array              The array of buttons.
   */
  static inject(application, array) {
    const instance = new this(application);

    // Invalid document subtype.
    if (instance.invalidTypes.has(application.document.type)) return;

    // This application shows a tab instead of a header button.
    if (instance.showTab) return;

    // Header buttons are disabled.
    if (!instance.showButton) return;

    // Insert button.
    array.unshift({
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => babonus.openBabonusWorkshop(application.document),
      label: instance.showLabel ? instance.label : ""
    });
  }
}

/* -------------------------------------------------- */

/**
 * Add a header button to display the source of all applied bonuses.
 * // TODO: pending the roll refactor, redo this for new roll config dialog.
 */
class HeaderButtonDialog extends HeaderButton {
  /** @override */
  static inject(application, array) {
    const id = application.options[MODULE.ID]?.registry;
    if (!id) return;

    const instance = new this(application);
    array.unshift({
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => new AppliedBonusesDialog({id, dialog: application}).render(true),
      label: instance.showLabel ? instance.label : ""
    });
  }
}

/* -------------------------------------------------- */

/** Inject form element on scene region configs. */
function injectRegionConfigElement(config, element) {
  if (!config.isEditable) return;
  const fg = element.querySelector("[name=visibility]").closest(".form-group");
  const div = document.createElement("FIELDSET");
  div.classList.add("babonus");
  div.innerHTML = `
  <legend>${game.i18n.localize("BABONUS.ModuleTitle")}</legend>
  <button type="button" data-action="babonusBuilder">
    <i class="fa-solid fa-otter"></i>
    ${game.i18n.localize("BABONUS.ModuleTitle")}
  </button>
  <p class="hint">${game.i18n.localize("BABONUS.RegionConfigHint")}</p>`;
  div.querySelector("[data-action]").addEventListener("click", (event) => babonus.openBabonusWorkshop(config.document));
  fg.after(div);
}

/* -------------------------------------------------- */

export default {
  HeaderButton,
  HeaderButtonDialog,
  injectRegionConfigElement
};
