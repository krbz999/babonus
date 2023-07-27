import {module} from "./_module.mjs";

class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
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
  static get type(){
    return null;
  }

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it applies to attack rolls, damage
   * rolls, saving throws, or ability checks; any of the rolls that have a roll configuration dialog. The babonus must also
   * apply an additive bonus on top, i.e., something that can normally go in the 'Situational Bonus' input.
   * TODO: once hit die rolls have a dialog as well, this should be amended.
   * TODO: once rolls can be "remade" in 2.3.0, optional bonuses should be able to apply to other properties as well.
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

    return (validityA || validityB) && !this.aura.isToken && !this.aura.isTemplate;
  }

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @returns {boolean}
   */
  get isExclusive() {
    return this.exclusive && this.canExclude;
  }

  /**
   * Whether the babonus is unavailable due to its parent item being unequipped or unattuned (if required). This is
   * different from a babonus that is unavailable due to its parent effect being disabled or unavailable.
   * @returns {boolean}
   */
  get isSuppressed() {
    if (!(this.parent instanceof Item)) return false;

    const item = this.item;
    if (!item || !dnd5e.dataModels.item.config[item.type].schema.getField("equipped")) {
      return false;
    }

    const ir = this.filters.itemRequirements;
    const at = CONFIG.DND5E.attunementTypes.ATTUNED;
    return ((item.system.attunement !== at) && ir.attuned) || (!item.system.equipped && ir.equipped);
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
   * @returns {Actor|Item}
   */
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const origin = this.parent.flags.dnd5e?.origin ?? "";
      return fromUuidSync(origin);
    }

    else if (this.parent instanceof ActiveEffect) {
      return fromUuidSync(this.parent.origin ?? "");
    }

    else if (this.parent instanceof Item) {
      return this.parent;
    }

    else if (this.parent instanceof Actor) {
      return this.parent;
    }
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
   * Get the tempalte that has the babonus.
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
      type: new foundry.data.fields.StringField({required: true, initial: this.type, choices: [this.type]}),
      enabled: new foundry.data.fields.BooleanField({initial: true}),
      exclusive: new foundry.data.fields.BooleanField(),
      optional: new foundry.data.fields.BooleanField(),
      description: new foundry.data.fields.StringField({required: true}),
      consume: new foundry.data.fields.EmbeddedDataField(module.fields.consume),
      aura: new foundry.data.fields.EmbeddedDataField(module.fields.aura)
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
      itemRequirements: new module.filters.itemRequirements(),
      arbitraryComparison: new module.filters.arbitraryComparison(),
      baseArmors: new module.filters.baseArmors(),
      statusEffects: new module.filters.statusEffects(),
      healthPercentages: new module.filters.healthPercentages(),
      customScripts: new module.filters.customScripts(),
      preparationModes: new module.filters.preparationModes(),
      tokenSizes: new module.filters.tokenSizes(),
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
    console.warn(`A babonus (${source.name}) is using an outdated format for 'Creature Types'. Editing and saving the bonus with no changes made will resolve this warning.`);
    console.warn("The old format will be supported until FVTT v11.");
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
    console.warn(`A babonus (${source.name}) is using an outdated format for 'Weapon Properties'. Editing and saving the bonus with no changes made will resolve this warning.`);
    console.warn("The old format will be supported until FVTT v11.");
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
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      itemTypes: new module.filters.itemTypes(),
      attackTypes: new module.filters.attackTypes(),
      damageTypes: new module.filters.damageTypes(),
      abilities: new module.filters.abilities(),
      spellComponents: new module.filters.spellComponents(),
      spellLevels: new module.filters.spellLevels(),
      spellSchools: new module.filters.spellSchools(),
      baseWeapons: new module.filters.baseWeapons(),
      weaponProperties: new module.filters.weaponProperties(),
      targetEffects: new module.filters.targetEffects(),
      creatureTypes: new module.filters.creatureTypes()
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
  static get type(){
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
      criticalBonusDamage: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-burst";
  }

  /** @override */
  static get type(){
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
  static get type(){
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
  static get type(){
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
  static get type(){
    return "test";
  }
}

class HitDieBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-heart-pulse";
  }

  /** @override */
  static get type(){
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
