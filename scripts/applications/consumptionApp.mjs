import {MODULE} from "../constants.mjs";

export class ConsumptionDialog extends FormApplication {
  constructor(object, options = {}) {
    super(object, options);
    this.clone = options.bab.clone();
  }

  get id() {
    return `${MODULE}ConsumptionDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/consumptionApp.hbs`,
      classes: [MODULE, "consumption-config"]
    });
  }

  get document() {
    return this.object;
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationConsumptionTitle", {name: this.options.bab.name});
  }

  /** @override */
  async getData() {
    const consume = this.clone.consume;
    return {
      clone: this.clone,
      choices: consume.OPTIONS,
      disableMax: (consume.type === "effect") || (!consume.scales),
      isEffect: consume.type === "effect",
      isHealth: consume.type === "health",
      disableStep: !consume.scales
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("input[type='number']").forEach(n => {
      n.addEventListener("focus", e => e.currentTarget.select());
    });
  }

  /** @override */
  async _updateObject(event, formData) {
    const defaults = this.clone.getDefaults("consume");
    const data = foundry.utils.mergeObject({consume: defaults}, formData);
    return this.document.setFlag(MODULE, `bonuses.${this.options.bab.id}`, data);
  }

  /** @override */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    const {name, value, type, checked} = event.currentTarget;
    this.clone.updateSource({[name]: (type === "checkbox") ? checked : (value || null)});
    await this._render();
    this.element[0].querySelector(`[name='${name}']`).focus();
  }
}
