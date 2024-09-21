import FilterMixin from "./filter-mixin.mjs";

const {SchemaField, SetField, StringField} = foundry.data.fields;

/**
 * The different attack modes. This doesn't exist in a config object.
 * @enum {string}
 */
const attackModes = {
  offhand: "DND5E.ATTACK.Mode.Offhand",
  oneHanded: "DND5E.ATTACK.Mode.OneHanded",
  thrown: "DND5E.ATTACK.Mode.Thrown",
  "thrown-offhand": "DND5E.ATTACK.Mode.ThrownOffhand",
  twoHanded: "DND5E.ATTACK.Mode.TwoHanded"
};

/* -------------------------------------------------- */

export default class AttackModesField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "attackModes";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      value: new SetField(new StringField({
        choices: CONFIG.DND5E.attackTypes
      }), {
        label: "BABONUS.Filters.AttackModes.ValueLabel"
      }),
      classification: new SetField(new StringField({
        choices: CONFIG.DND5E.attackClassifications
      }), {
        label: "BABONUS.Filters.AttackModes.ClassificationLabel"
      }),
      mode: new SetField(new StringField({
        choices: attackModes
      }), {
        label: "BABONUS.Filters.AttackModes.ModeLabel"
      })
    }, {
      label: "BABONUS.Filters.AttackModes.Label",
      hint: "BABONUS.Filters.AttackModes.Hint"
    });
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
        {{localize legend}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{localize hint}}</p>
      {{formGroup value.field value=value.value localize=true}}
      {{formGroup classification.field value=classification.value localize=true}}
      {{formGroup mode.field value=mode.value localize=true}}
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
