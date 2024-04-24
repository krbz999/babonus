const {BooleanField, StringField, SchemaField, NumberField} = foundry.data.fields;

export class ConsumptionModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      enabled: new BooleanField(),
      type: new StringField({required: true}),
      subtype: new StringField({required: true}),
      scales: new BooleanField(),
      formula: new StringField({required: true}),
      value: new SchemaField({
        min: new StringField({required: true}),
        max: new StringField({required: true}),
        step: new NumberField({integer: true, min: 1, step: 1})
      })
    };
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  static migrateData(source) {}

  /** @override */
  prepareDerivedData() {
    const rollData = this.getRollData();
    this.value.min = this.value.min ? dnd5e.utils.simplifyBonus(this.value.min, rollData) : null;
    this.value.max = this.value.max ? dnd5e.utils.simplifyBonus(this.value.max, rollData) : null;
    if ((this.value.min > this.value.max) && (this.value.max !== null)) {
      const m = this.value.min;
      this.value.min = this.value.max;
      this.value.max = m;
    }
  }

  /**
   * Get applicable roll data from the origin.
   * @returns {object}      The roll data.
   */
  getRollData() {
    return this.bonus.getRollData({deterministic: true});
  }

  /* ----------------------------- */
  /* Getters                       */
  /* ----------------------------- */

  /**
   * The babonus this lives on.
   * @type {Babonus}
   */
  get bonus() {
    return this.parent;
  }

  /**
   * Whether the consumption data on the babonus creates valid consumption
   * for the optional bonus application when rolling. If it does not, the
   * babonus is ignored there.
   *
   * - For limited uses, only users who own the item in question are allowed to
   *   edit it by subtracting uses, and the minimum required value must be a positive integer.
   * - For quantity, only users who own the item in question are allowed to edit
   *   it by subtracting quantities, and the minimum required value must be a positive integer.
   * - For spell slots, the minimum required spell slot level must be a positive integer.
   * - For effects, only users who own the effect in question are allowed to delete it.
   * - For health, the minimum required amount of hit points must be a positive integer.
   * - For currencies, a valid denomination must be set, and the minimum consumed must be a positive integer.
   * - For inspiration, the roller must be a 'character' type actor.
   * - For resources, the roller must be a 'character' type actor, and the subtype must be valid.
   * @type {boolean}
   */
  get isConsuming() {
    if (!this.enabled || !this.bonus.isOptional || !this.type) return false;

    const type = this.type;
    const min = Number.isNumeric(this.value.min) ? this.value.min : 1;
    const parent = this.bonus.parent;
    const isItemOwner = (parent instanceof Item) && parent.isOwner;
    const actor = this.bonus.actor;
    const isCharacter = (actor instanceof Actor) && (actor.type === "character");

    if (type === "uses") return isItemOwner && parent.hasLimitedUses && (min > 0);
    else if (type === "quantity") return isItemOwner && Number.isNumeric(parent.system.quantity) && (min > 0);
    else if (type === "slots") return min > 0;
    else if (type === "effect") return (parent instanceof ActiveEffect) && parent.isOwner;
    else if (type === "health") return min > 0;
    else if (type === "currency") return (this.subtype in CONFIG.DND5E.currencies) && (min > 0);
    else if (type === "inspiration") return isCharacter;
    else if (type === "resource") {
      return isCharacter && (["primary", "secondary", "tertiary"].includes(this.subtype)) && (min > 0);
    }

    return false;
  }

  /**
   * Whether the bonus is scaling when consuming, which requires that it is consuming, has 'scales' set to true, and
   * does not consume an effect or inspiration, which cannot scale. If the type is 'health', 'currency', or 'resource',
   * then 'step' must be 1 or greater. Otherwise the 'max', if set, must be strictly greater than 'min'.
   * @type {boolean}
   */
  get isScaling() {
    if (!this.scales || !this.isConsuming) return false;
    if (["effect", "inspiration"].includes(this.type)) return false;
    else if ((this.type === "health") && !(this.value.step > 0)) return false;
    else if ((this.type === "currency") && !(this.value.step > 0)) return false;
    else if ((this.type === "resource") && !(this.value.step > 0)) return false;
    return (this.value.max || Infinity) > this.value.min;
  }
}
