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
    if (this.canConsumeUses) options.uses = "DND5E.LimitedUses";
    if (this.canConsumeQuantity) options.quantity = "DND5E.Quantity";
    if (this.canConsumeSlots) options.slots = "BABONUS.ConsumptionTypeSlots";
    if (this.canConsumeEffect) options.effect = "BABONUS.ConsumptionTypeEffect";
    if (this.canConsumeHealth) options.health = "BABONUS.ConsumptionTypeHealth";
    if (this.canConsumeCurrency) options.currency = "BABONUS.ConsumptionTypeCurrency";
    if (this.canConsumeInspiration) options.inspiration = "BABONUS.ConsumptionTypeInspiration";
    if (this.canConsumeResource) options.resource = "BABONUS.ConsumptionTypeResource";
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
   * Whether the babonus can open the Consumption app in the builder, which
   * requires that it is Optional and has at least one option in the 'type' available.
   * @type {boolean}
   */
  get canConsume() {
    if (!this.bonus.isOptional) return false;
    return !foundry.utils.isEmpty(this.OPTIONS);
  }

  /**
   * Whether 'Limited Uses' should be a valid option in the Consumption app.
   * The babonus must be embedded on an item that has limited uses.
   * @type {boolean}
   */
  get canConsumeUses() {
    const item = this.bonus.parent;
    return (item instanceof Item) && item.hasLimitedUses;
  }

  /**
   * Whether 'Quantity' should be a valid option in the Consumption app.
   * The babonus must be embedded on an item that has a quantity.
   * @type {boolean}
   */
  get canConsumeQuantity() {
    const item = this.bonus.parent;
    return (item instanceof Item) && Number.isNumeric(item.system.quantity);
  }

  /**
   * Whether 'Spell Slots' should be a valid option in the Consumption app. Since this works
   * fine as an aura, there are no restrictions to apply here, and it always returns true.
   * @type {boolean}
   */
  get canConsumeSlots() {
    return true;
  }

  /**
   * Whether 'Hit Points' should be a valid option in the Consumption app. Since this works
   * fine as an aura, there are no restrictions to apply here, and it always returns true.
   * @type {boolean}
   */
  get canConsumeHealth() {
    return true;
  }

  /**
   * Whether 'Effect' should be a valid option in the Consumption app.
   * The babonus must be embedded on an effect.
   * @type {boolean}
   */
  get canConsumeEffect() {
    return this.bonus.parent instanceof ActiveEffect;
  }

  /**
   * Whether 'Currency' should be a valid option in the Consumption app.
   * @type {boolean}
   */
  get canConsumeCurrency() {
    return true;
  }

  /**
   * Whether 'Inspiration' should be a valid option for consumption.
   * @type {boolean}
   */
  get canConsumeInspiration() {
    const actor = this.bonus.actor;
    return (actor instanceof Actor) && (actor.type === "character");
  }

  /**
   * Whether 'Resource' should be a valid option for consumption.
   * @type {boolean}
   */
  get canConsumeResource() {
    const actor = this.bonus.actor;
    return (actor instanceof Actor) && (actor.type === "character");
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
    if (!this.enabled || !this.canConsume || !this.type) return false;

    const type = this.type;
    const min = Number.isNumeric(this.value.min) ? this.value.min : 1;
    const isItemOwner = (this.bonus.parent instanceof Item) && this.bonus.parent.isOwner;
    const isEffectOwner = (this.bonus.parent instanceof ActiveEffect) && this.bonus.parent.isOwner;

    if (type === "uses") return this.canConsumeUses && isItemOwner && (min > 0);
    else if (type === "quantity") return this.canConsumeQuantity && isItemOwner && (min > 0);
    else if (type === "slots") return this.canConsumeSlots && (min > 0);
    else if (type === "effect") return this.canConsumeEffect && isEffectOwner;
    else if (type === "health") return this.canConsumeHealth && (min > 0);
    else if (type === "currency") return (this.subtype in CONFIG.DND5E.currencies) && (min > 0);
    else if (type === "inspiration") return this.canConsumeInspiration;
    else if (type === "resource") return this.canConsumeResource;
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
