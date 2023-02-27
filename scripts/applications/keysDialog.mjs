import {MODULE} from "../constants.mjs";

export class BabonusKeysDialog extends Dialog {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dialog", "babonus", "keys-dialog"],
      resizable: true,
      height: 600,
      width: 400
    });
  }

  get id() {
    return `${MODULE}KeysDialog-${this.options.filterId}-${this.options.appId}`;
  }

  get template() {
    return "modules/babonus/templates/subapplications/keysDialog.hbs";
  }

  get title() {
    return game.i18n.format("BABONUS.KeysDialogTitle", {
      name: game.i18n.localize(`BABONUS.Filters${this.options.filterId.capitalize()}`)
    });
  }

  /** @override */
  async getData() {
    const data = await super.getData();
    data.double = this.options.double;
    data.description = `BABONUS.Filters${this.options.filterId.capitalize()}Tooltip`;
    data.lists = this.options.lists;
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-action='select-all']").forEach(n => n.addEventListener("click", this._onToggleAll.bind(this)));
  }

  /**
   * Toggle all inputs in a column to be checked if the first is unchecked, and vice versa.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onToggleAll(event) {
    const idx = event.currentTarget.dataset.index;
    const table = event.currentTarget.closest(".babonus.keys-dialog table");
    const inputs = table.querySelectorAll(`td:nth-child(${idx}) input`);
    const state = !inputs[0].checked;
    inputs.forEach(i => i.checked = state);
  }
}
