import {FilterMixin} from "../FilterMixin.mjs";

class BaseField extends FilterMixin(foundry.data.fields.ArrayField) {
  static template = "modules/babonus/templates/parts/text-keys.hbs";
  static canExclude = true;

  constructor() {
    super(new foundry.data.fields.StringField());
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
    data.value = this.value(bonus).join(";");
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
    });

    // CN compatibility.
    if (game.modules.get("concentrationnotifier")?.active) {
      choices.push({
        value: CN.STATUS,
        label: game.i18n.localize("DND5E.Concentration")
      });
    }

    return choices;
  }
}

class StatusEffectsField extends BaseField {
  static name = "statusEffects";

  /** @override */
  static async choices() {
    let effects = CONFIG.statusEffects;
    if (game.modules.get("concentrationnotifier")?.active) {
      // Using .concat as not to mutate.
      effects = effects.concat({id: CN.STATUS, icon: CN.ICON});
    }
    return effects.reduce((acc, {id, icon}) => {
      if (!id) return acc;
      acc.push({value: id, label: id, icon});
      return acc;
    }, []).sort((a, b) => a.value.localeCompare(b.value));
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
    return types.map(([value, label]) => {
      return {value, label: game.i18n.localize(label)};
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
    return [...damages, ...heals].map(([value, label]) => ({value, label}));
  }
}

class PreparationModesField extends BaseField {
  static name = "preparationModes";
  static canExclude = false;

  /** @override */
  static async choices() {
    const modes = Object.entries(CONFIG.DND5E.spellPreparationModes);
    return modes.map(([value, label]) => ({value, label}));
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
    return schools.map(([value, label]) => ({value, label}));
  }
}

class WeaponPropertiesField extends BaseField {
  static name = "weaponProperties";

  /** @override */
  static async choices() {
    const properties = Object.entries(CONFIG.DND5E.weaponProperties);
    return properties.map(([value, label]) => ({value, label}));
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
  weaponProperties: WeaponPropertiesField
};
