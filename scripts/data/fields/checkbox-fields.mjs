import {FilterMixin} from "../filter-mixin.mjs";

const {SetField, NumberField, StringField, SchemaField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  static template = "modules/babonus/templates/parts/checkboxes.hbs";

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    const value = bonus ? this.value(bonus) : [];
    const choices = await this.choices();
    data.value = choices.map(c => {
      return {
        checked: value.has(c.value),
        value: c.value,
        label: c.value,
        tooltip: c.label
      };
    });
    return data;
  }

  /** @override */
  _cast(value) {
    return super._cast(value.filter(i => {
      return (i !== null) && (i !== undefined) && (i !== "");
    }));
  }
}

class ProficiencyLevelsField extends BaseField {
  static name = "proficiencyLevels";

  constructor() {
    super(new NumberField());
  }

  /** @override */
  static async choices() {
    const levels = Object.entries(CONFIG.DND5E.proficiencyLevels);
    return levels.map(([value, label]) => {
      return {value: Number(value), label: label};
    }).sort((a, b) => a.value - b.value);
  }
}

class ItemTypesField extends BaseField {
  static name = "itemTypes";

  constructor() {
    super(new StringField());
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData(bonus);
    data.value.forEach(v => v.label = v.label.slice(0, 4));
    return data;
  }

  /** @override */
  static async choices() {
    return Object.keys(dnd5e.dataModels.item.config).reduce((acc, type) => {
      if (!dnd5e.dataModels.item.config[type].schema.getField("damage.parts")) return acc;
      acc.push({value: type, label: `TYPES.Item.${type}`});
      return acc;
    }, []);
  }
}

class AttackTypesField extends BaseField {
  static name = "attackTypes";

  constructor() {
    super(new StringField());
  }

  /** @override */
  static async choices() {
    return ["mwak", "rwak", "msak", "rsak"].map(ak => ({value: ak, label: CONFIG.DND5E.itemActionTypes[ak]}));
  }
}

class SpellLevelsField extends BaseField {
  static name = "spellLevels";

  constructor() {
    super(new NumberField());
  }

  /** @override */
  static async choices() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({value: Number(value), label}));
  }
}

class SpellComponentsField extends FilterMixin(SchemaField) {
  static name = "spellComponents";
  static template = "modules/babonus/templates/parts/checkboxes-select.hbs";

  constructor(fields = {}, options = {}) {
    super({
      types: new BaseField(new StringField()),
      match: new StringField({nullable: true, initial: null, choices: ["ANY", "ALL"]}),
      ...fields
    }, options);
  }

  /** @override */
  static async getData(bonus) {
    const value = this.value(bonus);
    const types = value.types ?? [];
    const match = value.match ?? null;
    const data = await super.getData();
    const choices = await this.choices();

    data.types = choices.map(c => ({
      checked: types.has(c.value),
      value: c.value,
      label: c.abbr,
      tooltip: c.label
    }));
    data.selected = match;
    data.options = {
      ANY: "BABONUS.FiltersSpellComponentsMatchAny",
      ALL: "BABONUS.FiltersSpellComponentsMatchAll"
    };
    return data;
  }

  /** @override */
  static async choices() {
    const keys = CONFIG.DND5E.validProperties.spell;
    const labels = CONFIG.DND5E.itemProperties;
    return keys.reduce((acc, k) => {
      const {label, abbr} = labels[k] ?? {};
      if (label) acc.push({value: k, label: label, abbr: abbr || label.slice(0, 1).toUpperCase()});
      return acc;
    }, []);
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
    super(new StringField());
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData(bonus);
    data.value.forEach(v => {
      v.label = CONFIG.DND5E.actorSizes[v.value].abbreviation;
    });
    return data;
  }

  /** @override */
  static async choices() {
    return Object.entries(CONFIG.DND5E.actorSizes).map(([k, v]) => {
      return {value: k, label: v.label};
    });
  }
}

export const checkboxFields = {
  proficiencyLevels: ProficiencyLevelsField,
  itemTypes: ItemTypesField,
  attackTypes: AttackTypesField,
  spellLevels: SpellLevelsField,
  spellComponents: SpellComponentsField,
  actorCreatureSizes: ActorCreatureSizesField
};
