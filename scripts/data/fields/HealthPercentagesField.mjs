import {FilterMixin} from "../FilterMixin.mjs";

export class HealthPercentagesField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "healthPercentages";
  static template = "modules/babonus/templates/parts/range-select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      value: new foundry.data.fields.NumberField({min: 0, max: 100, step: 1, integer: true}),
      type: new foundry.data.fields.NumberField({nullable: true, choices: [0, 1]})
    });
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    const {value, type} = this.value(bonus);
    data.options = {0: "BABONUS.OrLess", 1: "BABONUS.OrMore"};
    data.selected = type ?? null;
    data.value = value ?? 50;
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !Object.values(this.value(bonus)).includes(null);
  }
}
