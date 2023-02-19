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
      template: `modules/${MODULE}/templates/subapplications/consumptionApp.hbs`,
      classes: [MODULE, "consumption-config"]
    });
  }

  get title() {
    return game.i18n.format("BABONUS.ConfigurationConsumptionTitle", { name: this.options.bab.name });
  }

  /** @override */
  async getData() {
    const bab = this.options.bab;
    const choices = [{ value: "", label: "" }];
    if (bab.canConsumeUses) choices.push({ value: "uses", label: "DND5E.LimitedUses" });
    if (bab.canConsumeQuantity) choices.push({ value: "quantity", label: "DND5E.Quantity" });
    if (bab.canConsumeSlots) choices.push({ value: "slots", label: "BABONUS.ConsumptionTypeSpellSlot" });
    return {
      choices,
      value: bab.consume.type,
      consume: bab.consume // scales, value (min, max), type, enabled
    }
  }

  /** @override */
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

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html[0].querySelector("[name='consume.scales']").addEventListener("change", this._onChangeScales.bind(this));
  }

  /**
   * Toggles the disabled state on the 'max' field according to a checkbox.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onChangeScales(event){
    this.form["consume.value.max"].disabled = !event.currentTarget.checked;
  }
}
