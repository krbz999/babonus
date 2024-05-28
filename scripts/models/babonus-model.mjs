const {
  DocumentIdField, IntegerSortField, StringField, FilePathField,
  BooleanField, EmbeddedDataField, ObjectField, SchemaField, HTMLField
} = foundry.data.fields;

/**
 * Configuration for how a bonus consumes a property.
 *
 * @typedef {object} ConsumptionModel
 * @property {boolean} enabled        Whether the bonus consumes a property.
 * @property {boolean} scales         Whether the bonus scales with its consumed property.
 * @property {string} type            The type of the consumed property.
 * @property {object} value
 * @property {string} value.min       The minimum amount the bonus consumes.
 * @property {string} value.max       The maximum amount the bonus consumes.
 * @property {number} value.step      The interval size between the min and max.
 * @property {string} formula         The formula used to scale up the bonus.
 */

/**
 * Configuration for the aura properties of a bonus.
 *
 * @typedef {object} AuraModel
 * @property {boolean} enabled            Whether the bonus is an aura.
 * @property {boolean} template           Whether the bonus is an aura on a template.
 * @property {string} range               The range of the aura.
 * @property {boolean} self               Whether the aura can also affect its owner.
 * @property {number} disposition         The type of actors, by token disposition, to affect with the aura.
 * @property {Set<string>} blockers       Statuses that disable this aura when its owner is affected.
 * @property {object} require
 * @property {boolean} require.move       Whether the aura requires a direct, unobstructed path of movement.
 * @property {boolean} require.sight      Whether the aura requires a direct line of sight.
 */

/**
 * Configuration for the changes a bonus provides.
 *
 * @typedef {object} BonusConfiguration
 * @property {string} bonus                     Bonus to the roll that is added on top.
 * @property {string} criticalBonusDice         Amount of dice to increase the damage by on critical hits.
 * @property {string} criticalBonusDamage       Bonus to a damage roll that is added on top only on critical hits.
 * @property {string} targetValue               Modification to the target value a saving throw must meet to be
 *                                              considered a success.
 * @property {string} deathSaveCritical         Modification to the threshold at which a death saving throw is
 *                                              considered a critical success.
 * @property {string} criticalRange             Modification to the threshold at which an attack roll is considered
 *                                              a critical hit.
 * @property {string} fumbleRange               Modification to the threshold at which an attack roll is considered
 *                                              an automatic failure.
 * @property {ModifiersModel} modifiers
 */

/**
 * Configuration for dice modifier bonuses.
 *
 * @typedef {object} ModifiersModel
 * @property {object} config                Additional configurations.
 * @property {boolean} config.first         Whether modifiers affect only the first die encountered.
 * @property {object} amount
 * @property {boolean} amount.enabled       Whether this modifier is enabled.
 * @property {string} amount.value          The amount to upscale a die's number by.
 * @property {object} size
 * @property {boolean} size.enabled         Whether this modifier is enabled.
 * @property {string} size.value            The amount to upscale a die's faces by.
 * @property {object} reroll
 * @property {boolean} reroll.enabled       Whether this modifier is enabled.
 * @property {string} reroll.value          The threshold for rerolling a die.
 * @property {boolean} reroll.invert        Whether the threshold is inverted.
 * @property {boolean} reroll.recursive     Whether to reroll recursively.
 * @property {string} reroll.limit          The maximum number of times a die can reroll.
 * @property {object} explode
 * @property {boolean} explode.enabled      Whether this modifier is enabled.
 * @property {string} explode.value         The threshold for exploding a die.
 * @property {boolean} explode.once         Whether a die can explode at most once.
 * @property {string} explode.limit         The maximum number of times a die can explode.
 * @property {object} minimum
 * @property {boolean} minimum.enabled      Whether this modifier is enabled.
 * @property {string} minimum.value         The minimum value a die can roll.
 * @property {boolean} minimum.maximize     Whether to simply maximize dice.
 * @property {object} maximum
 * @property {boolean} maximum.enabled      Whether this modifier is enabled.
 * @property {string} maximum.value         The maximum value a die can roll.
 * @property {boolean} maximum.zero         Whether the maximum can be zero, else at least 1.
 */

/**
 * Data model of a generic Babonus. This includes all properties; depending on the type, some will not exist.
 *
 * @property {string} name                    The name of the bonus.
 * @property {string} id                      The id of the bonus.
 * @property {string} type                    The type of the bonus.
 * @property {boolean} enabled                Whether the bonus is currently active.
 * @property {string} description             The description of the bonus.
 * @property {boolean} optional               Whether the additive bonus is opted into in the roll config.
 * @property {boolean} reminder               Is this optional bonus just a reminder?
 * @property {boolean} exclusive              Whether the bonus is applying only to its parent item,
 *                                            or its parent effect's parent item.
 * @property {object} filters                 Schema of valid filter types.
 * @property {ConsumptionModel} consume
 * @property {AuraModel} aura
 * @property {BonusConfiguration} bonuses
 *
 */
class Babonus extends foundry.abstract.DataModel {
  /**
   * Variable to track whether this bonus has modified dice and was halted at the first die.
   * @type {boolean}
   */
  _halted = false;

  constructor(data, options = {}) {
    data = foundry.utils.mergeObject({
      name: options.parent?.name ?? game.i18n.localize("BABONUS.NewBabonus"),
      img: options.parent?.img ?? "icons/svg/dice-target.svg"
    }, data);
    super(data, options);
  }

  /** @override */
  static get metadata() {
    return {label: game.i18n.localize("BABONUS.Babonus")};
  }

  /**
   * An object of applications that re-render when this bonus is updated.
   * @type {object}
   */
  get apps() {
    return this._apps ??= {};
  }

  /**
   * The sheet of the bonus.
   * @type {BabonusSheet}
   */
  get sheet() {
    if (this._sheet) return this._sheet;
    return this._sheet = new babonus.abstract.applications.BabonusSheet(this);
  }

  /** @override */
  testUserPermission() {
    // Since babs are always local, all users have permission to render them.
    // Proper permissions are handled elsewhere.
    return true;
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  toDragData() {
    return {type: "Babonus", uuid: this.uuid};
  }

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @type {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /**
   * The FA icon unique to this babonus type. Must be subclassed.
   * @type {string}
   */
  static get icon() {
    return null;
  }
  get icon() {
    return this.constructor.icon;
  }

  /**
   * The default image to use for this babonus type. Must be subclassed.
   * @type {string}
   */
  static get defaultImg() {
    return null;
  }

  /**
   * Get the type of a babonus.
   * @type {string}
   */
  static get type() {
    return null;
  }

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it applies to attack rolls, damage
   * rolls, saving throws, or ability checks; any of the rolls that have a roll configuration dialog. The babonus must also
   * apply an additive bonus on top, i.e., something that can normally go in the 'Situational Bonus' input.
   * @TODO once hit die rolls have a dialog as well, this should be amended.
   * @TODO once rolls can be "remade" in 3.3.0, optional bonuses should be able to apply to other properties as well.
   * @type {boolean}
   */
  get isOptionable() {
    return ["attack", "damage", "throw", "test"].includes(this.type) && !!this.bonuses.bonus;
  }

  /**
   * Whether a babonus is currently optional, which is only true if it is both able to be optional, and toggled as such.
   * @type {boolean}
   */
  get isOptional() {
    return this.optional && this.isOptionable;
  }

  /**
   * Can this bonus act as a reminder?
   * @type {boolean}
   */
  get canRemind() {
    const valid = ["attack", "damage", "throw", "test"].includes(this.type) && !this.hasBonuses;
    return valid && this.optional && !this.bonuses.modifiers?.hasModifiers;
  }

  /**
   * Is this bonus a reminder, and not an actual 'bonus'?
   * @type {boolean}
   */
  get isReminder() {
    return this.reminder && this.canRemind;
  }

  /**
   * Is this providing a bonus to any properties, or dice modifiers?
   * @type {boolean}
   */
  get hasBonuses() {
    for (const [k, v] of Object.entries(this.bonuses)) {
      if (k === "modifiers") continue;
      if (v) return true;
    }
    return !!this.bonuses.modifiers?.hasModifiers;
  }

  /**
   * Whether a babonus is valid for being 'item only' in the builder. It must be embedded in an item (or an
   * effect on an item which targets the item's actor), must not be an aura or template aura, and must either
   * apply to attack rolls, damage rolls, or save DCs while the parent item can make use of one of those, or
   * it must apply to ability checks while being embedded on a tool-type item.
   * @type {boolean}
   */
  get canExclude() {
    let item;
    if (this.parent instanceof Item) item = this.parent;
    else if (this.parent instanceof ActiveEffect) {
      if (!(this.parent.target instanceof Actor) || !(this.parent.parent instanceof Item)) return false;
      item = this.parent.parent;
    }
    if (!item) return false;

    // Valid for attack/damage/save:
    const model = dnd5e.dataModels.item.config[item.type];
    const validityA = ["attack", "damage", "save"].includes(this.type) && !!model.schema.getField("damage.parts");

    // Valid for test:
    const validityB = (this.type === "test") && (item.type === "tool");

    return (validityA || validityB);
  }

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @type {boolean}
   */
  get isExclusive() {
    return this.exclusive && this.canExclude;
  }

  /**
   * Whether the babonus is unavailable due to its parent item being unequipped,
   * unattuned (if required), uncrewed, or its parent effect being inactive or suppressed.
   * @type {boolean}
   */
  get isSuppressed() {
    // If this bonus lives on an effect, template, or region, defer to those.
    const effect = this.effect;
    if (effect) {
      if (!effect.active) return true;
      if (effect.isAppliedEnchantment) return false;
      return !effect.modifiesActor;
    }
    const template = this.template;
    if (template) return template.hidden;
    if (this.region) return false; // a region cannot be disabled.

    const item = this.item;
    if (!item) return false;

    const actor = item.actor;
    if (!actor) return false;

    // Special case for vehicle equipment since the system does not suppress 'effects' from these.
    if (actor.type === "vehicle") {
      return ("crewed" in item.system) && !item.system.crewed;
    }

    return item.areEffectsSuppressed;
  }

  /**
   * The true source of the babonus intended for the retrieval of roll data.
   * - If the babonus is embedded on a template, this returns the item that created it.
   * - If the babonus is embedded on an item or actor, this simply returns that item or actor.
   * - If the babonus is embedded on an effect, this returns the actor or item from which the effect originates.
   * @type {Actor5e|Item5e|null}
   */
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const retrieved = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (retrieved instanceof Item) ? retrieved : null;
    }

    if (this.parent instanceof Item) return this.parent;

    if (this.parent instanceof Actor) return this.parent;

    if (this.parent instanceof ActiveEffect) {
      let origin;
      try {
        origin = fromUuidSync(this.parent.origin);
        if (!origin) return null;
      } catch (err) {
        console.warn(err);
        return null;
      }

      if (origin instanceof Item) return origin;
      if (origin instanceof Actor) return origin;
      if (origin instanceof ActiveEffect) return origin.parent;
      return null;
    }

    return null;
  }

  /**
   * The actor that this bonus is currently directly or indirectly embedded on, if any.
   * @type {Actor5e|null}
   */
  get actor() {
    if (this.parent instanceof Actor) return this.parent;

    if (this.parent instanceof Item) return this.parent.parent ?? null;

    if (this.parent instanceof ActiveEffect) {
      if (this.parent.parent instanceof Actor) return this.parent.parent;
      if (this.parent.parent instanceof Item) return this.parent.parent.parent ?? null;
    }

    if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (item instanceof Item) ? (item.parent ?? null) : null;
    }

    return null;
  }

  /**
   * Get the corresponding token of the actor that has the bonus, no matter what type of document it is embedded in.
   * Note that this is different from the 'origin' and is dependant on where the bonus currently lives.
   * @type {Token5e|null}
   */
  get token() {
    const actor = this.actor;
    if (!actor) return null;
    const token = actor.isToken ? actor.token?.object : actor.getActiveTokens()[0];
    return token ? token : null;
  }

  /**
   * The item that this bonus is currently directly or indirectly embedded on, if any.
   * @type {Item5e|null}
   */
  get item() {
    if (this.parent instanceof Actor) return null;

    if (this.parent instanceof Item) return this.parent;

    if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (item instanceof Item) ? item : null;
    }

    if (this.parent instanceof ActiveEffect) {
      let item;
      try {
        item = fromUuidSync(this.parent.origin ?? "");
      } catch (err) {
        console.warn(err);
        return null;
      }
      return (item instanceof Item) ? item : null;
    }

    return null;
  }

  /**
   * The effect that this bonus is currently directly embedded on, if any.
   * @type {ActiveEffect5e|null}
   */
  get effect() {
    return (this.parent instanceof ActiveEffect) ? this.parent : null;
  }

  /**
   * The template that this bonus is currently directly embedded on, if any.
   * @type {MeasuredTemplateDocument|null}
   */
  get template() {
    return (this.parent instanceof MeasuredTemplateDocument) ? this.parent : null;
  }

  /**
   * The scene region that this bonus is currently embedded on, if any.
   * @type {SceneRegion|null}
   */
  get region() {
    return (this.parent instanceof RegionDocument) ? this.parent : null;
  }

  /** @override */
  static defineSchema() {
    const base = this._defineBaseSchema();
    base.bonuses = new SchemaField(this._defineBonusSchema());
    base.filters = new SchemaField(this._defineFilterSchema());
    return base;
  }

  /**
   * Define the basics of the schema, properties that are not type specific.
   * @returns {object}      An object of properties.
   */
  static _defineBaseSchema() {
    return {
      id: new DocumentIdField({initial: () => foundry.utils.randomID()}),
      sort: new IntegerSortField(),
      name: new StringField({required: true, blank: false}),
      img: new FilePathField({categories: ["IMAGE"]}),
      type: new StringField({required: true, initial: this.type, choices: [this.type]}),
      enabled: new BooleanField({initial: true}),
      exclusive: new BooleanField(),
      optional: new BooleanField(),
      reminder: new BooleanField(),
      description: new HTMLField(),
      consume: new EmbeddedDataField(babonus.abstract.DataFields.models.ConsumptionModel),
      aura: new EmbeddedDataField(babonus.abstract.DataFields.models.AuraModel),
      flags: new ObjectField()
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
      arbitraryComparison: new babonus.abstract.DataFields.filters.arbitraryComparison(),
      baseArmors: new babonus.abstract.DataFields.filters.baseArmors(),
      statusEffects: new babonus.abstract.DataFields.filters.statusEffects(),
      healthPercentages: new babonus.abstract.DataFields.filters.healthPercentages(),
      customScripts: new babonus.abstract.DataFields.filters.customScripts(),
      remainingSpellSlots: new babonus.abstract.DataFields.filters.remainingSpellSlots(),
      actorCreatureTypes: new babonus.abstract.DataFields.filters.actorCreatureTypes(),
      actorCreatureSizes: new babonus.abstract.DataFields.filters.actorCreatureSizes(),
      actorLanguages: new babonus.abstract.DataFields.filters.actorLanguages()
    };
  }

  /** @override */
  static migrateData(source) {
    this.migrateMinimum(source);
    this.migrateDeathSaveTargetValue(source);
  }

  /**
   * Migrate the old version of maximizing dice.
   * @param {object} source     Candidate source data.
   */
  static migrateMinimum(source) {
    const minimum = source?.bonuses?.modifiers?.minimum;
    if (!minimum) return;
    if (!("maximize" in minimum) && (minimum.value === "-1")) {
      minimum.value = "";
      minimum.maximize = true;
    }
  }

  /**
   * Migrate 'deathSaveTargetValue' to 'targetValue'.
   * @param {object} source     Candidate source data.
   */
  static migrateDeathSaveTargetValue(source) {
    const tv = source?.bonuses?.deathSaveTargetValue;
    if (tv) foundry.utils.setProperty(source, "bonuses.targetValue", tv);
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
  prepareDerivedData() {}

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

  /* -------------------------------------------- */
  /*               Instance Methods               */
  /* -------------------------------------------- */

  /**
   * Toggle this bonus.
   * @param {boolean} [state]     A specific state to set the bonus to.
   * @returns {Promise<Babonus>}
   */
  async toggle(state = null) {
    const path = `flags.babonus.bonuses.${this.id}.enabled`;
    const c = foundry.utils.getProperty(this.parent, path);
    state = [true, false].includes(state) ? state : !c;
    await this.parent.update({[path]: state});
    this.updateSource({enabled: state});
    return this;
  }

  /**
   * Update this bonus, propagating the data to its parent.
   * @param {object} changes        The update object.
   * @param {object} [options]      The update options.
   * @returns {Promise<Babonus>}
   */
  async update(changes, options = {}) {
    const path = `flags.babonus.bonuses.${this.id}`;
    changes = foundry.utils.expandObject(changes);
    delete changes.id;
    await this.parent.update({[path]: changes}, options);
    this.updateSource(changes, options);
    return this;
  }

  /**
   * Delete this bonus.
   * @returns {Promise<Babonus>}
   */
  async delete() {
    const update = {[`flags.babonus.bonuses.-=${this.id}`]: null};
    await this.parent.update(update);
    return this;
  }

  /**
   * Present a Dialog form to confirm deletion of this bonus.
   * @param {object} [options]      Options tl configure to the dleteion
   * @returns {Promise}           A Promise which resolves to the deleted bonus.
   */
  async deleteDialog(options = {}) {
    const type = game.i18n.localize(this.constructor.metadata.label);
    return foundry.applications.api.DialogV2.confirm({
      window: {
        title: `Build-a-Bonus: ${this.name}`,
        icon: "fa-solid fa-otter"
      },
      content: `<p>${game.i18n.localize("AreYouSure")}</p><p>${game.i18n.format("SIDEBAR.DeleteWarning", {type})}</p>`,
      yes: {
        callback: () => this.delete(),
        default: true
      },
      no: {
        default: false
      },
      rejectClose: false,
      modal: true,
      ...options
    });
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new babonus.abstract.DataFields.filters.abilities(),
      attackTypes: new babonus.abstract.DataFields.filters.attackTypes(),
      baseWeapons: new babonus.abstract.DataFields.filters.baseWeapons(),
      creatureTypes: new babonus.abstract.DataFields.filters.creatureTypes(),
      damageTypes: new babonus.abstract.DataFields.filters.damageTypes(),
      featureTypes: new babonus.abstract.DataFields.filters.featureTypes(),
      itemTypes: new babonus.abstract.DataFields.filters.itemTypes(),
      preparationModes: new babonus.abstract.DataFields.filters.preparationModes(),
      spellComponents: new babonus.abstract.DataFields.filters.spellComponents(),
      spellLevels: new babonus.abstract.DataFields.filters.spellLevels(),
      spellSchools: new babonus.abstract.DataFields.filters.spellSchools(),
      targetEffects: new babonus.abstract.DataFields.filters.targetEffects(),
      tokenSizes: new babonus.abstract.DataFields.filters.tokenSizes(),
      weaponProperties: new babonus.abstract.DataFields.filters.weaponProperties()
    };
  }
}

class AttackBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      criticalRange: new StringField({required: true}),
      fumbleRange: new StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      proficiencyLevels: new babonus.abstract.DataFields.filters.proficiencyLevels()
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-weapon-proficiencies.svg";
  }
}

class DamageBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      damageType: new StringField({required: true}),
      criticalBonusDice: new StringField({required: true}),
      criticalBonusDamage: new StringField({required: true}),
      modifiers: new EmbeddedDataField(babonus.abstract.DataFields.models.ModifiersModel)
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/properties/magical.svg";
  }

  /**
   * Does this bonus have a damage or healing type?
   * @type {boolean}
   */
  get hasDamageType() {
    const type = this.bonuses.damageType;
    return (type in CONFIG.DND5E.damageTypes) || (type in CONFIG.DND5E.healingTypes);
  }
}

class SaveBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      saveAbilities: new babonus.abstract.DataFields.filters.saveAbilities()
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-damage-resistances.svg";
  }
}

class ThrowBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      targetValue: new StringField({required: true}),
      deathSaveCritical: new StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      throwTypes: new babonus.abstract.DataFields.filters.throwTypes(),
      targetEffects: new babonus.abstract.DataFields.filters.targetEffects(),
      creatureTypes: new babonus.abstract.DataFields.filters.creatureTypes(),
      proficiencyLevels: new babonus.abstract.DataFields.filters.proficiencyLevels()
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-saves.svg";
  }
}

class TestBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new babonus.abstract.DataFields.filters.abilities(),
      baseTools: new babonus.abstract.DataFields.filters.baseTools(),
      skillIds: new babonus.abstract.DataFields.filters.skillIds(),
      proficiencyLevels: new babonus.abstract.DataFields.filters.proficiencyLevels()
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-skills.svg";
  }
}

class HitDieBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      modifiers: new EmbeddedDataField(babonus.abstract.DataFields.models.ModifiersModel)
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

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/hit-points.svg";
  }
}

export default {
  attack: AttackBabonus,
  damage: DamageBabonus,
  save: SaveBabonus,
  throw: ThrowBabonus,
  test: TestBabonus,
  hitdie: HitDieBabonus
};
