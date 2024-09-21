import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, SetField, StringField} = foundry.data.fields;

export default class SourceClassesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "sourceClasses";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      values: new SetField(new StringField(), {
        slug: true
      }),
      ...fields
    }, {
      label: "BABONUS.Filters.SourceClasses.Label",
      hint: "BABONUS.Filters.SourceClasses.Hint",
      ...options
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
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
          {{formInput field value=value slug=true placeholder=placeholder}}
        </div>
      </div>
    </fieldset>`;

    const schema = bonus.schema.getField(`filters.${this.name}`);
    const field = bonus.schema.getField(`filters.${this.name}.values`);
    const value = bonus.filters.sourceClasses.values;

    const data = {
      label: schema.label,
      hint: schema.hint,
      field: field,
      value: value,
      placeholder: game.i18n.localize("BABONUS.Filters.SourceClasses.Placeholder")
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    return !!bonus.filters.sourceClasses?.values?.size;
  }
}
