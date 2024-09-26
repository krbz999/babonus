import FilterMixin from "./filter-mixin.mjs";

const {JavaScriptField, StringField} = foundry.data.fields;

export default class CustomScriptsField extends FilterMixin(JavaScriptField) {
  /** @override */
  static name = "customScripts";

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
    const field = bonus.schema.getField(`filters.${this.name}`);
    const value = bonus.filters[this.name] ?? "";

    const template = `
    <fieldset>
      <legend>
        {{label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{hint}}</p>
      <div class="form-group">
        <div class="form-fields">
          {{formInput field value=value}}
        </div>
      </div>
    </fieldset>`;

    return Handlebars.compile(template)({
      field: field,
      value: value,
      label: field.label,
      hint: field.hint
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  _validateType(value, options) {
    return StringField.prototype._validateType.call(this, value, options);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus)?.length;
  }
}
