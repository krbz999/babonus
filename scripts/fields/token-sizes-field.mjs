import {MODULE} from "../constants.mjs";
import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, NumberField, BooleanField} = foundry.data.fields;

export default class TokenSizesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "tokenSizes";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      size: new NumberField({min: 0.5, step: 0.5}),
      type: new NumberField({
        choices: MODULE.TOKEN_SIZES_CHOICES,
        initial: 0
      }),
      self: new BooleanField(),
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
      <div class="form-group">
        <label>{{sizeField.label}}</label>
        <div class="form-fields">
          {{formInput typeField value=type}}
          {{formInput sizeField value=size placeholder=phSize}}
        </div>
      </div>
      {{formGroup selfField value=self}}
    </fieldset>`;

    const schema = bonus.schema.getField(`filters.${this.name}`);
    const {type: typeField, size: sizeField, self: selfField} = schema.fields;
    const {type, size, self} = bonus.filters[this.name];

    const data = {
      label: schema.label,
      hint: schema.hint,
      typeField, type,
      sizeField, size,
      selfField, self,
      phSize: game.i18n.localize("BABONUS.FIELDS.filters.tokenSizes.size.placeholder")
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    const {size, type, self} = this.value(bonus) ?? {};
    return Number.isNumeric(size) && Number.isNumeric(type);
  }
}
