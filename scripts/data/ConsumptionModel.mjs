export class ConsumptionModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      enabled: new foundry.data.fields.BooleanField({required: false, initial: true}),
      type: new foundry.data.fields.StringField(),
      scales: new foundry.data.fields.BooleanField({required: false}),
      formula: new foundry.data.fields.StringField({nullable: true, initial: null}),
      value: new foundry.data.fields.SchemaField({
        min: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
        max: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1}),
        step: new foundry.data.fields.NumberField({integer: true, min: 1, step: 1})
      })
    };
  }

  get OPTIONS() {
    const options = {};
    if (this.canConsumeUses) options.uses = "DND5E.LimitedUses";
    if (this.canConsumeQuantity) options.quantity = "DND5E.LimitedUses";
    if (this.canConsumeSlots) options.slots = "BABONUS.ConsumptionTypeSlots";
    if (this.canConsumeEffect) options.effect = "BABONUS.ConsumptionTypeEffect";
    if (this.canConsumeHealth) options.health = "BABONUS.ConsumptionTypeHealth";
    return options;
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  static migrateData(source) {
    //
  }

  /** @override */
  prepareDerivedData() {
    //
  }

  /**
   * Get applicable roll data from the origin.
   * @returns {object}      The roll data.
   */
  getRollData() {
    return this.parent.getRollData({deterministic: true});
  }

  /* ----------------------------- */
  /* Getters                       */
  /* ----------------------------- */

  /**
   * The babonus this lives on.
   * @returns {Babonus}
   */
  get bonus() {
    return this.parent;
  }

  /**
   * Whether the babonus can open the Consumption app in the builder, which
   * requires that it is Optional and has at least one option in the 'type' available.
   * @returns {boolean}
   */
  get canConsume() {
    if (!this.bonus.isOptional) return false;
    return !foundry.utils.isEmpty(this.OPTIONS);
  }

  /**
   * Whether 'Limited Uses' should be a valid option in the Consumption app.
   * The babonus must not be an aura, template aura, and must be embedded on
   * an item that has limited uses.
   * @returns {boolean}
   */
  get canConsumeUses() {
    if (this.bonus.aura.isToken || this.bonus.aura.isTemplate) return false;
    return (this.bonus.parent instanceof Item) && this.bonus.parent.hasLimitedUses;
  }

  /**
   * Whether 'Quantity' should be a valid option in the Consumption app.
   * The babonus must not be an aura, template aura, and must be embedded
   * on an item that has a quantity.
   * @returns {boolean}
   */
  get canConsumeQuantity() {
    if (this.bonus.aura.isToken || this.bonus.aura.isTemplate) return false;
    return (this.bonus.parent instanceof Item) && Number.isNumeric(this.bonus.parent.system.quantity);
  }

  /**
   * Whether 'Spell Slots' should be a valid option in the Consumption app.
   * Since this works fine as an aura, there are no restrictions to apply here,
   * and it always returns true.
   * @returns {boolean}
   */
  get canConsumeSlots() {
    return true;
  }

  /**
   * Whether 'Hit Points' should be a valid option in the Consumption app.
   * Since this works fine as an aura, there are no restrictions to apply here,
   * and it always returns true.
   * @returns {boolean}
   */
  get canConsumeHealth() {
    return true;
  }

  /**
   * Whether 'Effect' should be a valid option in the Consumption app. The babonus
   * must not be an aura, template aura, and must be embedded on an effect.
   * @returns {boolean}
   */
  get canConsumeEffect() {
    return this.bonus.parent instanceof ActiveEffect;
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
   * @returns {boolean}
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
  }

  /**
   * Whether the bonus is scaling when consuming, which requires that it is consuming,
   * has 'scales' set to true, and does not consume an effect, which cannot scale. If
   * the type is 'health', then 'step' must be 1 or greater. Otherwise the 'max', if
   * set, must be strictly greater than 'min'.
   * @returns {boolean}
   */
  get isScaling() {
    if (!this.scales || !this.isConsuming) return false;
    if (this.type === "effect") return false;
    if ((this.type === "health") && !(this.value.step > 0)) return false;
    return (this.value.max || Infinity) > this.value.min;
  }

  /* ----------------------------- */
  /* Bonus Collector methods       */
  /* ----------------------------- */

}
