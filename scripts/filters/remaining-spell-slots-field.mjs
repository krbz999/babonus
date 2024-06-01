import {FilterMixin} from "./filter-mixin.mjs";

const {SchemaField, NumberField} = foundry.data.fields;

export class RemainingSpellSlotsField extends FilterMixin(SchemaField) {
  static name = "remainingSpellSlots";
  static template = "modules/babonus/templates/parts/text-dash-text.hbs";

  constructor(fields = {}, options = {}) {
    super({
      min: new NumberField({min: 0, step: 1, integer: true}),
      max: new NumberField({min: 0, step: 1, integer: true}),
      ...fields
    }, options);
  }

  /** @override */
  _validateType(data, options = {}) {
    if (((data.min !== null) && (data.max !== null)) && (data.min > data.max)) {
      throw new foundry.data.validation.DataModelValidationError("min cannot be higher than max");
    }
    return super._validateType(data, options);
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData(bonus);
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
