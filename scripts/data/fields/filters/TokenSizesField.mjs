import {FilterMixin} from "../../FilterMixin.mjs";

// SchemaField that requires a value in all fields.
export class TokenSizesField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "tokenSizes";
  static template = "modules/babonus/templates/builder_components/select_number_checkbox.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      size: new foundry.data.fields.NumberField({min: 0.5, step: 0.5}),
      type: new foundry.data.fields.NumberField({nullable: true, choices: [0, 1]}),
      self: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
    });
  }

  /** @override */
  _validateType(data, options = {}) {
    if ((data.self !== null) || (data.size !== null) || (data.type !== null)) {
      const self = [true, false].includes(data.self);
      const size = Number.isNumeric(data.size) && (data.size > 0);
      const type = [0, 1].includes(data.type);
      if (!self) throw new foundry.data.validation.DataModelValidationError("self must be a boolean");
      if (!size) throw new foundry.data.validation.DataModelValidationError("size must be a number greater than 0");
      if (!type) throw new foundry.data.validation.DataModelValidationError("type must be 0 or 1");
    }
    return super._validateType(data, options);
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = bonus ? this.value(bonus) : {};
    data.size = value.size ?? null;
    data.type = value.type ?? null;
    data.self = value.self ?? null;
    data.options = {0: "BABONUS.SizeGreaterThan", 1: "BABONUS.SizeSmallerThan"};
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !Object.values(this.value(bonus)).includes(null);
  }
}
