import {BabonusSheet} from "../applications/babonus-sheet.mjs";
import {module} from "./_module.mjs";

class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
  }

  static get metadata() {
    return {label: game.i18n.localize("BABONUS.Babonus")};
  }

  /** @override */
  get sheet() {
    if (this._sheet) return this._sheet;
    return this._sheet = new BabonusSheet(this);
  }

  /**
   * @override
   * Since babs are always local, all users have permission to render them.
   * Proper permissions are handled elsewhere.
   */
  testUserPermission() {
    return true;
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    if (!source) return data;
    for (const id in data.filters) {
      if (!module.filters[id].storage(this)) delete data.filters[id];
    }
    return data;
  }

  /** @override */
  toDragData() {
    return {type: "Babonus", uuid: this.uuid};
  }

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @returns {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /**
   * The FA icon unique to this babonus type. Must be subclassed.
   * @returns {string}
   */
  static get icon() {
    return null;
  }
  get icon() {
    return this.constructor.icon;
  }

  /**
   * Get the type of a babonus.
   * @returns {string}
   */
  static get type() {
    return null;
  }

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it applies to attack rolls, damage
   * rolls, saving throws, or ability checks; any of the rolls that have a roll configuration dialog. The babonus must also
   * apply an additive bonus on top, i.e., something that can normally go in the 'Situational Bonus' input.
   * TODO: once hit die rolls have a dialog as well, this should be amended.
   * TODO: once rolls can be "remade" in 2.4.0, optional bonuses should be able to apply to other properties as well.
   * @returns {boolean}
   */
  get isOptionable() {
    return ["attack", "damage", "throw", "test"].includes(this.type) && !!this.bonuses.bonus;
  }

  /**
   * Whether a babonus is currently optional, which is only true if it is both able to be optional, and toggled as such.
   * @returns {boolean}
   */
  get isOptional() {
    return this.optional && this.isOptionable;
  }

  /**
   * Whether a babonus is valid for being 'item only' in the builder. It must be embedded in an item, must not be an aura or
   * template aura, and must either apply to attack rolls, damage rolls, or save DCs while the parent item can make use of
   * one of those, or it must apply to ability checks while being embedded on a tool-type item.
   * @returns {boolean}
   */
  get canExclude() {
    if (!(this.parent instanceof Item)) return false;

    // Valid for attack/damage/save:
    const model = dnd5e.dataModels.item.config[this.parent.type];
    const validityA = ["attack", "damage", "save"].includes(this.type) && model.schema.getField("damage.parts");

    // Valid for test:
    const validityB = (this.type === "test") && (this.parent.type === "tool");

    return (validityA || validityB);
  }

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @returns {boolean}
   */
  get isExclusive() {
    return this.exclusive && this.canExclude;
  }

  /**
   * Whether the babonus is unavailable due to its parent item being unequipped or unattuned (if required).
   * This is different from a babonus that is unavailable due to its parent effect being disabled or unavailable.
   * @returns {boolean}
   */
  get isSuppressed() {
    const item = this.item;
    if (!item) return false;

    // The item type must be equippable.
    if (!dnd5e.dataModels.item.config[item.type].schema.getField("equipped")) return false;

    // The item is not equipped.
    if (!item.system.equipped) return true;
    // The item requires but is not attuned.
    return item.system.attunement === CONFIG.DND5E.attunementTypes.REQUIRED;
  }

  get isTokenAura() {
    console.warn(`'Babonus#isTokenAura' has been deprecated and should be accessed in 'Babonus#aura#isToken'.`);
    return this.aura.isToken;
  }
  get isTemplateAura() {
    console.warn(`'Babonus#isTemplateAura' has been deprecated and should be accessed in 'Babonus#aura#isTemplate'.`);
    return this.aura.isTemplate;
  }
  get isAuraBlocked() {
    console.warn(`'Babonus#isAuraBlocked' has been deprecated and should be accessed in 'Babonus#aura#isBlocked'.`);
    return this.aura.isBlocked;
  }

  /**
   * The true source of the babonus.
   * - If the babonus is embedded on a template, this returns the item that created it.
   * - If the babonus is embedded on an effect, this returns the actor or item from which the effect originates.
   * - If the babonus is embedded on an item or actor, this simply returns that item or actor.
   * @type {Actor5e|Item5e|null}
   */
  get origin() {
    let origin = null;
    if (this.parent instanceof MeasuredTemplateDocument) {
      const retrieved = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      if (retrieved instanceof Item) origin = retrieved;
    } else if (this.parent instanceof ActiveEffect) {
      const retrieved = fromUuidSync(this.parent.origin ?? "");
      if ((retrieved instanceof Item) || (retrieved instanceof Actor)) origin = retrieved;
    } else if ((this.parent instanceof Item) || (this.parent instanceof Actor)) {
      origin = this.parent;
    }
    return origin;
  }

  /**
   * Get the source actor of a babonus, no matter what type of document it is embedded in.
   * @returns {Actor|null}
   */
  get actor() {
    if (this.parent instanceof Actor) {
      return this.parent;
    }

    else if (this.parent instanceof ActiveEffect) {
      if (this.parent.parent instanceof Actor) {
        // Case 1: Effect on actor.
        return this.parent.parent;
      } else if (this.parent.parent instanceof Item) {
        // Case 2: Effect on item on actor.
        return this.parent.parent.actor;
      }
    }

    else if (this.parent instanceof Item) {
      return this.parent.actor;
    }

    else if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e.origin);
      return item?.actor ?? null;
    }
  }

  /**
   * Get the token corresponding token of the actor that has the bonus, no matter what type of document it is embedded in.
   * @returns {Token|null}
   */
  get token() {
    const actor = this.actor;
    if (!actor) return null;

    return actor.token?.object ?? actor.getActiveTokens()[0] ?? null;
  }

  /**
   * Get the item that has the babonus, no matter if the babonus lives on a template, effect, or item.
   * @returns {Item|null}
   */
  get item() {
    if (this.parent instanceof Item) {
      return this.parent;
    }

    else if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e.origin);
      return item ?? null;
    }

    else if (this.parent instanceof ActiveEffect) {
      const item = fromUuidSync(this.parent.origin ?? "");
      return (item instanceof Item) ? item : null;
    }

    else if (this.parent instanceof Actor) {
      return null;
    }
  }

  /**
   * Get the effect that has the babonus.
   * @returns {ActiveEffect|null}
   */
  get effect() {
    return (this.parent instanceof ActiveEffect) ? this.parent : null;
  }

  /**
   * Get the template that has the babonus.
   * @returns {MeasuredTemplateDocument|null}
   */
  get template() {
    return (this.parent instanceof MeasuredTemplateDocument) ? this.parent : null;
  }

  /**
   * Get the default values nested within the schema.
   * @param {string} prefix     The prefix leading to the object of initial values.
   * @returns {object}          An object of values.
   */
  getDefaults(prefix) {
    const field = this.schema.getField(prefix);
    return field.getInitialValue();
  }

  /** @override */
  static defineSchema() {
    const base = this._defineBaseSchema();
    base.bonuses = new foundry.data.fields.SchemaField(this._defineBonusSchema());
    base.filters = new foundry.data.fields.SchemaField(this._defineFilterSchema());
    return base;
  }

  /**
   * Define the basics of the schema, properties that are not type specific.
   * @returns {object}      An object of properties.
   */
  static _defineBaseSchema() {
    return {
      id: new foundry.data.fields.DocumentIdField({initial: () => foundry.utils.randomID()}),
      name: new foundry.data.fields.StringField({required: true, blank: false}),
      img: new foundry.data.fields.FilePathField({categories: ["IMAGE"], initial: "icons/svg/dice-target.svg"}),
      type: new foundry.data.fields.StringField({required: true, initial: this.type, choices: [this.type]}),
      enabled: new foundry.data.fields.BooleanField({initial: true}),
      exclusive: new foundry.data.fields.BooleanField(),
      optional: new foundry.data.fields.BooleanField(),
      description: new foundry.data.fields.StringField({required: true}),
      consume: new foundry.data.fields.EmbeddedDataField(module.fields.consume),
      aura: new foundry.data.fields.EmbeddedDataField(module.fields.aura),
      flags: new foundry.data.fields.ObjectField()
    };
  }

  /**
   * Define the bonuses data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineBonusSchema() {
    return {};
  }

  /**
   * Define the filter data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineFilterSchema() {
    return {
      arbitraryComparison: new module.filters.arbitraryComparison(),
      baseArmors: new module.filters.baseArmors(),
      statusEffects: new module.filters.statusEffects(),
      healthPercentages: new module.filters.healthPercentages(),
      customScripts: new module.filters.customScripts(),
      remainingSpellSlots: new module.filters.remainingSpellSlots(),
      actorCreatureTypes: new module.filters.actorCreatureTypes()
    };
  }

  /** @override */
  static migrateData(source) {
    if (!source.filters) source.filters = {};
    this._migrateCreatureTypes(source);
    this._migrateWeaponProperties(source);
    this._migrateExclusive(source);
  }

  /**
   * Migrate creature types filter into a single array of strings.
   * @param {object} source     The initial source data of the babonus.
   */
  static _migrateCreatureTypes(source) {
    const types = source.filters.creatureTypes;
    if (!types || (types instanceof Array) || (typeof types === "string")) return;
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.creatureTypes = c;
  }

  /**
   * Migrate weapon properties filter into a single array of strings.
   * @param {object} source     The initial source data of the babonus.
   */
  static _migrateWeaponProperties(source) {
    const types = source.filters.weaponProperties;
    if (!types || (types instanceof Array) || (typeof types === "string")) return;
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.weaponProperties = c;
  }

  /**
   * Migrate the 'itemOnly' property to be renamed 'exclusive'.
   * @param {object} source     The initial source data of the babonus.
   */
  static _migrateExclusive(source) {
    if (source.itemOnly) source.exclusive = true;
    delete source.itemOnly;
  }

  /**
   * Get applicable roll data from the origin.
   * @param {boolean} deterministic     Whether to force flat values for properties that could be a die term or flat term.
   * @returns {object}                  The roll data.
   */
  getRollData({deterministic = false} = {}) {
    return this.origin?.getRollData({deterministic}) ?? {};
  }

  /** @override */
  prepareDerivedData() {
    return;
  }

  /* -------------------------------------------- */
  /*               Flag Operations                */
  /* -------------------------------------------- */

  /**
   * Get the value of a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @returns {*}
   */
  getFlag(scope, key) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    return foundry.utils.getProperty(this.flags?.[scope], key);
  }

  /**
   * Set a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @param {*} value
   * @returns {Promise<Babonus>}
   */
  async setFlag(scope, key, value) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    await this.parent.update({[`flags.babonus.bonuses.${this.id}.flags.${scope}.${key}`]: value});
    this.updateSource({[`flags.${scope}.${key}`]: value});
    return this;
  }

  /**
   * Remove a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @return {Promise<Babonus>}
   */
  async unsetFlag(scope, key) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    const head = key.split(".");
    const tail = `-=${head.pop()}`;
    key = ["flags", scope, ...head, tail].join(".");
    await this.parent.update({[`flags.babonus.bonuses.${this.id}.${key}`]: null});
    this.updateSource({[key]: null});
    return this;
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new module.filters.abilities(),
      attackTypes: new module.filters.attackTypes(),
      baseWeapons: new module.filters.baseWeapons(),
      creatureTypes: new module.filters.creatureTypes(),
      damageTypes: new module.filters.damageTypes(),
      featureTypes: new module.filters.featureTypes(),
      itemTypes: new module.filters.itemTypes(),
      preparationModes: new module.filters.preparationModes(),
      spellComponents: new module.filters.spellComponents(),
      spellLevels: new module.filters.spellLevels(),
      spellSchools: new module.filters.spellSchools(),
      targetEffects: new module.filters.targetEffects(),
      tokenSizes: new module.filters.tokenSizes(),
      weaponProperties: new module.filters.weaponProperties()
    };
  }
}

class AttackBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField(),
      criticalRange: new foundry.data.fields.StringField(),
      fumbleRange: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-location-crosshairs";
  }

  /** @override */
  static get type() {
    return "attack";
  }
}

class DamageBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField(),
      criticalBonusDice: new foundry.data.fields.StringField(),
      criticalBonusDamage: new foundry.data.fields.StringField(),
      modifiers: new foundry.data.fields.EmbeddedDataField(module.fields.modifiers)
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-burst";
  }

  /** @override */
  static get type() {
    return "damage";
  }
}

class SaveBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      saveAbilities: new module.filters.saveAbilities()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-hand-sparkles";
  }

  /** @override */
  static get type() {
    return "save";
  }
}

class ThrowBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField(),
      deathSaveTargetValue: new foundry.data.fields.StringField(),
      deathSaveCritical: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      throwTypes: new module.filters.throwTypes(),
      targetEffects: new module.filters.targetEffects(),
      creatureTypes: new module.filters.creatureTypes(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-person-falling-burst";
  }

  /** @override */
  static get type() {
    return "throw";
  }
}

class TestBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new module.filters.abilities(),
      baseTools: new module.filters.baseTools(),
      skillIds: new module.filters.skillIds(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-bolt";
  }

  /** @override */
  static get type() {
    return "test";
  }
}

class HitDieBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField(),
      modifiers: new foundry.data.fields.EmbeddedDataField(module.fields.modifiers)
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-heart-pulse";
  }

  /** @override */
  static get type() {
    return "hitdie";
  }
}

export const models = {
  attack: AttackBabonus,
  damage: DamageBabonus,
  save: SaveBabonus,
  throw: ThrowBabonus,
  test: TestBabonus,
  hitdie: HitDieBabonus
};
