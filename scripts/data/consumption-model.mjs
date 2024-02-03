export class ConsumptionModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      enabled: new foundry.data.fields.BooleanField(),
      type: new foundry.data.fields.StringField({required: true}),
      subtype: new foundry.data.fields.StringField({required: true}),
      scales: new foundry.data.fields.BooleanField(),
      formula: new foundry.data.fields.StringField({required: true}),
      value: new foundry.data.fields.SchemaField({
        min: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
        max: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
        step: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1})
      })
    };
  }

  /**
   * The select options for what this bonus can consume.
   * @type {object}
   */
  get OPTIONS() {
    const options = {};
    options.uses = "DND5E.LimitedUses";
    options.quantity = "DND5E.Quantity";
    options.slots = "BABONUS.ConsumptionTypeSlots";
    options.effect = "BABONUS.ConsumptionTypeEffect";
    options.health = "BABONUS.ConsumptionTypeHealth";
    options.currency = "BABONUS.ConsumptionTypeCurrency";
    options.inspiration = "BABONUS.ConsumptionTypeInspiration";
    options.resource = "BABONUS.ConsumptionTypeResource";
    return options;
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  static migrateData(source) {}

  /** @override */
  prepareDerivedData() {}

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
   * - For inspiration, the roller must be a 'character' type actor, which is validated elsewhere.
   * - For resources, the roller must be a 'character' type actor, which is validated elsewhere.
   * @type {boolean}
   */
  get isConsuming() {
    if (!this.enabled || !this.bonus.isOptional || !this.type) return false;

    const type = this.type;
    const min = Number.isNumeric(this.value.min) ? this.value.min : 1;
    const parent = this.bonus.parent;
    const isItemOwner = (parent instanceof Item) && parent.isOwner;
    const actor = this.bonus.actor;

    if (type === "uses") return isItemOwner && parent.hasLimitedUses && (min > 0);
    else if (type === "quantity") return isItemOwner && Number.isNumeric(parent.system.quantity) && (min > 0);
    else if (type === "slots") return min > 0;
    else if (type === "effect") return (parent instanceof ActiveEffect) && parent.isOwner;
    else if (type === "health") return min > 0;
    else if (type === "currency") return (this.subtype in CONFIG.DND5E.currencies) && (min > 0);
    else if (type === "inspiration") return (actor instanceof Actor) && (actor.type === "character");
    else if (type === "resource") return (actor instanceof Actor) && (actor.type === "character");
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
