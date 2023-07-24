import {babonusFields} from "./dataFields.mjs";

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
    if(!source) return data;
    for(const id in data.filters){
      if(!babonusFields.filters[id].storage(this)) delete data.filters[id];
    }
    return data;
  }

  /** @override */
  toDragData() {
    const dragData = {type: "Babonus"};
    if (this.parent) {
      dragData.uuid = this.parent.uuid;
      dragData.babId = this.id;
    }
    else dragData.data = this.toObject();
    return dragData;
  }

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @returns {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /**
   * Whether the babonus can open the Consumption app in the builder, which requires that it is Optional and has at least
   * one option in the 'type' available.
   * @returns {boolean}
   */
  get canConsume() {
    if (!this.isOptional) return false;
    return [
      this.canConsumeUses,
      this.canConsumeQuantity,
      this.canConsumeSlots,
      this.canConsumeEffect,
      this.canConsumeHealth
    ].some(a => a);
  }

  /**
   * Whether the bonus is scaling when consuming, which requires that it is consuming, has 'scales' set to true, and does
   * not consume an effect, which cannot scale. If the type is 'health', then 'step' must be 1 or greater. Otherwise the
   * 'max', if set, must be strictly greater than 'min'.
   * @returns {boolean}
   */
  get isScaling() {
    if (!this.isConsuming) return false;
    if (!this.consume.scales) return false;
    if (this.consume.type === "effect") return false;
    if ((this.consume.type === "health") && !(this.consume.value.step > 0)) return false;
    return (this.consume.value.max || Infinity) > this.consume.value.min;
  }

  /**
   * Whether 'Limited Uses' should be a valid option in the Consumption app. The babonus must not be an aura, template aura,
   * and must be embedded on an item that has limited uses.
   * @returns {boolean}
   */
  get canConsumeUses() {
    if (this.aura.isToken || this.aura.isTemplate) return false;
    return (this.parent instanceof Item) && this.parent.hasLimitedUses;
  }

  /**
   * Whether 'Quantity' should be a valid option in the Consumption app. The babonus must not be an aura, template aura, and
   * must be embedded on an item that has a quantity.
   * @returns {boolean}
   */
  get canConsumeQuantity() {
    if (this.aura.isToken || this.aura.isTemplate) return false;
    return (this.parent instanceof Item) && Number.isNumeric(this.parent.system.quantity);
  }

  /**
   * Whether 'Spell Slots' should be a valid option in the Consumption app. Since this works fine as an aura, there are no
   * restrictions to apply here, and it always returns true.
   * @returns {boolean}
   */
  get canConsumeSlots() {
    return true;
  }

  /**
   * Whether 'Hit Points' should be a valid option in the Consumption app. Since this works fine as an aura, there are no
   * restrictions to apply here, and it always returns true.
   * @returns {boolean}
   */
  get canConsumeHealth() {
    return true;
  }

  /**
   * Whether 'Effect' should be a valid option in the Consumption app. The babonus must not be an aura, template aura, and
   * must be embedded on an effect.
   * @returns {boolean}
   */
  get canConsumeEffect() {
    return (this.parent instanceof ActiveEffect) && !this.aura.isToken && !this.aura.isTemplate;
  }

  /**
   * Whether the consumption data on the babonus creates valid consumption for the optional bonus application when rolling.
   * If it does not, the babonus is ignored there.
   *
   * - For limited uses, only users who own the item in question are allowed to edit it by subtracting uses, and the minimum
   * required value must be a positive integer.
   * - For quantity, only users who own the item in question are allowed to edit it by subtracting quantities, and the
   * minimum required value must be a positive integer.
   * - For spell slots, the minimum required spell slot level must be a positive integer.
   * - For effects, only users who own the effect in question are allowed to delete it.
   * @returns {boolean}
   */
  get isConsuming() {
    if (!this.canConsume || !this.consume.enabled || !this.consume.type) return false;

    const type = this.consume.type;
    const min = Number.isNumeric(this.consume.value.min) ? this.consume.value.min : 1;
    const isItemOwner = (this.parent instanceof Item) && this.parent.isOwner;
    const isEffectOwner = (this.parent instanceof ActiveEffect) && this.parent.isOwner;

    if (type === "uses") return this.canConsumeUses && isItemOwner && (min > 0);
    else if (type === "quantity") return this.canConsumeQuantity && isItemOwner && (min > 0);
    else if (type === "slots") return this.canConsumeSlots && (min > 0);
    else if (type === "effect") return this.canConsumeEffect && isEffectOwner;
    else if (type === "health") return this.canConsumeHealth && (min > 0);
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
    return this.itemOnly && this.canExclude;
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
   * Whether the babonus has any valid entries in Babonus#bonuses. Such an entry is valid for consideration if it is a non-
   * empty string and is not simply '0'.
   * @returns {boolean}
   */
  get hasBonus() {
    return Object.values(this.bonuses).some(val => (val.length > 0) && (val !== "0"));
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
    base.bonuses = new babonusFields.data.bonuses(this._defineBonusSchema());
    base.filters = new foundry.data.fields.SchemaField(this._defineFilterSchema());
    return base;
  }

  /**
   * Define the basics of the schema, properties that are not type specific.
   * @returns {object}      An object of properties.
   */
  static _defineBaseSchema() {
    return {
      id: new foundry.data.fields.DocumentIdField({nullable: false}),
      name: new foundry.data.fields.StringField({required: true, blank: false}),
      type: new foundry.data.fields.StringField({required: true, blank: false, choices: BabonusTypes}),
      enabled: new foundry.data.fields.BooleanField({initial: true}),
      itemOnly: new foundry.data.fields.BooleanField(),
      optional: new foundry.data.fields.BooleanField(),
      description: new foundry.data.fields.StringField({required: true}),
      consume: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({required: false, initial: true}),
        type: new foundry.data.fields.StringField({nullable: true, initial: null, choices: ["", "uses", "quantity", "slots", "health", "effect"]}),
        scales: new foundry.data.fields.BooleanField({required: false}),
        formula: new foundry.data.fields.StringField({nullable: true, initial: null}),
        value: new foundry.data.fields.SchemaField({
          min: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
          max: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
          step: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1})
        })
      }),
      aura: new foundry.data.fields.EmbeddedDataField(babonusFields.data.aura)
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
      itemRequirements: new babonusFields.filters.itemRequirements(),
      arbitraryComparison: new babonusFields.filters.arbitraryComparison(),
      baseArmors: new babonusFields.filters.baseArmors(),
      statusEffects: new babonusFields.filters.statusEffects(),
      healthPercentages: new babonusFields.filters.healthPercentages(),
      customScripts: new babonusFields.filters.customScripts(),
      preparationModes: new babonusFields.filters.preparationModes(),
      tokenSizes: new babonusFields.filters.tokenSizes(),
      remainingSpellSlots: new babonusFields.filters.remainingSpellSlots(),
      actorCreatureTypes: new babonusFields.filters.actorCreatureTypes()
    };
  }

  /** @override */
  static migrateData(source) {
    if (!source.filters) source.filters = {};
    this._migrateCreatureTypes(source);
    this._migrateWeaponProperties(source);
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
      itemTypes: new babonusFields.filters.itemTypes(),
      attackTypes: new babonusFields.filters.attackTypes(),
      damageTypes: new babonusFields.filters.damageTypes(),
      abilities: new babonusFields.filters.abilities(),
      spellComponents: new babonusFields.filters.spellComponents(),
      spellLevels: new babonusFields.filters.spellLevels(),
      spellSchools: new babonusFields.filters.spellSchools(),
      baseWeapons: new babonusFields.filters.baseWeapons(),
      weaponProperties: new babonusFields.filters.weaponProperties(),
      targetEffects: new babonusFields.filters.targetEffects(),
      creatureTypes: new babonusFields.filters.creatureTypes()
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
      proficiencyLevels: new babonusFields.filters.proficiencyLevels()
    };
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
      saveAbilities: new babonusFields.filters.saveAbilities()
    };
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
      throwTypes: new babonusFields.filters.throwTypes(),
      targetEffects: new babonusFields.filters.targetEffects(),
      creatureTypes: new babonusFields.filters.creatureTypes(),
      proficiencyLevels: new babonusFields.filters.proficiencyLevels()
    };
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
      abilities: new babonusFields.filters.abilities(),
      baseTools: new babonusFields.filters.baseTools(),
      skillIds: new babonusFields.filters.skillIds(),
      proficiencyLevels: new babonusFields.filters.proficiencyLevels()
    };
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
}

export const BabonusTypes = {
  attack: AttackBabonus,
  damage: DamageBabonus,
  save: SaveBabonus,
  throw: ThrowBabonus,
  test: TestBabonus,
  hitdie: HitDieBabonus
};
