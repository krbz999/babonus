import {MODULE} from "../constants.mjs";
import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, NumberField} = foundry.data.fields;

export default class HealthPercentagesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "healthPercentages";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      value: new NumberField({
        min: 0,
        max: 100,
        step: 1,
        integer: true,
        nullable: true, // nullable required to be able to remove it
        initial: 50
      }),
      type: new NumberField({
        initial: null,
        nullable: true, // nullable required to be able to remove it
        choices: MODULE.HEALTH_PERCENTAGES_CHOICES
      }),
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
      {{formGroup valueField value=value}}
      {{formGroup typeField value=type}}
    </fieldset>`;

    const schema = bonus.schema.getField(`filters.${this.name}`);
    const valueField = bonus.schema.getField(`filters.${this.name}.value`);
    const typeField = bonus.schema.getField(`filters.${this.name}.type`);
    const data = {
      valueField: valueField,
      typeField: typeField,
      value: bonus.filters[this.name].value,
      type: bonus.filters[this.name].type,
      hint: schema.hint,
      label: schema.label
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    return !Object.values(this.value(bonus)).includes(null);
  }
}
