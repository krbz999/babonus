import {MODULE} from "../constants.mjs";

const {BooleanField, StringField, SchemaField, NumberField} = foundry.data.fields;

export default class ConsumptionModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      enabled: new BooleanField(),
      type: new StringField({
        required: true,
        initial: "",
        blank: true,
        choices: MODULE.CONSUMPTION_TYPES
      }),
      subtype: new StringField({
        required: true,
        blank: true,
        initial: ""
      }),
      scales: new BooleanField(),
      formula: new StringField({required: true}),
      value: new SchemaField({
        min: new StringField({required: true}),
        max: new StringField({required: true}),
        step: new NumberField({integer: true, min: 1, step: 1})
      })
    };
  }

  /* -------------------------------------------------- */
  /*   Data preparation                                 */
  /* -------------------------------------------------- */

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /* -------------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const rollData = this.getRollData();
    this.value.min = this.value.min ? dnd5e.utils.simplifyBonus(this.value.min, rollData) : 1;
    this.value.max = this.value.max ? dnd5e.utils.simplifyBonus(this.value.max, rollData) : null;
    if ((this.value.min > this.value.max) && (this.value.max !== null)) {
      const m = this.value.min;
      this.value.min = this.value.max;
      this.value.max = m;
    }
  }

  /* -------------------------------------------------- */
  /*   Migrations                                       */
  /* -------------------------------------------------- */

  /** @override */
  static migrateData(source) {
    // Resource as a consumption type is deprecated fully and without replacement.
    if (source.type === "resource") source.type = "";
  }

  /* -------------------------------------------------- */
  /*   Properties                                       */
  /* -------------------------------------------------- */

  /**
   * The babonus this lives on.
   * @type {Babonus}
   */
  get bonus() {
    return this.parent;
  }

  /* -------------------------------------------------- */

  /**
   * Whether the set up in consumption can be used to create something that consumes.
   * This looks only at the consumption data and not at anything else about the babonus.
   * @type {boolean}
   */
  get isValidConsumption() {
    const {type, value} = this;
    if (!(type in MODULE.CONSUMPTION_TYPES) || ["save", "hitdie"].includes(this.parent.type)) return false;
    const invalidScale = this.scales && ((this.value.max ?? Infinity) < this.value.min);

    switch (type) {
      case "uses":
        if (!(this.bonus.parent instanceof Item) || invalidScale) return false;
        return this.bonus.parent.hasLimitedUses && (value.min > 0);
      case "quantity":
        if (!(this.bonus.parent instanceof Item) || invalidScale) return false;
        return this.bonus.parent.system.schema.has("quantity") && (value.min > 0);
      case "effect":
        return this.bonus.parent instanceof ActiveEffect;
      case "health":
      case "slots":
        if (invalidScale) return false;
        return value.min > 0;
      case "currency":
        if (invalidScale) return false;
        return Object.keys(CONFIG.DND5E.currencies).includes(this.subtype) && (value.min > 0);
      case "inspiration":
        return true;
      case "hitdice":
        if (invalidScale) return false;
        return ["smallest", "largest"].concat(CONFIG.DND5E.hitDieTypes).includes(this.subtype) && (value.min > 0);
      default:
        return false;
    }
  }

  /* -------------------------------------------------- */
  /*   Instance methods                                 */
  /* -------------------------------------------------- */

  /**
   * Is the actor or user able to make the change when performing the consumption?
   * This checks for permission issues only as well as properties being existing on the actor.
   * It does not check for correct setup of the consumption data on the bonus.
   * This can be used to determine whether a bonus should appear in the Optional Selector, but
   * NOT due to lack of resources.
   * @param {Actor5e} actor     The actor performing the roll.
   * @returns {boolean}
   */
  canActorConsume(actor) {
    if (!this.isValidConsumption) return false;

    switch (this.type) {
      case "uses":
      case "quantity":
      case "effect":
        return this.bonus.parent.isOwner;
      case "slots":
        return !!actor.system.spells && actor.isOwner;
      case "health":
        return !!actor.system.attributes?.hp && actor.isOwner;
      case "currency":
        return !!actor.system.currency && actor.isOwner;
      case "inspiration":
      case "hitdice":
        return (actor.type === "character") && actor.isOwner;
      default:
        return false;
    }
  }

  /* -------------------------------------------------- */

  /**
   * Whether there are enough remaining of the target to be consumed.
   * @param {Actor5e|Item5e|ActiveEffect5e} document      The target of consumption.
   * @param {number} [min]                                A different minimum value to test against.
   * @returns {boolean}
   */
  canBeConsumed(document, min) {
    if (!this.isValidConsumption) return false;

    min ??= this.value.min;
    const {hd, hp} = document.system?.attributes ?? {};

    switch (this.type) {
      case "uses":
        return document.system.uses.value >= min;
      case "quantity":
        return document.system.quantity >= min;
      case "effect":
        return document.parent.effects.has(document.id);
      case "slots":
        return Object.values(document.system.spells).some(s => s.value && s.max && s.level && (s.level >= min));
      case "health":
        return (hp.value + hp.temp) >= min;
      case "currency":
        return document.system.currency[this.subtype] >= min;
      case "inspiration":
        return document.system.attributes.inspiration;
      case "hitdice":
        return (["smallest", "largest"].includes(this.subtype) ? hd.value : hd.bySize[this.subtype] ?? 0) >= min;
      default:
        return false;
    }
  }

  /* -------------------------------------------------- */

  /**
   * Get applicable roll data from the origin.
   * @returns {object}      The roll data.
   */
  getRollData() {
    return this.bonus.getRollData({deterministic: true});
  }
}
