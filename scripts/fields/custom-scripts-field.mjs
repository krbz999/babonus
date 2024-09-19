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
        {{localize label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{localize hint}}</p>
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

  constructor() {
    super({
      label: "BABONUS.Filters.CustomScripts.Label",
      hint: "BABONUS.Filters.CustomScripts.Hint"
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
