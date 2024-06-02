import {FilterMixin} from "./filter-mixin.mjs";

const {SetField, NumberField, StringField, SchemaField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  static template = "modules/babonus/templates/parts/checkboxes.hbs";

  static render(bonus) {
    const field = bonus.schema.getField(`filters.${this.name}`);
    const value = bonus.filters[this.name] ?? new Set();
    return Handlebars.compile("{{formGroup field value=value localize=true}}")({
      field: field, value: value
    });
  }
}

class ProficiencyLevelsField extends BaseField {
  static name = "proficiencyLevels";

  constructor() {
    super(new NumberField({
      choices: CONFIG.DND5E.proficiencyLevels
    }), {
      label: "BABONUS.Filters.ProficiencyLevels.Label",
      hint: "BABONUS.Filters.ProficiencyLevels.Hint"
    });
  }
}

class ItemTypesField extends BaseField {
  static name = "itemTypes";

  constructor() {
    super(new StringField({
      choices: Object.keys(dnd5e.dataModels.item.config).reduce((acc, type) => {
        if (!dnd5e.dataModels.item.config[type].schema.getField("damage.parts")) return acc;
        acc[type] = `TYPES.Item.${type}`;
        return acc;
      }, {})
    }), {
      label: "BABONUS.Filters.ItemTypes.Label",
      hint: "BABONUS.Filters.ItemTypes.Hint"
    });
  }
}

class AttackTypesField extends BaseField {
  static name = "attackTypes";

  constructor() {
    super(new StringField({
      choices: ["mwak", "rwak", "msak", "rsak"].reduce((acc, ak) => {
        acc[ak] = CONFIG.DND5E.itemActionTypes[ak];
        return acc;
      }, {})
    }), {
      label: "BABONUS.Filters.AttackTypes.Label",
      hint: "BABONUS.Filters.AttackTypes.Hint"
    });
  }
}

class SpellLevelsField extends BaseField {
  static name = "spellLevels";

  constructor() {
    super(new NumberField({
      choices: CONFIG.DND5E.spellLevels
    }), {
      label: "BABONUS.Filters.SpellLevels.Label",
      hint: "BABONUS.Filters.SpellLevels.Hint"
    });
  }
}

class SpellComponentsField extends FilterMixin(SchemaField) {
  static name = "spellComponents";
  static template = "modules/babonus/templates/parts/checkboxes-select.hbs";

  constructor(fields = {}, options = {}) {
    super({
      types: new BaseField(new StringField({
        choices: () => CONFIG.DND5E.validProperties.spell.reduce((acc, p) => {
          const prop = CONFIG.DND5E.itemProperties[p];
          if (prop) acc[p] = prop;
          return acc;
        }, {})
      }), {
        label: "BABONUS.Filters.SpellComponents.TypesLabel",
        hint: "BABONUS.Filters.SpellComponents.TypesHint"
      }),
      match: new StringField({
        required: true,
        initial: "ANY",
        choices: {
          ANY: "BABONUS.Filters.SpellComponents.MatchAny",
          ALL: "BABONUS.Filters.SpellComponents.MatchAll"
        },
        label: "BABONUS.Filters.SpellComponents.MatchLabel",
        hint: "BABONUS.Filters.SpellComponents.MatchHint"
      }),
      ...fields
    }, {
      label: "BABONUS.Filters.SpellComponents.Label",
      hint: "BABONUS.Filters.SpellComponents.Hint",
      ...options
    });
  }

  static render(bonus) {
    const template = `
    <fieldset>
      <legend>
        {{localize types.parent.label}}
        <a data-action="delete-filter" data-id="spellComponents">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>
      <p class="hint">{{localize types.parent.hint}}</p>
      <div class="form-group">
        <label>{{localize types.label}}</label>
        <div class="form-fields">
          {{formInput types value=typesValue localize=true}}
        </div>
      </div>
      <div class="form-group">
        <label>{{localize match.label}}</label>
        <div class="form-fields">
          {{formInput match value=matchValue localize=true sort=true}}
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

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus).types?.filter(u => u).size;
  }
}

class ActorCreatureSizesField extends BaseField {
  /** @override */
  static name = "actorCreatureSizes";

  constructor() {
    super(new StringField({
      choices: CONFIG.DND5E.actorSizes
    }), {
      label: "BABONUS.Filters.ActorCreatureSizes.Label",
      hint: "BABONUS.Filters.ActorCreatureSizes.Hint"
    });
  }
}

class PreparationModesField extends BaseField {
  static name = "preparationModes";

  constructor() {
    super(new StringField({
      choices: CONFIG.DND5E.spellPreparationModes
    }), {
      label: "BABONUS.Filters.PreparationModes.Label",
      hint: "BABONUS.Filters.PreparationModes.Hint"
    });
  }
}

export default {
  ProficiencyLevelsField,
  ItemTypesField,
  AttackTypesField,
  SpellLevelsField,
  SpellComponentsField,
  ActorCreatureSizesField,
  PreparationModesField
};
