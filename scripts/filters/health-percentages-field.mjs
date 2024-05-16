import {FilterMixin} from "./filter-mixin.mjs";

const {SchemaField, NumberField} = foundry.data.fields;

export class HealthPercentagesField extends FilterMixin(SchemaField) {
  static name = "healthPercentages";
  static template = "modules/babonus/templates/parts/range-select.hbs";

  constructor(fields = {}, options = {}) {
    super({
      value: new NumberField({min: 0, max: 100, step: 1, integer: true}),
      type: new NumberField({nullable: true, choices: [0, 1]}),
      ...fields
    }, options);
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
