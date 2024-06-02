/**
 * A mixin function for base filter behaviour.
 * @param {Class} Base      The base class.
 * @returns {Class}
 * @mixin
 */
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
     * Should this filter display the trash button?
     * @type {boolean}
     */
    static trash = true;

    /**
     * Get the current data values of this filter.
     * @param {Babonus} bonus     The instance of the babonus on which this field lives.
     */
    static value(bonus) {
      return foundry.utils.getProperty(bonus, `filters.${this.name}`);
    }

    /**
     * Render the filter.
     * @param {Babonus} bonus     The bonus being rendered.
     * @returns {string}          The rendered template.
     */
    static render(bonus) {
      throw new Error("This must be subclassed!");
    }

    /**
     * Determine whether this filter data should be saved on the document.
     * @param {Babonus} bonus     The bonus being embedded.
     * @returns {boolean}         Whether to save the filter.
     */
    static storage(bonus) {
      return this.value(bonus).size > 0;
    }

    /**
     * Return an array objects with 'value' and 'label', related to what this field should show.
     * @returns {Promise<object[]>}
     */
    static async choices() {
      throw new Error("This must be subclassed!");
    }

    /** @override */
    toFormGroup(formConfig, inputConfig) {
      const element = super.toFormGroup(formConfig, inputConfig);

      if (this.constructor.trash) {
        const trash = document.createElement("A");
        trash.dataset.action = "delete-filter";
        trash.dataset.id = this.constructor.name;
        trash.innerHTML = "<i class='fa-solid fa-trash'></i>";
        element.querySelector(".form-fields").after(trash);
      }

      return element;
    }
  };
}
