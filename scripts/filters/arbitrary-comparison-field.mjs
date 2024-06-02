import {FilterMixin} from "./filter-mixin.mjs";

const {SchemaField, StringField, ArrayField} = foundry.data.fields;

// ArrayField that filters invalid comparison fields.
export class ArbitraryComparisonField extends FilterMixin(ArrayField) {
  static name = "arbitraryComparisons";
  static repeatable = true;

  /** @override */
  constructor(options = {}) {
    super(new SchemaField({
      one: new StringField({
        blank: false
      }),
      other: new StringField({
        blank: false
      }),
      operator: new StringField({
        required: true,
        initial: "EQ",
        choices: {
          EQ: "=",
          LT: "<",
          GT: ">",
          LE: "<=",
          GE: ">="
        }
      })
    }), {
      label: "BABONUS.Filters.ArbitraryComparisons.Label",
      hint: "BABONUS.Filters.ArbitraryComparisons.Hint",
      ...options
    });
  }

  /** @override */
  static render(bonus) {
    const template = `
    <fieldset>
      <legend>{{localize label}}</legend>
      <p class="hint">{{localize hint}}</p>
      {{#each comparisons as |c idx|}}
      <div class="form-group">
        <div class="form-fields">
          {{formInput c.one.field value=c.one.value placeholder=../placeholder1 name=c.one.name}}
          {{formInput c.operator.field value=c.operator.value name=c.operator.name}}
          {{formInput c.other.field value=c.other.value placeholder=../placeholder2 name=c.other.name}}
        </div>
        <a data-action="deleteFilter" data-id="${this.name}" data-idx="{{idx}}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </div>
      {{/each}}
    </fieldset>`;

    const field = bonus.schema.getField("filters.arbitraryComparisons");
    const {one, other, operator} = field.element.fields;
    const data = {
      label: field.label,
      hint: field.hint,
      placeholder1: game.i18n.localize("BABONUS.Filters.ArbitraryComparisons.One"),
      placeholder2: game.i18n.localize("BABONUS.Filters.ArbitraryComparisons.Other"),
      comparisons: bonus.filters.arbitraryComparisons.map((c, i) => {
        return {
          one: {field: one, value: c.one, name: `filters.${this.name}.${i}.one`},
          other: {field: other, value: c.other, name: `filters.${this.name}.${i}.other`},
          operator: {field: operator, value: c.operator, name: `filters.${this.name}.${i}.operator`}
        };
      })
    };

    return data.comparisons.length ? Handlebars.compile(template)(data) : "";
  }

  /** @override */
  static storage(bonus) {
    return this.value(bonus).filter(i => i).length > 0;
  }
}
