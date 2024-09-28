import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, SetField, StringField} = foundry.data.fields;

export default class MarkersField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "markers";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      values: new SetField(new StringField(), {slug: true}),
      target: new SetField(new StringField(), {slug: true}),
      ...fields
    }, options);
  }

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
    const template = `
    <fieldset>
      <legend>
        {{label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{hint}}</p>
      {{formGroup values.field value=values.value slug=true placeholder=placeholder}}
      {{formGroup target.field value=target.value slug=true placeholder=placeholder}}
    </fieldset>`;

    const schema = bonus.schema.getField(`filters.${this.name}`);
    const field = bonus.schema.getField(`filters.${this.name}.values`);
    const target = bonus.schema.getField(`filters.${this.name}.target`);

    const data = {
      label: schema.label,
      hint: schema.hint,
      values: {field: field, value: bonus.filters[this.name].values},
      target: {field: target, value: bonus.filters[this.name].target},
      placeholder: game.i18n.localize(`BABONUS.FIELDS.filters.${this.name}.placeholder`)
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    const {values, target} = bonus.filters[this.name] ?? {};
    return !!values?.size || !!target?.size;
  }
}
