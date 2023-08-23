import {AppliedBonusesDialog} from "../applications/appliedBonusesDialog.mjs";
import {BabonusWorkshop} from "../applications/babonus.mjs";
import {MODULE, SETTINGS} from "../constants.mjs";

/** Utility class that gets subclassed to inject header buttons on actors, items, and effects. */
class InjectHeaderButton {
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
    button.label = this.showLabel ? this.label : '';
    array.unshift(button);
  }
}

class InjectHeaderButtonActor extends InjectHeaderButton {
  static get invalidTypes() {
    return ["group"];
  }
}

class InjectHeaderButtonItem extends InjectHeaderButton {
  static get invalidTypes() {
    return ["background", "class", "subclass", "race"];
  }
}

class InjectHeaderButtonEffect extends InjectHeaderButton {
  static get invalidTypes() {
    return [];
  }
}

/** Add a header button to display the source of all applied bonuses. */
class InjectHeaderButtonDialog extends InjectHeaderButton {
  static inject(app, array) {
    const bonuses = app.options[MODULE.ID]?.bonuses;
    if (!bonuses?.length) return;
    const button = {
      class: MODULE.ID,
      icon: MODULE.ICON,
      onclick: () => new AppliedBonusesDialog({bonuses, dialog: app}).render(true)
    };
    button.label = this.showLabel ? this.label : '';
    array.unshift(button);
  }
}

export const buttons = {
  actor: InjectHeaderButtonActor.inject.bind(InjectHeaderButtonActor),
  item: InjectHeaderButtonItem.inject.bind(InjectHeaderButtonItem),
  effect: InjectHeaderButtonEffect.inject.bind(InjectHeaderButtonEffect),
  dialog: InjectHeaderButtonDialog.inject.bind(InjectHeaderButtonDialog)
};
