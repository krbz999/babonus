import { CONSUMPTION_TYPES, MODULE } from "../constants.mjs";
import { _createBabonus } from "../helpers/helpers.mjs";

export class ConsumptionDialog extends FormApplication {
  get id() {
    return `${MODULE}ConsumptionDialog-${this.options.bab.id}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 350,
      height: "auto",
      template: `modules/${MODULE}/templates/subapplications/consumptionApp.hbs`
    });
  }

  get title() {
    return game.i18n.format("BABONUS.CONSUMPTION_APP.TITLE", { name: this.options.bab.name });
  }

  async getData() {
    return {
      choices: CONSUMPTION_TYPES,
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

  _onChangeInput(event){
    if(event.target.name !== "consume.scales") return;
    this.element[0].querySelector("[name='consume.value.max']").disabled = !event.target.checked;
  }
}
