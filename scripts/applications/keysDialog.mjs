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
    data.canExclude = this.options.canExclude;
    data.description = `BABONUS.Filters${this.options.filterId.capitalize()}Tooltip`;
    data.values = this.options.values;
    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("[data-action='cycle-all']").forEach(n => {
      n.addEventListener("click", this._onCycleAll.bind(this));
    });
    html[0].querySelectorAll("[data-action='cycle']").forEach(n => {
      n.addEventListener("click", this._onCycleRight.bind(this));
    });
    html[0].querySelectorAll("[data-action='cycle-left']").forEach(n => {
      n.addEventListener("click", this._onCycleLeft.bind(this));
    });
    html[0].querySelectorAll("[data-action='cycle-right']").forEach(n => {
      n.addEventListener("click", this._onCycleRight.bind(this));
    });
  }

  /**
   * Cycle all selects in a column between the valid options.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onCycleAll(event) {
    const table = event.currentTarget.closest(".babonus.keys-dialog table");
    const selects = table.querySelectorAll("select");
    const newIndex = (selects[0].selectedIndex + 1) % selects[0].options.length;
    selects.forEach(select => select.selectedIndex = newIndex);
  }

  /**
   * Custom implementation for label-to-checkbox linking.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onCycleRight(event) {
    const select = event.currentTarget.closest("tr").querySelector("select");
    const newIndex = (select.selectedIndex + 1) % select.options.length;
    select.selectedIndex = newIndex;
  }

  /**
   * Cycle backwards in the select options.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onCycleLeft(event) {
    const select = event.currentTarget.closest("tr").querySelector("select");
    const n = select.selectedIndex - 1;
    const mod = select.options.length;
    const newIndex = ((n % mod) + mod) % mod;
    select.selectedIndex = newIndex;
  }
}
