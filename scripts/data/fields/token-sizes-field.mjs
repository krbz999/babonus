import {FilterMixin} from "../filter-mixin.mjs";

const {SchemaField, NumberField, BooleanField} = foundry.data.fields;

// SchemaField that requires a value in all fields.
export class TokenSizesField extends FilterMixin(SchemaField) {
  static name = "tokenSizes";
  static template = "modules/babonus/templates/parts/select-number-checkbox.hbs";

  constructor(fields = {}, options = {}) {
    super({
      size: new NumberField({min: 0.5, step: 0.5}),
      type: new NumberField({choices: [0, 1], initial: 0}),
      self: new BooleanField(),
      ...fields
    }, options);
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    const value = this.value(bonus);
    data.size = value.size ?? null;
    data.type = value.type ?? null;
    data.self = value.self ?? null;
    data.options = {0: "BABONUS.SizeGreaterThan", 1: "BABONUS.SizeSmallerThan"};
    return data;
  }

  /** @override */
  static storage(bonus) {
    const {size, type, self} = this.value(bonus) ?? {};
    return Number.isNumeric(size) && Number.isNumeric(type);
  }
}
