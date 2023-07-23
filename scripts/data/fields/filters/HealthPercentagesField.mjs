import {FilterMixin} from "../../FilterMixin.mjs";

export class HealthPercentagesField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "healthPercentages";
  static template = "modules/babonus/templates/builder_components/range_select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      value: new foundry.data.fields.NumberField({min: 0, max: 100, step: 1, integer: true}),
      type: new foundry.data.fields.NumberField({nullable: true, choices: [0, 1]})
    });
  }

  /** @override */
  toObject(value) {
    const badData = (value.value === null) || (value.type === null);
    return badData ? null : value;
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const {value, type} = bonus ? this.value(bonus) : {};
    data.options = {0: "BABONUS.OrLess", 1: "BABONUS.OrMore"};
    data.selected = type ?? null;
    data.value = value ?? 50;
    return data;
  }
}
