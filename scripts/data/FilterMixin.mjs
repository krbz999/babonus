import {module} from "./_module.mjs";

export function FilterMixin(Base) {
  return class BaseFilter extends Base {
    // The name of this filter.
    static name = null;
    // Whether this filter can be added more than once to a babonus.
    static repeatable = false;
    // What handlebars template to use when rendering this filter in the builder.
    static template = null;
    // Whether this filter has 'exclude' as an option in KeysDialog.
    static canExclude = false;

    /**
     * Is this filter available?
     * @param {Set<string>} filters     The set of current filters.
     * @param {Babonus} bonus           The current babonus.
     * @returns {boolean}
     */
    static isFilterAvailable(filters, bonus) {
      if (this.repeatable) return true;
      if (filters.has(this.name)) return false;
      return !!module.models[bonus.type].schema.getField(`filters.${this.name}`);
    }

    /**
     * A class getData method for rendering purposes.
     * @param {Babonus} bonus     The bonus, in case this is a filter being edited, not added.
     * @returns {object}          The template data.
     */
    static getData(bonus = null) {
      return {
        id: this.name,
        appId: randomID(),
        label: `BABONUS.Filters${this.name.capitalize()}Label`,
        tooltip: `BABONUS.Filters${this.name.capitalize()}Tooltip`
      };
    }

    /**
     * Get the current data values of this filter.
     * @param {Babonus} bonus     The instance of the babonus on which this field lives.
     */
    static value(bonus) {
      return foundry.utils.getProperty(bonus, `filters.${this.name}`);
    }

    /**
     * Render the filter.
     * @param {Babonus} bonus         The bonus, in case this is a filter being edited, not added.
     * @returns {Promise<string>}     The rendered template.
     */
    static async render(bonus = null) {
      return renderTemplate(this.template, this.getData(bonus));
    }

    /**
     * Determine whether this filter data should be saved on the document.
     * @param {Babonus} bonus     The babonus about to be saved.
     * @returns {boolean}         Whether to save the filter.
     */
    static storage(bonus) {
      return this.value(bonus).length > 0;
    }

    /**
     * Return an array objects with 'value' and 'label', related to what this field should show.
     * @returns {object[]}
     */
    static get choices() {
      throw new Error("This must be subclassed!");
    }

    /**
     * Helper method for creating an array of choices.
     * @returns {string[]}      An array of string options.
     */
    static get stringOptions() {
      if (this.canExclude) return this.choices.flatMap(({value}) => [value, `!${value}`]);
      else return this.choices.map(({value}) => value);
    }
  }
}
