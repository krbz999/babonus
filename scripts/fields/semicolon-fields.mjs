import FilterMixin from "./filter-mixin.mjs";

const {SetField, StringField} = foundry.data.fields;

class BaseField extends FilterMixin(SetField) {
  /** @override */
  static canExclude = true;

  /* -------------------------------------------------- */

  /** @override */
  static trash = false;

  /* -------------------------------------------------- */

  /**
   * Encapsulate this in a fieldset when using the formGroup hbs helper?
   * @type {boolean}
   */
  static fieldset = true;

  /* -------------------------------------------------- */

  constructor(options = {}) {
    super(new StringField(), options);
  }

  /* -------------------------------------------------- */

  /** @override */
  _cast(value) {
    // If the given value is a string, split it at each ';' and trim the results to get an array.
    if (typeof value === "string") value = value.split(";").map(v => v.trim());
    return super._cast(value);
  }

  /* -------------------------------------------------- */

  /** @override */
  _cleanType(value, source) {
    value = super._cleanType(value, source).reduce((acc, v) => {
      if (v) acc.add(v);
      return acc;
    }, new Set());
    return Array.from(value);
  }

  /* -------------------------------------------------- */

  /** @override */
  _toInput(config) {
    if ((config.value instanceof Set) || Array.isArray(config.value)) {
      config.value = Array.from(config.value).join(";");
    }
    return foundry.data.fields.StringField.prototype._toInput.call(this, config);
  }

  /* -------------------------------------------------- */

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

    if (this.constructor.fieldset) {
      const set = document.createElement("FIELDSET");
      const label = element.querySelector("LABEL");
      set.innerHTML = `
      <legend>
        ${label.textContent}
        <a data-action="deleteFilter" data-id="${this.constructor.name}">
          <i class="fa-solid fa-trash"></i>
        </a>
      </legend>`;
      label.remove();

      const hint = element.querySelector(".hint");
      hint.remove();
      set.appendChild(hint);

      set.appendChild(element);
      return set;
    }

    return element;
  }

  /* -------------------------------------------------- */

  /** @override */
  static render(bonus) {
    const template = "{{formGroup field value=value}}";
    const data = {
      field: bonus.schema.getField(`filters.${this.name}`),
      value: bonus.filters[this.name]
    };

    return Handlebars.compile(template)(data);
  }

  /* -------------------------------------------------- */

  /**
   * Retrieve the choices for a Keys dialog when configuring this field.
   * @returns {{value: string, label: string}[]}
   */
  static choices() {
    throw new Error("This must be subclassed!");
  }
}

/* -------------------------------------------------- */

class AbilitiesField extends BaseField {
  /** @override */
  static name = "abilities";

  /* -------------------------------------------------- */

  /** @override */
  static canExclude = true;

  /* -------------------------------------------------- */

  /** @override */
  static choices() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, {label}]) => ({value, label}));
  }
}

/* -------------------------------------------------- */

class SaveAbilitiesField extends AbilitiesField {
  /** @override */
  static name = "saveAbilities";
}

/* -------------------------------------------------- */

class ThrowTypesField extends AbilitiesField {
  /** @override */
  static name = "throwTypes";

  /* -------------------------------------------------- */

  /** @override */
  static canExclude = false;

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class StatusEffectsField extends BaseField {
  /** @override */
  static name = "statusEffects";

  /* -------------------------------------------------- */

  /** @override */
  static choices() {
    return CONFIG.statusEffects.reduce((acc, {id, img, name}) => {
      if (id && img && name) acc.push({value: id, label: name, icon: img});
      return acc;
    }, []);
  }
}

/* -------------------------------------------------- */

class TargetEffectsField extends StatusEffectsField {
  /** @override */
  static name = "targetEffects";
}

/* -------------------------------------------------- */

class AuraBlockersField extends StatusEffectsField {
  /** @override */
  static name = "auraBlockers";

  /* -------------------------------------------------- */

  /** @override */
  static canExclude = false;

  /* -------------------------------------------------- */

  /** @override */
  static trash = false;

  /* -------------------------------------------------- */

  /** @override */
  static fieldset = false;
}

/* -------------------------------------------------- */

class CreatureTypesField extends BaseField {
  /** @override */
  static name = "creatureTypes";

  /* -------------------------------------------------- */

  /** @override */
  static choices() {
    const types = Object.entries(CONFIG.DND5E.creatureTypes);
    return types.map(([k, v]) => {
      return {value: k, label: v.label};
    }).sort((a, b) => a.label.localeCompare(b.label));
  }
}

/* -------------------------------------------------- */

class ActorCreatureTypesField extends CreatureTypesField {
  /** @override */
  static name = "actorCreatureTypes";
}

/* -------------------------------------------------- */

class BaseArmorsField extends BaseField {
  /** @override */
  static name = "baseArmors";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class TargetArmorsField extends BaseArmorsField {
  /** @override */
  static name = "targetArmors";
}

/* -------------------------------------------------- */

class BaseToolsField extends BaseField {
  /** @override */
  static name = "baseTools";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class BaseWeaponsField extends BaseField {
  /** @override */
  static name = "baseWeapons";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class DamageTypesField extends BaseField {
  /** @override */
  static name = "damageTypes";

  /* -------------------------------------------------- */

  /** @override */
  static choices() {
    const damages = Object.entries(CONFIG.DND5E.damageTypes);
    const heals = Object.entries(CONFIG.DND5E.healingTypes);
    return [...damages, ...heals].map(([k, v]) => ({value: k, label: v.label}));
  }
}

/* -------------------------------------------------- */

class SkillIdsField extends BaseField {
  /** @override */
  static name = "skillIds";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class SpellSchoolsField extends BaseField {
  /** @override */
  static name = "spellSchools";

  /* -------------------------------------------------- */

  /** @override */
  static choices() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([k, v]) => ({value: k, label: v.label}));
  }
}

/* -------------------------------------------------- */

class WeaponPropertiesField extends BaseField {
  /** @override */
  static name = "weaponProperties";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

class ActorLanguagesField extends BaseField {
  /** @override */
  static name = "actorLanguages";

  /* -------------------------------------------------- */

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

/* -------------------------------------------------- */

export default {
  AbilitiesField,
  ActorCreatureTypesField,
  ActorLanguagesField,
  AuraBlockersField,
  BaseArmorsField,
  BaseToolsField,
  BaseWeaponsField,
  CreatureTypesField,
  DamageTypesField,
  SaveAbilitiesField,
  SkillIdsField,
  SpellSchoolsField,
  StatusEffectsField,
  TargetArmorsField,
  TargetEffectsField,
  ThrowTypesField,
  WeaponPropertiesField
};
