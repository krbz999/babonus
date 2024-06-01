import {FilterMixin} from "./filter-mixin.mjs";

const {SchemaField, StringField} = foundry.data.fields;

export class FeatureTypesField extends FilterMixin(SchemaField) {
  static name = "featureTypes";
  static template = "modules/babonus/templates/parts/double-select.hbs";

  constructor(fields = {}, options = {}) {
    super({
      type: new StringField({
        required: false,
        label: "BABONUS.Filters.FeatureTypes.TypeLabel",
        choices: () => CONFIG.DND5E.featureTypes
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

  /** @override */
  static render(bonus) {
    const schema = bonus.schema.getField("filters.featureTypes");
    const {type, subtype} = schema.fields;

    const value1 = bonus.filters.featureTypes.type;
    const value2 = bonus.filters.featureTypes.subtype;
    const choices = CONFIG.DND5E.featureTypes[value1]?.subtypes ?? {};

    const template = `
    <fieldset>
      <legend>
        {{localize label}}
        <a data-action="delete-filter" data-id="featureTypes">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      {{formGroup type value=value1 localize=true sort=true}}
      {{#if choices}}
      {{formGroup subtype value=value2 localize=true sort=true choices=choices}}
      {{/if}}
      <p class="hint">{{localize hint}}</p>
    </fieldset>`;

    const data = {
      type: type,
      subtype: subtype,
      value1: value1,
      value2: value2,
      choices: foundry.utils.isEmpty(choices) ? null : choices,
      label: schema.label,
      hint: schema.hint
    };

    return Handlebars.compile(template)(data);
  }

  /** @override */
  static storage(bonus) {
    const value = this.value(bonus);
    return value.type in CONFIG.DND5E.featureTypes;
  }
}
