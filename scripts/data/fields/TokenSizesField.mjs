import {FilterMixin} from "../FilterMixin.mjs";

// SchemaField that requires a value in all fields.
export class TokenSizesField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "tokenSizes";
  static template = "modules/babonus/templates/parts/select-number-checkbox.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      size: new foundry.data.fields.NumberField({min: 0.5, step: 0.5}),
      type: new foundry.data.fields.NumberField({choices: [0, 1], initial: 0}),
      self: new foundry.data.fields.BooleanField()
    });
  }

  /** @override */
  static getData(bonus) {
    const data = super.getData();
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
