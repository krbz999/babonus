import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, NumberField, BooleanField} = foundry.data.fields;

export default class RemainingSpellSlotsField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "remainingSpellSlots";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      min: new NumberField({
        min: 0,
        step: 1,
        integer: true
      }),
      max: new NumberField({
        min: 0,
        step: 1,
        integer: true
      }),
      size: new BooleanField({
        label: "BABONUS.Filters.RemainingSpellSlots.SizeLabel",
        hint: "BABONUS.Filters.RemainingSpellSlots.SizeHint"
      }),
      ...fields
    }, {
      label: "BABONUS.Filters.RemainingSpellSlots.Label",
      hint: "BABONUS.Filters.RemainingSpellSlots.Hint",
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
        <label>{{localize "BABONUS.Filters.RemainingSpellSlots.RangesLabel"}}</label>
        <div class="form-fields">
          {{formInput minField value=min placeholder=phmin}}
          &mdash;
          {{formInput maxField value=max placeholder=phmax}}
        </div>
      </div>
      {{formGroup sizeField value=size localize=true}}
    </fieldset>`;

    const schema = bonus.schema.getField(`filters.${this.name}`);
    const {min: minField, max: maxField, size: sizeField} = schema.fields;
    const {min, max, size} = bonus.filters[this.name];

    const data = {
      label: schema.label,
      hint: schema.hint,
      minField, min,
      maxField, max,
      sizeField, size,
      phmin: game.i18n.localize("Minimum"),
      phmax: game.i18n.localize("Maximum")
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    const {min, max} = bonus.filters[this.name];
    return Number.isNumeric(min) || Number.isNumeric(max);
  }
}
