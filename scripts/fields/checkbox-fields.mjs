import {MODULE} from "../constants.mjs";
import FilterMixin from "./filter-mixin.mjs";

const {SetField, NumberField, StringField, SchemaField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  /** @override */
  static render(bonus) {
    const field = bonus.schema.getField(`filters.${this.name}`);
    const value = bonus.filters[this.name] ?? new Set();
    const template = `
    <fieldset>
      <legend>
        {{label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{hint}}</p>
      {{formInput field value=value}}
    </fieldset>`;
    return Handlebars.compile(template)({
      field: field, value: value, hint: field.hint, label: field.label
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  _cleanType(value, source) {
    const choices = (this.element.choices instanceof Function) ? this.element.choices() : this.element.choices;
    value = super._cleanType(value, source).filter(v => v in choices);
    return value;
  }
}

/* -------------------------------------------------- */

class ProficiencyLevelsField extends BaseField {
  /** @override */
  static name = "proficiencyLevels";

  /* -------------------------------------------------- */

  constructor() {
    super(new NumberField({choices: CONFIG.DND5E.proficiencyLevels}));
  }
}

/* -------------------------------------------------- */

class ItemTypesField extends BaseField {
  /** @override */
  static name = "itemTypes";

  /* -------------------------------------------------- */

  constructor() {
    super(new StringField({
      choices: Object.keys(dnd5e.dataModels.item.config).reduce((acc, type) => {
        if (!dnd5e.dataModels.item.config[type].schema.getField("activities")) return acc;
        acc[type] = game.i18n.localize(`TYPES.Item.${type}`);
        return acc;
      }, {})
    }));
  }
}

/* -------------------------------------------------- */

class SpellLevelsField extends BaseField {
  /** @override */
  static name = "spellLevels";

  /* -------------------------------------------------- */

  constructor() {
    super(new NumberField({choices: CONFIG.DND5E.spellLevels}));
  }
}

/* -------------------------------------------------- */

class SpellComponentsField extends FilterMixin(SchemaField) {
  /** @override */
  static name = "spellComponents";

  /* -------------------------------------------------- */

  constructor(fields = {}, options = {}) {
    super({
      types: new BaseField(new StringField({
        choices: () => CONFIG.DND5E.validProperties.spell.reduce((acc, p) => {
          const prop = CONFIG.DND5E.itemProperties[p];
          if (prop) acc[p] = prop;
          return acc;
        }, {})
      })),
      match: new StringField({
        required: true,
        initial: "ANY",
        choices: MODULE.SPELL_COMPONENT_CHOICES
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
        {{types.parent.label}}
        <a data-action="deleteFilter" data-id="${this.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{types.parent.hint}}</p>
      <div class="form-group">
        <label>{{types.label}}</label>
        <div class="form-fields">
          {{formInput types value=typesValue}}
        </div>
      </div>
      <div class="form-group">
        <label>{{match.label}}</label>
        <div class="form-fields">
          {{formInput match value=matchValue sort=true}}
        </div>
      </div>
    </fieldset>`;

    return Handlebars.compile(template)({
      types: bonus.schema.getField("filters.spellComponents.types"),
      match: bonus.schema.getField("filters.spellComponents.match"),
      typesValue: bonus.filters.spellComponents.types,
      matchValue: bonus.filters.spellComponents.match
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus).types?.filter(u => u).size;
  }
}

/* -------------------------------------------------- */

class ActorCreatureSizesField extends BaseField {
  /** @override */
  static name = "actorCreatureSizes";

  /* -------------------------------------------------- */

  constructor() {
    super(new StringField({choices: CONFIG.DND5E.actorSizes}));
  }
}

/* -------------------------------------------------- */

class PreparationModesField extends BaseField {
  /** @override */
  static name = "preparationModes";

  /* -------------------------------------------------- */

  constructor() {
    super(new StringField({choices: CONFIG.DND5E.spellPreparationModes}));
  }
}

/* -------------------------------------------------- */

export default {
  ActorCreatureSizesField,
  ItemTypesField,
  PreparationModesField,
  ProficiencyLevelsField,
  SpellComponentsField,
  SpellLevelsField
};
