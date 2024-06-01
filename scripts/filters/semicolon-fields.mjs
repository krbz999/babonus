import {FilterMixin} from "./filter-mixin.mjs";

const {SetField, StringField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  static template = "modules/babonus/templates/parts/text-keys.hbs";
  static canExclude = true;

  constructor(options = {}) {
    super(new StringField(), options);
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
    const data = await super.getData(bonus);
    data.value = Array.from(this.value(bonus)).filterJoin(";");
    return data;
  }

  /** @override */
  _toInput(config) {
    if ((config.value instanceof Set) || Array.isArray(config.value)) {
      config.value = Array.from(config.value).join(";");
    }
    return foundry.data.fields.StringField.prototype._toInput.call(this, config);
  }

  /** @override */
  toFormGroup(formConfig, inputConfig) {
    const element = super.toFormGroup(formConfig, inputConfig);

    const input = element.querySelector("input");
    const button = document.createElement("BUTTON");
    button.dataset.action = "keys-dialog";
    button.dataset.property = input.name;
    button.dataset.id = this.constructor.name;
    button.type = "button";
    button.innerHTML = `<i class="fa-solid fa-key"></i> ${game.i18n.localize("BABONUS.Keys")}`;
    input.after(button);

    return element;
  }
}

class AbilitiesField extends BaseField {
  static name = "abilities";
  static canExclude = true;

  constructor(options = {}) {
    super(foundry.utils.mergeObject({
      label: "BABONUS.Filters.Abilities.Label",
      hint: "BABONUS.Filters.Abilities.Hint"
    }, options));
  }

  /** @override */
  static async choices() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, {label}]) => ({value, label}));
  }
}

class SaveAbilitiesField extends AbilitiesField {
  static name = "saveAbilities";

  constructor() {
    super({
      label: "BABONUS.Filters.SaveAbilities.Label",
      hint: "BABONUS.Filters.SaveAbilities.Hint"
    });
  }
}

class ThrowTypesField extends AbilitiesField {
  static name = "throwTypes";
  static canExclude = false;

  constructor() {
    super({
      label: "BABONUS.Filters.ThrowTypes.Label",
      hint: "BABONUS.Filters.ThrowTypes.Hint"
    });
  }

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

  constructor(options = {}) {
    super(foundry.utils.mergeObject({
      label: "BABONUS.Filters.StatusEffects.Label",
      hint: "BABONUS.Filters.StatusEffects.Hint"
    }, options));
  }

  /** @override */
  static async choices() {
    return CONFIG.statusEffects.reduce((acc, {id, img, name}) => {
      if (id && img && name) acc.push({value: id, label: name, icon: img});
      return acc;
    }, []);
  }
}

class TargetEffectsField extends StatusEffectsField {
  static name = "targetEffects";

  constructor() {
    super({
      label: "BABONUS.Filters.TargetEffects.Label",
      hint: "BABONUS.Filters.TargetEffects.Hint"
    });
  }
}

class AuraBlockersField extends StatusEffectsField {
  static name = "auraBlockers";
  static canExclude = false;
  static trash = false;
}

class CreatureTypesField extends BaseField {
  static name = "creatureTypes";

  constructor(options = {}) {
    super(foundry.utils.mergeObject({
      label: "BABONUS.Filters.CreatureTypes.Label",
      hint: "BABONUS.Filters.CreatureTypes.Hint"
    }, options));
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.ActorCreatureTypes.Label",
      hint: "BABONUS.Filters.ActorCreatureTypes.Hint"
    });
  }
}

class BaseArmorsField extends BaseField {
  static name = "baseArmors";

  constructor() {
    super({
      label: "BABONUS.Filters.BaseArmors.Label",
      hint: "BABONUS.Filters.BaseArmors.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.BaseTools.Label",
      hint: "BABONUS.Filters.BaseTools.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.BaseWeapons.Label",
      hint: "BABONUS.Filters.BaseWeapons.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.DamageTypes.Label",
      hint: "BABONUS.Filters.DamageTypes.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.PreparationModes.Label",
      hint: "BABONUS.Filters.PreparationModes.Hint"
    });
  }

  /** @override */
  static async choices() {
    const modes = Object.entries(CONFIG.DND5E.spellPreparationModes);
    return modes.map(([value, {label}]) => ({value, label}));
  }
}

class SkillIdsField extends BaseField {
  static name = "skillIds";

  constructor() {
    super({
      label: "BABONUS.Filters.SkillIds.Label",
      hint: "BABONUS.Filters.SkillIds.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.SpellSchools.Label",
      hint: "BABONUS.Filters.SpellSchools.Hint"
    });
  }

  /** @override */
  static async choices() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([k, v]) => ({value: k, label: v.label}));
  }
}

class WeaponPropertiesField extends BaseField {
  static name = "weaponProperties";

  constructor() {
    super({
      label: "BABONUS.Filters.WeaponProperties.Label",
      hint: "BABONUS.Filters.WeaponProperties.Hint"
    });
  }

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

  constructor() {
    super({
      label: "BABONUS.Filters.ActorLanguages.Label",
      hint: "BABONUS.Filters.ActorLanguages.Hint"
    });
  }

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

export default {
  AbilitiesField,
  SaveAbilitiesField,
  ThrowTypesField,
  StatusEffectsField,
  TargetEffectsField,
  AuraBlockersField,
  CreatureTypesField,
  ActorCreatureTypesField,
  BaseArmorsField,
  BaseToolsField,
  BaseWeaponsField,
  DamageTypesField,
  PreparationModesField,
  SkillIdsField,
  SpellSchoolsField,
  WeaponPropertiesField,
  ActorLanguagesField
};
