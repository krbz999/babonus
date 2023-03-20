import {MODULE} from "../constants.mjs";

export class BabonusKeysDialog extends Dialog {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: [MODULE, "keys-dialog"],
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
    html[0].querySelectorAll("td:first-child").forEach(n => n.addEventListener("click", this._onClickLabel.bind(this)));
  }

  /**
   * Toggle all inputs in a column to be checked if the first is unchecked, and vice versa.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onToggleAll(event) {
    const idx = event.currentTarget.dataset.index;
    const table = event.currentTarget.closest(".babonus.keys-dialog table");
    const inputs = table.querySelectorAll(`td:nth-child(${idx}) input`);
    const state = !inputs[0].checked;
    inputs.forEach(i => i.checked = state);
  }

  /**
   * Custom implementation for label-to-checkbox linking.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onClickLabel(event) {
    if (this.options.double) {
      const box1 = event.currentTarget.closest("tr").querySelector("td:nth-child(2) input");
      const box2 = event.currentTarget.closest("tr").querySelector("td:nth-child(3) input");
      if (!box1.checked && !box2.checked) {
        box1.checked = true;
        box2.checked = false;
      } else if (box1.checked && !box2.checked) {
        box1.checked = false;
        box2.checked = true;
      } else {
        box1.checked = false;
        box2.checked = false;
      }
    } else {
      const box = event.currentTarget.closest("tr").querySelector("td:nth-child(2) input");
      box.checked = !box.checked;
    }
  }
}
