import fields from "../fields/_module.mjs";
import AuraModel from "./aura-model.mjs";
import ConsumptionModel from "./consumption-model.mjs";
import ModifiersModel from "./modifiers-model.mjs";

const {
  BooleanField, DocumentIdField, EmbeddedDataField,
  FilePathField, HTMLField, IntegerSortField,
  ObjectField, SchemaField, SetField, StringField
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
export class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    data = foundry.utils.mergeObject({
      name: options.parent?.name ?? game.i18n.localize("BABONUS.NewBabonus"),
      img: options.parent?.img ?? "icons/svg/dice-target.svg"
    }, data);
    super(data, options);
  }

  /* -------------------------------------------------- */
  /*   Properties                                       */
  /* -------------------------------------------------- */

  /** @override */
  static metadata = Object.freeze({
    label: "BABONUS.BaseBabonus",
    documentName: "babonus",
    icon: null,
    defaultImg: null
  });

  /* -------------------------------------------------- */

  /**
   * Available babonus types.
   * @type {string[]}
   */
  static TYPES = Object.freeze([
    "attack",
    "damage",
    "hitdie",
    "save",
    "test",
    "throw"
  ]);

  /* -------------------------------------------------- */

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
      const uuid = this.parent.flags.dnd5e?.origin ?? "";
      if (!uuid) return null;
      const parts = uuid.split(".");
      parts.pop(); parts.pop();
      const itemUuid = parts.join(".");
      const item = fromUuidSync(itemUuid);
      return (item instanceof Item) ? (item.parent ?? null) : null;
    }

    return null;
  }

  /* -------------------------------------------------- */

  /**
   * Variable to track whether this bonus has modified dice and was halted at the first die.
   * @type {boolean}
   */
  _halted = false;

  /* -------------------------------------------------- */

  /**
   * Whether a babonus is valid for being 'item only' in the builder. It must be embedded in an item (or an
   * effect on an item which targets the item's actor), must not be an aura or template aura, and the item
   * must be able to use activities.
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
    return item.system.schema.has("activities");
  }

  /* -------------------------------------------------- */

  /**
   * Can this bonus act as a reminder?
   * @type {boolean}
   */
  get canRemind() {
    return ["attack", "damage", "hitdie", "throw", "test"].includes(this.type) && !this.hasBonuses && this.optional;
  }

  /* -------------------------------------------------- */

  /**
   * The effect that this bonus is currently directly embedded on, if any.
   * @type {ActiveEffect5e|null}
   */
  get effect() {
    return (this.parent instanceof ActiveEffect) ? this.parent : null;
  }

  /* -------------------------------------------------- */

  /**
   * Does this babonus have an additive bonus?
   * @type {boolean}
   */
  get hasAdditiveBonus() {
    return !!this.bonuses.bonus && Roll.validate(this.bonuses.bonus);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus modify a property that isn't an additive bonus or dice modifier?
   * Such as critical thresholds or bonus critical damage.
   * @type {boolean}
   */
  get hasPropertyBonuses() {
    return false;
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus add dice modifiers?
   * @type {boolean}
   */
  get hasDiceModifiers() {
    return !!this.bonuses.modifiers?.hasModifiers;
  }

  /* -------------------------------------------------- */

  /**
   * Is this providing a bonus to parts, any properties, or dice modifiers?
   * @type {boolean}
   */
  get hasBonuses() {
    return this.hasAdditiveBonus || this.hasPropertyBonuses || this.hasDiceModifiers;
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus have a damage or healing type?
   * @type {boolean}
   */
  get hasDamageType() {
    return false;
  }

  /* -------------------------------------------------- */

  /**
   * Getter for the metadata icon for this babonus type.
   * @type {string}
   */
  get icon() {
    return this.constructor.metadata.icon;
  }

  /* -------------------------------------------------- */

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @type {boolean}
   */
  get isExclusive() {
    return this.exclusive && this.canExclude;
  }

  /* -------------------------------------------------- */

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it
   * applies to attack rolls, damage rolls, saving throws, or ability checks; any of the rolls
   * that have a roll configuration dialog.
   * @type {boolean}
   */
  get isOptionable() {
    switch (this.type) {
      case "attack":
      case "damage":
      case "hitdie":
      case "test":
      case "throw":
        return this.hasBonuses;
      case "save":
        return false;
      default:
        return false;
    }
  }

  /* -------------------------------------------------- */

  /**
   * Whether a babonus is currently optional, which is only true if it is both able to be optional, and toggled as such.
   * @type {boolean}
   */
  get isOptional() {
    return this.optional && this.isOptionable;
  }

  /* -------------------------------------------------- */

  /**
   * Is this bonus a reminder, and not an actual 'bonus'?
   * @type {boolean}
   */
  get isReminder() {
    return this.reminder && this.canRemind;
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * The item that this bonus is currently directly or indirectly embedded on, if any.
   * @type {Item5e|null}
   */
  get item() {
    if (this.parent instanceof Actor) return null;

    if (this.parent instanceof Item) return this.parent;

    if (this.parent instanceof MeasuredTemplateDocument) {
      const uuid = this.parent.flags.dnd5e?.origin ?? "";
      if (!uuid) return null;
      const parts = uuid.split(".");
      parts.pop(); parts.pop();
      const itemUuid = parts.join(".");
      const item = fromUuidSync(itemUuid);
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

  /* -------------------------------------------------- */

  /**
   * The true source of the babonus intended for the retrieval of roll data.
   * - If the babonus is embedded on a template, this returns the item that created it.
   * - If the babonus is embedded on an item or actor, this simply returns that item or actor.
   * - If the babonus is embedded on an effect, this returns the actor or item from which the effect originates.
   * @type {Actor5e|Item5e|null}
   */
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const uuid = this.parent.flags.dnd5e?.origin ?? "";
      if (!uuid) return null;
      const parts = uuid.split(".");
      parts.pop(); parts.pop();
      const itemUuid = parts.join(".");
      const item = fromUuidSync(itemUuid);
      return (item instanceof Item) ? item : null;
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

  /* -------------------------------------------------- */

  /**
   * The scene region that this bonus is currently embedded on, if any.
   * @type {SceneRegion|null}
   */
  get region() {
    return (this.parent instanceof RegionDocument) ? this.parent : null;
  }

  /* -------------------------------------------------- */

  /**
   * The sheet of the bonus.
   * @type {BabonusSheet}
   */
  get sheet() {
    const Cls = babonus.abstract.applications.BabonusSheet;
    const sheet = foundry.applications.instances.get(`${Cls.name}-${this.uuid}`);
    if (sheet) return sheet;
    return new Cls({bonus: this});
  }

  /* -------------------------------------------------- */

  /**
   * The template that this bonus is currently directly embedded on, if any.
   * @type {MeasuredTemplateDocument|null}
   */
  get template() {
    return (this.parent instanceof MeasuredTemplateDocument) ? this.parent : null;
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @type {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /* -------------------------------------------------- */
  /*   Data preparation                                 */
  /* -------------------------------------------------- */

  /** @override */
  static defineSchema() {
    const base = this._defineBaseSchema();
    base.bonuses = new SchemaField(this._defineBonusSchema());
    base.filters = new SchemaField(this._defineFilterSchema());
    return base;
  }

  /* -------------------------------------------------- */

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
      type: new StringField({required: true, initial: "base", readonly: true}),
      enabled: new BooleanField({initial: true}),
      exclusive: new BooleanField(),
      optional: new BooleanField(),
      reminder: new BooleanField(),
      description: new HTMLField(),
      consume: new EmbeddedDataField(ConsumptionModel),
      aura: new EmbeddedDataField(AuraModel),
      flags: new ObjectField()
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = ["BABONUS"];

  /* -------------------------------------------------- */

  /**
   * Define the bonuses data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineBonusSchema() {
    return {};
  }

  /* -------------------------------------------------- */

  /**
   * Define the filter data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineFilterSchema() {
    return {
      actorCreatureSizes: new fields.actorCreatureSizes(),
      actorCreatureTypes: new fields.actorCreatureTypes(),
      actorLanguages: new fields.actorLanguages(),
      arbitraryComparisons: new fields.arbitraryComparisons(),
      baseArmors: new fields.baseArmors(),
      customScripts: new fields.customScripts(),
      healthPercentages: new fields.healthPercentages(),
      markers: new fields.markers(),
      remainingSpellSlots: new fields.remainingSpellSlots(),
      statusEffects: new fields.statusEffects()
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static cleanData(source, options = {}) {
    delete options.partial?.id;
    delete options.partial?.type;
    return super.cleanData(source, options);
  }

  /* -------------------------------------------------- */

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /* -------------------------------------------------- */

  /**
   * Prepare any derived values.
   */
  prepareDerivedData() {}

  /* -------------------------------------------------- */
  /*   Migration                                        */
  /* -------------------------------------------------- */

  /** @override */
  static migrateData(source) {
    this.migrateMinimum(source);
    this.migrateDeathSaveTargetValue(source);
    this.migrateArbitraryComparisonPlural(source);
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * Migrate 'deathSaveTargetValue' to 'targetValue'.
   * @param {object} source     Candidate source data.
   */
  static migrateDeathSaveTargetValue(source) {
    const tv = source?.bonuses?.deathSaveTargetValue;
    if (tv) foundry.utils.setProperty(source, "bonuses.targetValue", tv);
  }

  /* -------------------------------------------------- */

  /**
   * Rename the 'arbitraryComparison' property to 'arbitraryComparisons'.
   * @param {object} source     Candidate source data.
   */
  static migrateArbitraryComparisonPlural(source) {
    const v = source?.filters?.arbitraryComparison;
    if (v?.length && !source.filters.arbitraryComparisons) {
      source.filters.arbitraryComparisons = v;
    }
  }

  /* -------------------------------------------------- */
  /*   Instance methods                                 */
  /* -------------------------------------------------- */

  /** @override */
  testUserPermission() {
    // Since babs are always local, all users have permission to render them.
    // Proper permissions are handled elsewhere.
    return true;
  }

  /* -------------------------------------------------- */

  /** @override */
  toDragData() {
    return {type: "Babonus", uuid: this.uuid};
  }

  /* -------------------------------------------------- */

  /**
   * Get applicable roll data from the origin.
   * @param {boolean} deterministic     Whether to force flat values for properties that could be a die term or flat term.
   * @returns {object}                  The roll data.
   */
  getRollData({deterministic = false} = {}) {
    const rollData = this.origin?.getRollData({deterministic}) ?? {};
    const level = this.template ? this.template.getFlag("dnd5e", "spellLevel") : null;
    if (level) foundry.utils.setProperty(rollData, "item.level", level);
    return rollData;
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

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
    await this.update({[`flags.${scope}.${key}`]: value});
    return this;
  }

  /* -------------------------------------------------- */

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
    await this.update({[key]: null});
    return this;
  }

  /* -------------------------------------------------- */

  /**
   * Toggle this bonus.
   * @param {boolean} [state]     A specific state to set the bonus to.
   * @returns {Promise<Babonus>}
   */
  async toggle(state = null) {
    await this.update({enabled: [true, false].includes(state) ? state : !this.enabled});
    return this;
  }

  /* -------------------------------------------------- */
  /*   Life-cycle methods                               */
  /* -------------------------------------------------- */

  /**
   * Update this bonus, propagating the data to its parent.
   * @param {object} changes        The update object.
   * @param {object} [options]      The update options.
   * @returns {Promise<Babonus>}
   */
  async update(changes, options = {}) {
    changes = foundry.utils.expandObject(changes);

    this.updateSource(changes, options);
    const collection = babonus.getCollection(this.parent);
    collection.set(this.id, this);
    await this.parent.setFlag("babonus", "bonuses", collection.map(k => k.toObject()));
    this.#updateContentLinks();
    return this;
  }

  /* -------------------------------------------------- */

  /**
   * Refresh the state of all content links.
   */
  #updateContentLinks() {
    for (const link of document.querySelectorAll(`a[data-link][data-uuid="${this.uuid}"]`)) {
      link.classList.toggle("enabled", this.enabled);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Delete this bonus.
   * @returns {Promise<Babonus>}
   */
  async delete() {
    const collection = babonus.getCollection(this.parent);
    collection.delete(this.id);
    await this.parent.setFlag("babonus", "bonuses", collection.map(k => k.toObject()));
    return this;
  }

  /* -------------------------------------------------- */

  /**
   * Present a Dialog form to confirm deletion of this bonus.
   * @param {object} [options]      Options to configure the deletetion.
   * @returns {Promise}             A Promise which resolves to the deleted bonus.
   */
  async deleteDialog(options = {}) {
    const type = game.i18n.localize(this.constructor.metadata.label);
    return foundry.applications.api.DialogV2.confirm({
      window: {
        title: `Build-a-Bonus: ${this.name}`,
        icon: "fa-solid fa-otter"
      },
      position: {
        width: 400
      },
      content: `<p>${game.i18n.localize("AreYouSure")} ${game.i18n.format("SIDEBAR.DeleteWarning", {type})}</p>`,
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
      abilities: new fields.abilities(),
      baseWeapons: new fields.baseWeapons(),
      creatureTypes: new fields.creatureTypes(),
      damageTypes: new fields.damageTypes(),
      featureTypes: new fields.featureTypes(),
      identifiers: new fields.identifiers(),
      itemTypes: new fields.itemTypes(),
      preparationModes: new fields.preparationModes(),
      sourceClasses: new fields.sourceClasses(),
      spellComponents: new fields.spellComponents(),
      spellLevels: new fields.spellLevels(),
      spellSchools: new fields.spellSchools(),
      targetArmors: new fields.targetArmors(),
      targetEffects: new fields.targetEffects(),
      tokenSizes: new fields.tokenSizes(),
      weaponProperties: new fields.weaponProperties()
    };
  }
}

class AttackBabonus extends ItemBabonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.AttackBabonus",
    icon: "fa-solid fa-location-crosshairs",
    defaultImg: "systems/dnd5e/icons/svg/trait-weapon-proficiencies.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "attack"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.ATTACK"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      criticalRange: new StringField({required: true}),
      fumbleRange: new StringField({required: true})
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      proficiencyLevels: new fields.proficiencyLevels()
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  get hasPropertyBonuses() {
    return !!this.bonuses.criticalRange || !!this.bonuses.fumbleRange;
  }
}

class DamageBabonus extends ItemBabonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.DamageBabonus",
    icon: "fa-solid fa-burst",
    defaultImg: "systems/dnd5e/icons/svg/properties/magical.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "damage"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.DAMAGE"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      damageType: new SetField(new StringField()),
      criticalBonusDice: new StringField({required: true}),
      criticalBonusDamage: new StringField({required: true}),
      modifiers: new EmbeddedDataField(ModifiersModel)
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static _defineFilterSchema() {
    const schema = super._defineFilterSchema();
    schema.attackModes = new fields.attackModes();
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static migrateData(source) {
    super.migrateData(source);
    if (!source.damageType) return;
    if (foundry.utils.getType(source.damageType) === "string") {
      source.damageType = [source.damageType];
    }
  }

  /* -------------------------------------------------- */

  /** @override */
  get hasDamageType() {
    const types = this.bonuses.damageType;
    return types.some(type => (type in CONFIG.DND5E.damageTypes) || (type in CONFIG.DND5E.healingTypes));
  }

  /* -------------------------------------------------- */

  /** @override */
  get hasPropertyBonuses() {
    return !!this.bonuses.criticalBonusDice || !!this.bonuses.criticalBonusDamage;
  }
}

class SaveBabonus extends ItemBabonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.SaveBabonus",
    icon: "fa-solid fa-hand-sparkles",
    defaultImg: "systems/dnd5e/icons/svg/trait-damage-resistances.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "save"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.SAVE"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true})
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      saveAbilities: new fields.saveAbilities()
    };
  }
}

class ThrowBabonus extends Babonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.ThrowBabonus",
    icon: "fa-solid fa-person-falling-burst",
    defaultImg: "systems/dnd5e/icons/svg/trait-saves.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "throw"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.THROW"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      targetValue: new StringField({required: true}),
      deathSaveCritical: new StringField({required: true})
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      creatureTypes: new fields.creatureTypes(),
      proficiencyLevels: new fields.proficiencyLevels(),
      targetEffects: new fields.targetEffects(),
      throwTypes: new fields.throwTypes()
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  get hasPropertyBonuses() {
    return !!this.bonuses.targetValue || !!this.bonuses.deathSaveCritical;
  }
}

class TestBabonus extends Babonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.TestBabonus",
    icon: "fa-solid fa-bolt",
    defaultImg: "systems/dnd5e/icons/svg/trait-skills.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "test"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.TEST"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true})
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new fields.abilities(),
      baseTools: new fields.baseTools(),
      proficiencyLevels: new fields.proficiencyLevels(),
      skillIds: new fields.skillIds()
    };
  }
}

class HitDieBabonus extends Babonus {
  /** @override */
  static metadata = Object.freeze(foundry.utils.mergeObject(super.metadata, {
    label: "BABONUS.HitdieBabonus",
    icon: "fa-solid fa-heart-pulse",
    defaultImg: "systems/dnd5e/icons/svg/hit-points.svg"
  }, {inplace: false}));

  /* -------------------------------------------------- */

  /** @override */
  static _defineBaseSchema() {
    const schema = super._defineBaseSchema();
    schema.type = new StringField({
      required: true,
      readonly: true,
      initial: "hitdie"
    });
    return schema;
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    "BABONUS.HITDIE"
  ];

  /* -------------------------------------------------- */

  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new StringField({required: true}),
      modifiers: new EmbeddedDataField(ModifiersModel)
    };
  }
}

export default {
  attack: AttackBabonus,
  damage: DamageBabonus,
  hitdie: HitDieBabonus,
  save: SaveBabonus,
  test: TestBabonus,
  throw: ThrowBabonus
};
