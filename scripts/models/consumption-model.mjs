import {MODULE} from "../constants.mjs";

const {BooleanField, StringField, SchemaField, NumberField} = foundry.data.fields;

export class ConsumptionModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      enabled: new BooleanField({
        label: "BABONUS.Fields.Consume.Enabled.Label",
        hint: "BABONUS.Fields.Consume.Enabled.Hint"
      }),
      type: new StringField({
        required: true,
        initial: "",
        blank: true,
        label: "BABONUS.Fields.Consume.Type.Label",
        choices: {
          currency: "DND5E.Currency",
          effect: "BABONUS.Fields.Consume.Type.OptionEffect",
          health: "DND5E.HitPoints",
          hitdice: "DND5E.HitDice",
          inspiration: "DND5E.Inspiration",
          quantity: "DND5E.Quantity",
          slots: "BABONUS.Fields.Consume.Type.OptionSlots",
          uses: "DND5E.LimitedUses"
        }
      }),
      subtype: new StringField({
        required: true,
        blank: true,
        initial: "",
        label: "BABONUS.ConfigurationConsumptionSubtype",
        hint: ""
      }),
      scales: new BooleanField({
        label: "BABONUS.Fields.Consume.Scales.Label",
        hint: "BABONUS.Fields.Consume.Scales.Hint"
      }),
      formula: new StringField({
        required: true,
        label: "BABONUS.Fields.Consume.Formula.Label",
        hint: "BABONUS.Fields.Consume.Formula.Hint"
      }),
      value: new SchemaField({
        min: new StringField({required: true}),
        max: new StringField({required: true}),
        step: new NumberField({
          integer: true,
          min: 1,
          step: 1,
          label: "BABONUS.Fields.Consume.ValueStep.Label",
          hint: "BABONUS.Fields.Consume.ValueStep.Hint"
        })
      })
    };
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  static migrateData(source) {
    // Resource as a consumption type is deprecated fully and without replacement.
    if (source.type === "resource") source.type = "";
  }

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
   * Whether the set up in consumption can be used to create something that consumes.
   * This looks only at the consumption data and not at anything else about the babonus.
   * @type {boolean}
   */
  get isValidConsumption() {
    const {type, value} = this;
    if (!MODULE.CONSUMPTION_TYPES.has(type) || ["save", "hitdie"].includes(this.parent.type)) return false;
    const invalidScale = this.scales && ((this.value.max ?? Infinity) < this.value.min);

    switch (type) {
      case "uses": {
        // The bonus must be on an item that you own, and with limited uses.
        const item = this.bonus.parent;
        if (!(item instanceof Item)) return false;
        let hasUses = item.hasLimitedUses;
        if (item.type === "feat") {
          hasUses = hasUses && (!!item.system.uses.per) && (item.system.uses.max > 0);
        }
        return !invalidScale && hasUses && (value.min > 0);
      }
      case "quantity": {
        const item = this.bonus.parent;
        if (!(item instanceof Item)) return false;
        if (this.scales && (this.value.max < this.value.min)) return false;
        const hasQuantity = "quantity" in item.system;
        return !invalidScale && hasQuantity && (value.min > 0);
      }
      case "slots": {
        if (this.scales && (this.value.max < this.value.min)) return false;
        return !invalidScale && (value.min > 0);
      }
      case "effect": {
        return this.bonus.parent instanceof ActiveEffect;
      }
      case "health": {
        if (this.scales && (this.value.max < this.value.min)) return false;
        return !invalidScale && (value.min > 0);
      }
      case "currency": {
        if (this.scales && (this.value.max < this.value.min)) return false;
        const subtypes = new Set(Object.keys(CONFIG.DND5E.currencies));
        return !invalidScale && subtypes.has(this.subtype) && (value.min > 0);
      }
      case "inspiration": {
        return true;
      }
      case "hitdice": {
        if (this.scales && (this.value.max < this.value.min)) return false;
        const subtypes = new Set(["smallest", "largest"].concat(CONFIG.DND5E.hitDieTypes));
        return !invalidScale && subtypes.has(this.subtype) && (value.min > 0);
      }
      default: return false;
    }
  }

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
      case "effect": return this.bonus.parent.isOwner;
      case "slots": return !!actor.system.spells && actor.isOwner;
      case "health": return !!actor.system.attributes?.hp && actor.isOwner;
      case "currency": return !!actor.system.currency && actor.isOwner;
      case "inspiration":
      case "hitdice": return (actor.type === "character") && actor.isOwner;
      default: return false;
    }
  }

  /**
   * Whether there are enough remaining of the target to be consumed.
   * @param {Actor5e|Item5e|ActiveEffect5e} document      The target of consumption.
   * @param {number} [min]                                A different minimum value to test against.
   * @returns {boolean}
   */
  canBeConsumed(document, min) {
    if (!this.isValidConsumption) return false;

    min ??= this.value.min;

    switch (this.type) {
      case "uses": return document.system.uses.value >= min;
      case "quantity": return document.system.quantity >= min;
      case "effect": return document.parent.effects.has(document.id);
      case "slots": return Object.values(document.system.spells).some(({value, max, level}) => {
        return value && max && level && (level >= min);
      });
      case "health": {
        const hp = document.system.attributes.hp;
        return (hp.value + hp.temp) >= min;
      }
      case "currency": return document.system.currency[this.subtype] >= min;
      case "inspiration": return document.system.attributes.inspiration;
      case "hitdice": {
        const hd = document.system.attributes.hd;
        const value = ["smallest", "largest"].includes(this.subtype) ? hd.value : hd.bySize[this.subtype] ?? 0;
        return value >= min;
      }
      default: return false;
    }
  }
}
