import {FilterMixin} from "../filter-mixin.mjs";

class BaseField extends FilterMixin(foundry.data.fields.SetField) {
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
    super(new foundry.data.fields.NumberField());
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
    super(new foundry.data.fields.StringField());
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
    super(new foundry.data.fields.StringField());
  }

  /** @override */
  static async choices() {
    return ["mwak", "rwak", "msak", "rsak"].map(ak => ({value: ak, label: CONFIG.DND5E.itemActionTypes[ak]}));
  }
}

class SpellLevelsField extends BaseField {
  static name = "spellLevels";

  constructor() {
    super(new foundry.data.fields.NumberField());
  }

  /** @override */
  static async choices() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({value: Number(value), label}));
  }
}

export const checkboxFields = {
  proficiencyLevels: ProficiencyLevelsField,
  itemTypes: ItemTypesField,
  attackTypes: AttackTypesField,
  spellLevels: SpellLevelsField
};
