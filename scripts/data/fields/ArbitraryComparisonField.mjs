import {FilterMixin} from "../FilterMixin.mjs";

// ArrayField that filters invalid comparison fields.
export class ArbitraryComparisonField extends FilterMixin(foundry.data.fields.ArrayField) {
  static name = "arbitraryComparison";
  static repeatable = true;
  static template = "modules/babonus/templates/builder_components/text_select_text.hbs";

  /** @override */
  constructor(options = {}) {
    super(new foundry.data.fields.SchemaField({
      one: new foundry.data.fields.StringField({blank: false}),
      other: new foundry.data.fields.StringField({blank: false}),
      operator: new foundry.data.fields.StringField({choices: ArbitraryComparisonField.selectOptions})
    }), options);
  }

  /**
   * @override
   * Filter out any elements in the array that do not contain all three values.
   */
  _cast(value) {
    value = super._cast(value);
    return value.filter(i => !!i?.one && !!i.operator && !!i.other);
  }

  /**
   * @override
   * A class getData method for rendering purposes.
   * @param {Babonus} bonus     The bonus, in case this is a filter being edited, not added.
   * @param {number} cnt        How many of this filter are currently rendered, when adding a new one.
   * @returns {object}          The template data.
   */
  static getData(bonus = null, cnt = 0) {
    const data = super.getData();
    data.options = this.selectOptions;
    data.placeholderOne = "BABONUS.FiltersArbitraryComparisonOne";
    data.placeholderOther = "BABONUS.FiltersArbitraryComparisonOther";

    if (!bonus) return [{one: null, other: null, operator: null, ...data, idx: cnt}];
    return this.value(bonus).map((v, idx) => ({...v, ...data, idx}));
  }

  /**
   * Get an object for a dropdown.
   * @returns {object}
   */
  static get selectOptions(){
    return {EQ: "=", LT: "<", GT: ">", LE: "<=", GE: ">="};
  }

  /** @override */
  static async render(bonus = null, cnt = 0) {
    return renderTemplate(this.template, this.getData(bonus, cnt));
  }
}
