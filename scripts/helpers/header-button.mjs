import {AppliedBonusesDialog} from "../applications/applied-bonuses-dialog.mjs";
import {BabonusWorkshop} from "../applications/babonus-workshop.mjs";
import {MODULE, SETTINGS} from "../constants.mjs";

/** Utility class that gets subclassed to inject header buttons on actors, items, and effects. */
class HeaderButton {
  /** Should the button be available for this user? */
  static get showButton() {
    return game.settings.get(MODULE.ID, SETTINGS.PLAYERS) || game.user.isGM;
  }

  /** Should the label be shown? */
  static get showLabel() {
    return game.settings.get(MODULE.ID, SETTINGS.LABEL);
  }

  /** The invalid document types that should prevent the button from being shown. */
  static get invalidTypes() {
    throw new Error("This must be subclassed.");
  }

  /** The button label. */
  static get label() {
    return game.i18n.localize("BABONUS.ModuleTitle");
  }

  /**
   * Inject the button in the application's header.
   * @param {Application} app     The rendered application.
   * @param {object[]} array      The array of buttons.
   */
  static inject(app, array) {
    if (!this.showButton) return;
    if (this.invalidTypes.includes(app.document.type)) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => new BabonusWorkshop(app.document).render(true)
    };
    if (this.showLabel) button.label = this.label;
    array.unshift(button);
  }
}

class HeaderButtonActor extends HeaderButton {
  static get invalidTypes() {
    return ["group"];
  }
}

class HeaderButtonItem extends HeaderButton {
  static get invalidTypes() {
    return ["background", "class", "subclass", "race"];
  }
}

class HeaderButtonEffect extends HeaderButton {
  static get invalidTypes() {
    return [];
  }
}

/** Add a header button to display the source of all applied bonuses. */
class HeaderButtonDialog extends HeaderButton {
  static inject(app, array) {
    const bonuses = app.options[MODULE.ID]?.bonuses;
    if (!bonuses?.length) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => new AppliedBonusesDialog({bonuses, dialog: app}).render(true)
    };
    if (this.showLabel) button.label = this.label;
    array.unshift(button);
  }
}

export default {
  actor: HeaderButtonActor.inject.bind(HeaderButtonActor),
  item: HeaderButtonItem.inject.bind(HeaderButtonItem),
  effect: HeaderButtonEffect.inject.bind(HeaderButtonEffect),
  dialog: HeaderButtonDialog.inject.bind(HeaderButtonDialog)
};
