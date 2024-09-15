import {MODULE, SETTINGS} from "../constants.mjs";
import {AppliedBonusesDialog} from "./applied-bonuses-dialog.mjs";

/** Utility class that gets subclassed to inject header buttons on actors, items, and effects. */
class HeaderButton {
  /**
   * Should the button be available for this user?
   * @type {boolean}
   */
  static get showButton() {
    return game.settings.get(MODULE.ID, SETTINGS.PLAYERS) || game.user.isGM;
  }

  /* -------------------------------------------------- */

  /**
   * Should the label be shown?
   * @type {boolean}
   */
  static get showLabel() {
    return game.settings.get(MODULE.ID, SETTINGS.LABEL);
  }

  /* -------------------------------------------------- */

  /**
   * The invalid document types that should prevent the button from being shown.
   * @type {Set<string>}
   */
  static get invalidTypes() {
    throw new Error("This must be subclassed.");
  }

  /* -------------------------------------------------- */

  /**
   * The button label.
   * @type {string}
   */
  static get label() {
    return game.i18n.localize("BABONUS.ModuleTitle");
  }

  /* -------------------------------------------------- */

  /**
   * Inject the button in the application's header.
   * @param {Application} app     The rendered application.
   * @param {object[]} array      The array of buttons.
   */
  static inject(app, array) {
    if (!this.showButton) return;
    if (this.invalidTypes.has(app.document.type)) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => babonus.openBabonusWorkshop(app.document)
    };
    if (this.showLabel) button.label = this.label;
    array.unshift(button);
  }
}

/* -------------------------------------------------- */

export class HeaderButtonActor extends HeaderButton {
  /** @override */
  static get invalidTypes() {
    return new Set(["group"]);
  }

  /* -------------------------------------------------- */

  /** @override */
  static inject(app, array) {
    if (!["ActorSheet5eCharacter2", "ActorSheet5eNPC2", "ItemSheet5e2"].includes(app.constructor.name)) {
      return super.inject(app, array);
    }
    if (!this.showButton || this.invalidTypes.has(app.document.type)) return;
    if (game.settings.get(MODULE.ID, SETTINGS.SHEET_TAB)) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => babonus.openBabonusWorkshop(app.document),
      label: this.label
    };
    array.unshift(button);
  }
}

/* -------------------------------------------------- */

export class HeaderButtonItem extends HeaderButton {
  /** @override */
  static get invalidTypes() {
    return new Set();
  }
}

/* -------------------------------------------------- */

export class HeaderButtonEffect extends HeaderButton {
  /** @override */
  static get invalidTypes() {
    return new Set();
  }
}

/* -------------------------------------------------- */

/** Add a header button to display the source of all applied bonuses. */
export class HeaderButtonDialog extends HeaderButton {
  /** @override */
  static inject(app, array) {
    const id = app.options[MODULE.ID]?.registry;
    if (!id) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => new AppliedBonusesDialog({id, dialog: app}).render(true)
    };
    if (this.showLabel) button.label = this.label;
    array.unshift(button);
  }
}

/* -------------------------------------------------- */

/** Inject form element on scene region configs. */
export function injectRegionConfigElement(config, element) {
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
