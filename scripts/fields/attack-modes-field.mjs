import {MODULE} from "../constants.mjs";
import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, SetField, StringField} = foundry.data.fields;

/* -------------------------------------------------- */

export default class AttackModesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "attackModes";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      value: new SetField(new StringField({choices: CONFIG.DND5E.attackTypes})),
      classification: new SetField(new StringField({choices: CONFIG.DND5E.attackClassifications})),
      mode: new SetField(new StringField({choices: MODULE.ATTACK_MODES_CHOICES}))
    }, options);
  }

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
    const schema = bonus.schema.getField("filters.attackModes");
    const {value, mode, classification} = schema.fields;

    const context = {
      value: {
        field: value,
        value: bonus.filters.attackModes.value
      },
      mode: {
        field: mode,
        value: bonus.filters.attackModes.mode
      },
      classification: {
        field: classification,
        value: bonus.filters.attackModes.classification
      },
      legend: schema.label,
      hint: schema.hint
    };

    const template = `
    <fieldset>
      <legend>
        {{legend}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{hint}}</p>
      {{formGroup value.field value=value.value}}
      {{formGroup classification.field value=classification.value}}
      {{formGroup mode.field value=mode.value}}
    </fieldset>`;

    return Handlebars.compile(template)(context);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    const value = this.value(bonus);
    return Object.values(value).some(v => v.size);
  }
}
