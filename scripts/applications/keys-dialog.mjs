import {MODULE} from "../constants.mjs";

export class KeysDialog extends foundry.applications.api.DialogV2 {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: [MODULE.ID, "keys-dialog"],
    modal: true,
    window: {
      resizable: true,
      icon: "fa-solid fa-otter"
    },
    position: {
      height: "auto",
      width: 400
    },
    actions: {
      cycleAll: this._onCycleAll,
      cycleRight: this._onCycleRight,
      cycleLeft: this._onCycleLeft,
      cycle: this._onCycleRight
    }
  };

  /** @override */
  static async prompt({canExclude, values, filterId, ...configuration} = {}) {
    configuration.content = await renderTemplate(`modules/${MODULE.ID}/templates/subapplications/keys-dialog.hbs`, {
      canExclude, values, description: `BABONUS.Filters.${filterId.capitalize()}.Hint`
    });
    configuration.filterId = filterId;
    configuration.rejectClose = false;
    return super.prompt(configuration);
  }

  /** @override */
  get title() {
    return game.i18n.format("BABONUS.KeysDialogTitle", {
      name: game.i18n.localize(`BABONUS.Filters${this.options.filterId.capitalize()}`)
    });
  }

  /**
   * Cycle all selects in a column between the valid options.
   * @param {Event} event     The initiating click event.
   */
  static _onCycleAll(event, target) {
    const table = target.closest(".table");
    const selects = table.querySelectorAll("select");
    const newIndex = (selects[0].selectedIndex + 1) % selects[0].options.length;
    selects.forEach(select => select.selectedIndex = newIndex);
  }

  /**
   * Custom implementation for label-to-checkbox linking.
   * @param {Event} event     The initiating click event.
   */
  static _onCycleRight(event, target) {
    const select = target.closest(".row").querySelector(".select select");
    const newIndex = (select.selectedIndex + 1) % select.options.length;
    select.selectedIndex = newIndex;
  }

  /**
   * Cycle backwards in the select options.
   * @param {Event} event     The initiating click event.
   */
  static _onCycleLeft(event, target) {
    const select = target.nextElementSibling;
    const n = select.selectedIndex - 1;
    const mod = select.options.length;
    const newIndex = ((n % mod) + mod) % mod;
    select.selectedIndex = newIndex;
  }
}
