import {BabonusTypes} from "../applications/dataModel.mjs";

export function FilterMixin(Base) {
  return class BaseFilter extends Base {
    static name = null;
    static repeatable = false;
    static template = null;
    static canExclude = false;

    /**
     * Is this filter available.
     */
    static isFilterAvailable(filters, bonus) {
      if (this.repeatable) return true;
      if (filters.has(this.name)) return false;
      return !!BabonusTypes[bonus.type].schema.getField(`filters.${this.name}`);
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
    static storage(bonus){
      throw new Error("Storage must be subclassed!");
    }
  }
}