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

  get title() {
    return game.i18n.format("BABONUS.ConfigurationConsumptionTitle", {name: this.options.bab.name});
  }

  /** @override */
  async getData() {
    const choices = [{value: "", label: ""}];
    if (this.clone.canConsumeUses) choices.push({value: "uses", label: "DND5E.LimitedUses"});
    if (this.clone.canConsumeQuantity) choices.push({value: "quantity", label: "DND5E.Quantity"});
    if (this.clone.canConsumeSlots) choices.push({value: "slots", label: "BABONUS.ConsumptionTypeSpellSlot"});
    if (this.clone.canConsumeEffect) choices.push({value: "effect", label: "BABONUS.ConsumptionTypeEffect"});
    if (this.clone.canConsumeHealth) choices.push({value: "health", label: "BABONUS.ConsumptionTypeHealth"});
    return {
      choices,
      disableMax: (this.clone.consume.type === "effect") || (!this.clone.consume.scales),
      isEffect: this.clone.consume.type === "effect",
      isHealth: this.clone.consume.type === "health",
      disableStep: !this.clone.consume.scales,
      ...this.clone
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelectorAll("input[type='number']").forEach(n => n.addEventListener("focus", e => e.currentTarget.select()));
  }

  /** @override */
  async _updateObject(event, formData) {
    const data = foundry.utils.mergeObject({
      consume: {
        enabled: true,
        formula: null,
        scales: false,
        type: null,
        value: {min: null, max: null, step: null}
      }
    }, formData);
    return this.object.setFlag(MODULE, `bonuses.${this.options.bab.id}`, data);
  }

  /** @override */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    const {name, value, type, checked} = event.currentTarget;
    this.clone.updateSource({[name]: type === "checkbox" ? checked : (value || null)});
    await this._render();
    this.element[0].querySelector(`[name='${name}']`).focus();
  }
}
