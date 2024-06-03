import {FilterMixin} from "./filter-mixin.mjs";

const {SetField, StringField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
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
    button.dataset.action = "keysDialog";
    button.dataset.property = input.name;
    button.dataset.id = this.constructor.name;
    button.type = "button";
    button.innerHTML = `<i class="fa-solid fa-key"></i> ${game.i18n.localize("BABONUS.Keys")}`;
    input.after(button);

    return element;
  }

  /** @override */
  static render(bonus) {
    const template = "{{formGroup field value=value localize=true}}";
    const data = {
      field: bonus.schema.getField(`filters.${this.name}`),
      value: bonus.filters[this.name]
    };

    return Handlebars.compile(template)(data);
  }

  /**
   * Retrieve the choices for a Keys dialog when configuring this field.
   * @returns {{value: string, label: string}[]}
   */
  static choices() {
    throw new Error("This must be subclassed!");
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
  static choices() {
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
  static choices() {
    const choices = super.choices();

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
  static choices() {
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
  static choices() {
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
  static choices() {
    return Array.from(babonus.trees.armor.asSet()).map(k => {
      return {
        value: k,
        label: dnd5e.documents.Trait.keyLabel(`armor:${k}`)
      };
    });
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
  static choices() {
    return Array.from(babonus.trees.tool.asSet()).map(k => {
      return {
        value: k,
        label: dnd5e.documents.Trait.keyLabel(`tool:${k}`)
      };
    });
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
  static choices() {
    return Array.from(babonus.trees.weapon.asSet()).map(k => {
      return {
        value: k,
        label: dnd5e.documents.Trait.keyLabel(`weapon:${k}`)
      };
    });
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
  static choices() {
    const damages = Object.entries(CONFIG.DND5E.damageTypes);
    const heals = Object.entries(CONFIG.DND5E.healingTypes);
    return [...damages, ...heals].map(([k, v]) => ({value: k, label: v.label}));
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
  static choices() {
    return Array.from(babonus.trees.skills.asSet()).map(k => {
      return {
        value: k,
        label: dnd5e.documents.Trait.keyLabel(`skills:${k}`)
      };
    });
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
  static choices() {
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
  static choices() {
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
  static choices() {
    const trait = dnd5e.documents.Trait;
    const choices = babonus.trees.languages;

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
  SkillIdsField,
  SpellSchoolsField,
  WeaponPropertiesField,
  ActorLanguagesField
};
