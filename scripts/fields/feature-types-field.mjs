import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, StringField} = foundry.data.fields;

export default class FeatureTypesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "featureTypes";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      type: new StringField({
        required: false,
        label: "BABONUS.Filters.FeatureTypes.TypeLabel"
      }),
      subtype: new StringField({
        required: true,
        label: "BABONUS.Filters.FeatureTypes.SubtypeLabel"
      }),
      ...fields
    }, {
      label: "BABONUS.Filters.FeatureTypes.Label",
      hint: "BABONUS.Filters.FeatureTypes.Hint",
      ...options
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
    const schema = bonus.schema.getField("filters.featureTypes");
    const {type, subtype} = schema.fields;

    const value1 = bonus.filters.featureTypes.type;
    const value2 = bonus.filters.featureTypes.subtype;
    const choices1 = CONFIG.DND5E.featureTypes;
    const choices2 = CONFIG.DND5E.featureTypes[value1]?.subtypes ?? {};

    const template = `
    <fieldset>
      <legend>
        {{localize label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{localize hint}}</p>
      {{formGroup type value=value1 localize=true sort=true choices=choices1}}
      {{#if choices2}}
      {{formGroup subtype value=value2 localize=true sort=true choices=choices2}}
      {{/if}}
    </fieldset>`;

    const data = {
      type: type,
      subtype: subtype,
      value1: value1,
      value2: value2,
      choices1: choices1,
      choices2: foundry.utils.isEmpty(choices2) ? null : choices2,
      label: schema.label,
      hint: schema.hint
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    const value = this.value(bonus);
    return value.type in CONFIG.DND5E.featureTypes;
  }
}
