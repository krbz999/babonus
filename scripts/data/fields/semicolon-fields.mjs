import {FilterMixin} from "../filter-mixin.mjs";

const {SetField, StringField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  static template = "modules/babonus/templates/parts/text-keys.hbs";
  static canExclude = true;

  constructor() {
    super(new StringField());
  }

  /** @override */
  _cast(value) {
    // If the given value is a string, split it at each ';' and trim the results to get an array.
    if (typeof value === "string") value = value.split(";").map(v => v.trim());
    return super._cast(value);
  }

  /** @override */
  _cleanType(value, source) {
    value = super._cleanType(value, source).reduce((acc, v) => {
      if (v) acc.add(v);
      return acc;
    }, new Set());
    return Array.from(value);
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    data.value = Array.from(this.value(bonus)).filterJoin(";");
    return data;
  }
}

class AbilitiesField extends BaseField {
  static name = "abilities";
  static canExclude = true;

  /** @override */
  static async choices() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, {label}]) => ({value, label}));
  }
}

class SaveAbilitiesField extends AbilitiesField {
  static name = "saveAbilities";
}

class ThrowTypesField extends AbilitiesField {
  static name = "throwTypes";
  static canExclude = false;

  /** @override */
  static async choices() {
    const choices = await super.choices();

    choices.push({
      value: "death",
      label: game.i18n.localize("DND5E.DeathSave")
    }, {
      value: "concentration",
      label: game.i18n.localize("DND5E.Concentration")
    });

    return choices;
  }
}

class StatusEffectsField extends BaseField {
  static name = "statusEffects";

  /** @override */
  static async choices() {
    return CONFIG.statusEffects.reduce((acc, {id, icon, name}) => {
      if (id && icon && name) acc.push({value: id, label: name, icon: icon});
      return acc;
    }, []);
  }
}

class TargetEffectsField extends StatusEffectsField {
  static name = "targetEffects";
}

class AuraBlockersField extends StatusEffectsField {
  static name = "auraBlockers";
  static canExclude = false;
}

class CreatureTypesField extends BaseField {
  static name = "creatureTypes";

  /** @override */
  static async choices() {
    const types = Object.entries(CONFIG.DND5E.creatureTypes);
    return types.map(([k, v]) => {
      return {value: k, label: v.label};
    }).sort((a, b) => a.label.localeCompare(b.label));
  }
}

class ActorCreatureTypesField extends CreatureTypesField {
  static name = "actorCreatureTypes";
}

class BaseArmorsField extends BaseField {
  static name = "baseArmors";

  /** @override */
  static async choices() {
    const trait = dnd5e.documents.Trait;
    const choices = await trait.choices("armor", {chosen: new Set()});
    const keys = choices.asSet();
    return keys.reduce((acc, k) => acc.concat([{value: k, label: trait.keyLabel(`armor:${k}`)}]), []);
  }
}

class BaseToolsField extends BaseField {
  static name = "baseTools";

  /** @override */
  static async choices() {
    const trait = dnd5e.documents.Trait;
    const choices = await trait.choices("tool", {chosen: new Set()});
    const keys = choices.asSet();
    return keys.reduce((acc, k) => acc.concat([{value: k, label: trait.keyLabel(`tool:${k}`)}]), []);
  }
}

class BaseWeaponsField extends BaseField {
  static name = "baseWeapons";

  /** @override */
  static async choices() {
    const trait = dnd5e.documents.Trait;
    const choices = await trait.choices("weapon", {chosen: new Set()});
    const keys = choices.asSet();
    return keys.reduce((acc, k) => acc.concat([{value: k, label: trait.keyLabel(`weapon:${k}`)}]), []);
  }
}

class DamageTypesField extends BaseField {
  static name = "damageTypes";

  /** @override */
  static async choices() {
    const damages = Object.entries(CONFIG.DND5E.damageTypes);
    const heals = Object.entries(CONFIG.DND5E.healingTypes);
    return [...damages, ...heals].map(([k, v]) => ({value: k, label: v.label}));
  }
}

class PreparationModesField extends BaseField {
  static name = "preparationModes";
  static canExclude = false;

  /** @override */
  static async choices() {
    const modes = Object.entries(CONFIG.DND5E.spellPreparationModes);
    return modes.map(([value, {label}]) => ({value, label}));
  }
}

class SkillIdsField extends BaseField {
  static name = "skillIds";

  /** @override */
  static async choices() {
    const trait = dnd5e.documents.Trait;
    const choices = await trait.choices("skills", {chosen: new Set()});
    const keys = choices.asSet();
    return keys.reduce((acc, k) => acc.concat([{value: k, label: trait.keyLabel(`skills:${k}`)}]), []);
  }
}

class SpellSchoolsField extends BaseField {
  static name = "spellSchools";

  /** @override */
  static async choices() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([k, v]) => ({value: k, label: v.label}));
  }
}

class WeaponPropertiesField extends BaseField {
  static name = "weaponProperties";

  /** @override */
  static async choices() {
    const keys = CONFIG.DND5E.validProperties.weapon;
    const labels = CONFIG.DND5E.itemProperties;
    return keys.reduce((acc, k) => {
      const label = labels[k]?.label;
      if (label) acc.push({value: k, label: label});
      return acc;
    }, []);
  }
}

class ActorLanguagesField extends BaseField {
  static name = "actorLanguages";

  /** @override */
  static async choices() {
    const trait = dnd5e.documents.Trait;
    const choices = await trait.choices("languages", {chosen: new Set()});

    const langs = new Set();
    const cats = new Set();

    const construct = (c) => {
      for (const [key, choice] of Object.entries(c)) {
        if (choice.children) {
          cats.add(key);
          construct(choice.children);
        } else langs.add(key);
      }
    };

    construct(choices);

    const toLabel = (k, isCat = true) => ({value: k, label: trait.keyLabel(`languages:${k}`), isCategory: isCat});

    return Array.from(cats.map(k => toLabel(k, true))).concat(Array.from(langs.map(k => toLabel(k, false))));
  }
}

export const fields = {
  abilities: AbilitiesField,
  saveAbilities: SaveAbilitiesField,
  throwTypes: ThrowTypesField,
  statusEffects: StatusEffectsField,
  targetEffects: TargetEffectsField,
  auraBlockers: AuraBlockersField,
  creatureTypes: CreatureTypesField,
  actorCreatureTypes: ActorCreatureTypesField,
  baseArmors: BaseArmorsField,
  baseTools: BaseToolsField,
  baseWeapons: BaseWeaponsField,
  damageTypes: DamageTypesField,
  preparationModes: PreparationModesField,
  skillIds: SkillIdsField,
  spellSchools: SpellSchoolsField,
  weaponProperties: WeaponPropertiesField,
  actorLanguages: ActorLanguagesField
};
