import {KeyGetter} from "../../helpers/helpers.mjs";

// ArrayField that turns a semicolon string into an array of strings.
export class SemicolonArrayField extends foundry.data.fields.ArrayField {
  constructor(name, negate = false) {
    let element;
    if (name) element = new foundry.data.fields.StringField({choices: KeyGetter._getSchemaFilterOptions(name, negate)});
    else element = new foundry.data.fields.StringField({blank: false});
    super(element);
  }

  /**
   * @override
   * If the given value is a string, split it at each ';' and trim the results to get an array.
   */
  _cast(value) {
    if (typeof value === "string") value = value.split(";").map(v => v.trim());
    return super._cast(value);
  }

  /**
   * @override
   * If the given value contains invalid options, simply ignore them. This is done
   * since several filters that make use of this field can be customized through
   * world scripts or modules, such as 'weapon properties'.
   */
  _cleanType(value, source) {
    const choices = this.element.choices;
    value = value.reduce((acc, v) => {
      if (!v) return acc;
      if (!choices || choices.includes(v)) acc.push(v);
      return acc;
    }, []);
    value = super._cleanType(value, source);
    return [...new Set(value)];
  }

  /** @override */
  toObject(value) {
    return value.length ? value : null;
  }

  /**
   * Get the current data values of this filter.
   * @param {Babonus} bonus     The instance of the babonus on which this field lives.
   * @returns {string[]}        An array of strings.
   */
  static value(bonus) {
    return foundry.utils.getProperty(bonus, `filters.${this.name}`);
  }
}
