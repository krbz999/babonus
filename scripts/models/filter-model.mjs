export default class FilterModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      active: new foundry.data.fields.BooleanField()
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static migrateData(source) {
    console.warn(this.name, "|", source);
  }

  /* -------------------------------------------------- */

  /**
   * Is this repeatable?
   * @type {boolean}
   */
  get isRepeatable() {
    const fields = [...this.schema].filter(field => field.name !== "active");
    return (fields.length === 1) && (fields[0] instanceof foundry.data.fields.ArrayField);
  }

  /* -------------------------------------------------- */

  /**
   * Render this data model.
   * @returns {HTMLElement}     The created html fieldset element.
   */
  render() {
    const schema = this.schema;
    const elements = [];

    if (this.isRepeatable) {
      const values = foundry.utils.getProperty(this.parent, this.fieldPath);
      const fields = schema.element.fields;

      for (const [i, value] of values.entries()) {
        const formGroup = document.createElement("DIV");
        formGroup.classList.add("form-group");
        const formFields = document.createElement("DIV");
        formFields.classList.add("form-fields");
        formGroup.insertAdjacentElement("beforeend", formFields);
        for (const field of fields) {
          const name = `${this.fieldPath}.${i}.${field.name}`;
          const input = field.toInput({}, {value: value, name: name});
          formFields.insertAdjacentElement("beforeend", input);
        }
        formGroup.dataset.idx = String(i);
        formGroup.insertAdjacentHTML("beforeend", `
          <a data-action="deleteFilter" data-id="${this.name}" data-idx="${i}">
            <i class="fa-solid fa-trash"></i>
          </a>`
        );
        elements.push(formGroup);
      }
    } else {
      for (const field of schema) {
        const value = foundry.utils.getProperty(this.parent, field.fieldPath);
        const formGroup = field.toFormGroup({}, {value: value});
        elements.push(formGroup);
      }
    }

    const fieldset = document.createElement("FIELDSET");

    const legend = document.createElement("LEGEND");
    legend.textContent = schema.label;
    elements.unshift(legend);

    if (!this.isRepeatable) {
      legend.insertAdjacentHTML("beforeend", `
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>`
      );
    }

    const hint = document.createElement("P");
    hint.classList.add("hint");
    hint.textContent = schema.hint;
    elements.unshift(hint);

    for (const element of elements) fieldset.insertAdjacentElement("beforeend", element);

    return fieldset;
  }

  /* -------------------------------------------------- */

  /**
   * Evaluate this filter, returning whether it should block a bonus from being applied.
   * @param {import("../applications/filterings.mjs").SubjectConfig} subjects     Subject config.
   * @param {import("../applications/filterings.mjs").DetailsConfig} details      Details config.
   * @returns {boolean|void}      Explicitly return `false` to block a bonus from being applied.
   */
  filter(subjects, details) {
    if (!this.active) return;
  }
}
