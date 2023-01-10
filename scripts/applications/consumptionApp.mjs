import { MODULE } from "../constants.mjs";
import { _createBabonus } from "../helpers/helpers.mjs";

export class ConsumptionDialog extends FormApplication {
  get id() {
    return `${MODULE}ConsumptionDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 400,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/consumptionApp.hbs`
    });
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationConsumptionTitle", { name: this.options.bab.name });
  }

  async getData() {
    const is = this.options.bab.item.system;
    const choices = [{ value: "", label: "" }];
    if (is.uses !== undefined) choices.push({ value: "uses", label: "DND5E.LimitedUses" });
    if (is.quantity !== undefined) choices.push({ value: "quantity", label: "DND5E.Quantity" });
    return {
      choices,
      value: this.options.bab.consume.type,
      consume: this.options.bab.consume // scales, value (min, max), type, enabled
    }
  }

  async _updateObject(event, formData) {
    try {
      formData["consume.enabled"] = true;
      const data = foundry.utils.mergeObject(this.options.bab.toString(), formData);
      _createBabonus(data); // attempt.
      return this.object.setFlag(MODULE, `bonuses.${this.options.bab.id}`, formData);
    } catch (err) {
      console.error(err);
    }
  }

  _onChangeInput(event) {
    if (event.target.name !== "consume.scales") return;
    this.element[0].querySelector("[name='consume.value.max']").disabled = !event.target.checked;
  }
}
