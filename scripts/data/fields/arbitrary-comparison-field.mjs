import {FilterMixin} from "../filter-mixin.mjs";

const {SchemaField, StringField, ArrayField} = foundry.data.fields;

// ArrayField that filters invalid comparison fields.
export class ArbitraryComparisonField extends FilterMixin(ArrayField) {
  static name = "arbitraryComparison";
  static repeatable = true;
  static template = "modules/babonus/templates/parts/text-select-text.hbs";

  /** @override */
  constructor(options = {}) {
    super(new SchemaField({
      one: new StringField({blank: false}),
      other: new StringField({blank: false}),
      operator: new StringField({choices: ArbitraryComparisonField.selectOptions})
    }), options);
  }

  /** @override */
  static storage(bonus) {
    return this.value(bonus).filter(i => i).length > 0;
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
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
