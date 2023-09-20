import {FilterMixin} from "../FilterMixin.mjs";

class BaseField extends FilterMixin(foundry.data.fields.ArrayField) {
  static template = "modules/babonus/templates/parts/checkboxes.hbs";

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = bonus ? this.value(bonus) : [];
    data.value = this.choices.map(c => {
      return {
        checked: value.includes(c.value),
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
  static get choices() {
    const levels = Object.entries(CONFIG.DND5E.proficiencyLevels);
    return levels.map(([value, label]) => ({value: Number(value), label}));
  }
}

class ItemTypesField extends BaseField {
  static name = "itemTypes";

  constructor() {
    super(new foundry.data.fields.StringField());
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData(bonus);
    data.value.forEach(v => v.label = v.label.slice(0, 4));
    return data;
  }

  /** @override */
  static get choices() {
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
  static get choices() {
    return ["mwak", "rwak", "msak", "rsak"].map(ak => ({value: ak, label: CONFIG.DND5E.itemActionTypes[ak]}));
  }
}

class SpellLevelsField extends BaseField {
  static name = "spellLevels";

  constructor() {
    super(new foundry.data.fields.NumberField());
  }

  /** @override */
  static get choices() {
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
