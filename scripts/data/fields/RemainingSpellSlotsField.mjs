import {FilterMixin} from "../FilterMixin.mjs";

export class RemainingSpellSlotsField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "remainingSpellSlots";
  static template = "modules/babonus/templates/parts/text-dash-text.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      min: new foundry.data.fields.NumberField({min: 0, step: 1, integer: true}),
      max: new foundry.data.fields.NumberField({min: 0, step: 1, integer: true})
    });
  }

  /** @override */
  _validateType(data, options = {}) {
    if ((data.min !== null && data.max !== null) && (data.min > data.max)) {
      throw new foundry.data.validation.DataModelValidationError("min cannot be higher than max");
    }
    return super._validateType(data, options);
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    const value = bonus ? this.value(bonus) : {};
    data.min = value.min ?? null;
    data.max = value.max ?? null;
    return data;
  }

  /** @override */
  static storage(bonus) {
    return Object.values(this.value(bonus)).some(v => Number.isNumeric(v));
  }
}
