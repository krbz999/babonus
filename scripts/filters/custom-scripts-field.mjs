import {FilterMixin} from "./filter-mixin.mjs";

const {JavaScriptField, StringField} = foundry.data.fields;

export class CustomScriptsField extends FilterMixin(JavaScriptField) {
  static name = "customScripts";
  static template = "modules/babonus/templates/parts/textarea.hbs";

  static render(bonus) {
    const field = bonus.schema.getField(`filters.${this.name}`);
    const value = bonus.filters[this.name] ?? "";

    const template = `
    <fieldset>
      <legend>
        {{localize label}}
        <a data-action="delete-filter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <div class="form-group">
        <div class="form-fields">
          {{formInput field value=value height=300}}
        </div>
        <p class="hint">{{localize hint}}</p>
      </div>
    </fieldset>`;

    return Handlebars.compile(template)({
      field: field,
      value: value,
      label: field.label,
      hint: field.hint
    });
  }

  constructor() {
    super({
      label: "BABONUS.Filters.CustomScripts.Label",
      hint: "BABONUS.Filters.CustomScripts.Hint"
    });
  }

  /** @override */
  _validateType(value, options) {
    return StringField.prototype._validateType.call(this, value, options);
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData(bonus);
    data.value = this.value(bonus);
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus)?.length;
  }
}
