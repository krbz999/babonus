/**
 * A mixin function for base filter behaviour.
 * @param {Class} Base      The base class.
 * @returns {Class}
 * @mixin
 */
export default function FilterMixin(Base) {
  return class BaseFilter extends Base {
    /**
     * The name of the filter.
     * @type {string}
     */
    static name = null;

    /* -------------------------------------------------- */

    /**
     * Whether this filter can be added more than once to a babonus.
     * @type {boolean}
     */
    static repeatable = false;

    /* -------------------------------------------------- */

    /**
     * What handlebars template to use when rendering this filter in the builder.
     * @type {string}
     */
    static template = null;

    /* -------------------------------------------------- */

    /**
     * Whether this filter has 'exclude' as an option in KeysDialog.
     * @type {boolean}
     */
    static canExclude = false;

    /* -------------------------------------------------- */

    /**
     * Should this filter display the trash button?
     * @type {boolean}
     */
    static trash = true;

    /* -------------------------------------------------- */

    /**
     * Get the current data values of this filter.
     * @param {Babonus} bonus     The instance of the babonus on which this field lives.
     */
    static value(bonus) {
      return foundry.utils.getProperty(bonus, `filters.${this.name}`);
    }

    /* -------------------------------------------------- */

    /**
     * Render the filter.
     * @param {Babonus} bonus     The bonus being rendered.
     * @returns {string}          The rendered template.
     */
    static render(bonus) {
      throw new Error("This must be subclassed!");
    }

    /* -------------------------------------------------- */

    /**
     * Determine whether this filter data should be saved on the document.
     * @param {Babonus} bonus     The bonus being embedded.
     * @returns {boolean}         Whether to save the filter.
     */
    static storage(bonus) {
      return this.value(bonus).size > 0;
    }

    /* -------------------------------------------------- */

    /** @override */
    toFormGroup(formConfig, inputConfig) {
      const element = super.toFormGroup(formConfig, inputConfig);

      if (this.constructor.trash) {
        const trash = document.createElement("A");
        trash.dataset.action = "deleteFilter";
        trash.dataset.id = this.constructor.name;
        trash.innerHTML = "<i class='fa-solid fa-trash'></i>";
        element.querySelector(".form-fields").after(trash);
      }

      return element;
    }
  };
}
