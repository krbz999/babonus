import {FilterMixin} from "../FilterMixin.mjs";

// ArrayField that filters invalid comparison fields.
export class ArbitraryComparisonField extends FilterMixin(foundry.data.fields.ArrayField) {
  static name = "arbitraryComparison";
  static repeatable = true;
  static template = "modules/babonus/templates/parts/text-select-text.hbs";

  /** @override */
  constructor(options = {}) {
    super(new foundry.data.fields.SchemaField({
      one: new foundry.data.fields.StringField({blank: false}),
      other: new foundry.data.fields.StringField({blank: false}),
      operator: new foundry.data.fields.StringField({choices: ArbitraryComparisonField.selectOptions})
    }), options);
  }

  /** @override */
  static storage(bonus) {
    return this.value(bonus).filter(i => i);
  }

  /** @override */
  static getData(bonus) {
    const data = super.getData();
    data.options = this.selectOptions;
    data.placeholderOne = "BABONUS.FiltersArbitraryComparisonOne";
    data.placeholderOther = "BABONUS.FiltersArbitraryComparisonOther";

    return this.value(bonus).map((v, idx) => ({...v, ...data, idx}));
  }

  /**
   * Get an object for a dropdown.
   * @returns {object}
   */
  static get selectOptions() {
    return {EQ: "=", LT: "<", GT: ">", LE: "<=", GE: ">="};
  }
}
