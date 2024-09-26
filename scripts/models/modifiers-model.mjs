import {MODULE} from "../constants.mjs";

const {SchemaField, BooleanField, NumberField, StringField} = foundry.data.fields;

/* Child of Babonus#bonuses that holds all die modifiers. */
export default class ModifiersModel extends foundry.abstract.DataModel {
  /**
   * The modifier modes for amount and size.
   * @type {number}
   */
  static MODIFIER_MODES = Object.freeze({
    ADD: 0,
    MULTIPLY: 1
  });

  /* -------------------------------------------------- */

  /** @override */
  static defineSchema() {
    return {
      amount: new SchemaField({
        enabled: new BooleanField(),
        mode: new NumberField({initial: 0, choices: MODULE.MODIFIER_MODES}),
        value: new StringField({required: true})
      }),
      size: new SchemaField({
        enabled: new BooleanField(),
        mode: new NumberField({initial: 0, choices: MODULE.MODIFIER_MODES}),
        value: new StringField({required: true})
      }),
      reroll: new SchemaField({
        enabled: new BooleanField(),
        value: new StringField({required: true}),
        invert: new BooleanField(),
        recursive: new BooleanField(),
        limit: new StringField({required: true})
      }),
      explode: new SchemaField({
        enabled: new BooleanField(),
        value: new StringField({required: true}),
        once: new BooleanField(),
        limit: new StringField({required: true})
      }),
      minimum: new SchemaField({
        enabled: new BooleanField(),
        value: new StringField({required: true}),
        maximize: new BooleanField()
      }),
      maximum: new SchemaField({
        enabled: new BooleanField(),
        value: new StringField({required: true}),
        zero: new BooleanField()
      }),
      config: new SchemaField({
        first: new BooleanField()
      })
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  static LOCALIZATION_PREFIXES = ["BABONUS.MODIFIERS"];

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
    const rollData = this.parent.getRollData({deterministic: true});
    for (const m of ["amount", "size", "reroll", "explode", "minimum", "maximum"]) {
      const value = this[m].value;
      if (!value) this[m].value = null;
      else {
        const bonus = dnd5e.utils.simplifyBonus(value, rollData);
        this[m].value = Number.isNumeric(bonus) ? Math.round(bonus) : null;
      }

      if (!("limit" in this[m])) continue;

      const limit = this[m].limit;
      if (!limit) this[m].limit = null;
      else {
        const bonus = Math.round(dnd5e.utils.simplifyBonus(limit, rollData));
        this[m].limit = (Number.isNumeric(bonus) && (bonus > 0)) ? bonus : null;
      }
    }
  }

  /* -------------------------------------------------- */
  /*   Dice modifications                               */
  /* -------------------------------------------------- */

  /**
   * Regex to determine whether a die already has a modifier.
   */
  static REGEX = Object.freeze({
    reroll: /rr?([0-9]+)?([<>=]+)?([0-9]+)?/i,
    explode: /xo?([0-9]+)?([<>=]+)?([0-9]+)?/i,
    minimum: /(?:min)([0-9]+)/i,
    maximum: /(?:max)([0-9]+)/i
  });

  /* -------------------------------------------------- */

  /**
   * Append applicable modifiers to a die.
   * @param {DieTerm} die           The die term that will be mutated.
   * @param {object} [options]      Options object meant to specifically bypass certain modifications.
   */
  modifyDie(die, options = {}) {
    if (options.amount !== false) this._modifyAmount(die);
    if (options.size !== false) this._modifySize(die);
    if (options.reroll !== false) this._modifyReroll(die);
    if (options.explode !== false) this._modifyExplode(die);
    if (options.minimum !== false) this._modifyMin(die);
    if (options.maximum !== false) this._modifyMax(die);
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable amount modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifyAmount(die) {
    if (!this.hasAmount) return;
    const isMult = this.amount.mode === ModifiersModel.MODIFIER_MODES.MULTIPLY;

    if ((die._number instanceof Roll) && die._number.isDeterministic) {
      const total = die._number.evaluateSync().total;
      die._number = total;
    }

    if (Number.isInteger(die._number)) {
      if (isMult) die._number = Math.max(0, die._number * this.amount.value);
      else die._number = Math.max(0, die._number + this.amount.value);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable size modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifySize(die) {
    if (!this.hasSize) return;
    const isMult = this.size.mode === ModifiersModel.MODIFIER_MODES.MULTIPLY;

    if ((die._faces instanceof Roll) && die._faces.isDeterministic) {
      const total = die._faces.evaluateSync().total;
      die._faces = total;
    }

    if (Number.isInteger(die._faces)) {
      if (isMult) die._faces = Math.max(0, die._faces * this.size.value);
      else die._faces = Math.max(0, die._faces + this.size.value);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable reroll modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifyReroll(die) {
    if (!this.hasReroll || die.modifiers.some(m => m.match(this.constructor.REGEX.reroll))) return;
    const l = this.reroll.limit;
    const prefix = this.reroll.recursive ? (l ? `rr${l}` : "rr") : "r";
    const v = this.reroll.value ?? 1;
    let mod;
    if (this.reroll.invert) {
      if (v > 0) {
        // reroll if strictly greater than x.
        mod = (v >= die.faces) ? `${prefix}=${die.faces}` : `${prefix}>${v}`;
      } else if (v === 0) {
        // reroll if max.
        mod = `${prefix}=${die.faces}`;
      } else {
        // reroll if strictly greater than (size-x).
        mod = (die.faces + v <= 1) ? `${prefix}=1` : `${prefix}>${die.faces + v}`;
      }
    } else {
      if (v > 0) {
        // reroll if strictly less than x.
        mod = (v === 1) ? `${prefix}=1` : `${prefix}<${Math.min(die.faces, v)}`;
      } else if (v === 0) {
        // reroll 1s.
        mod = `${prefix}=1`;
      } else {
        // reroll if strictly less than (size-x).
        mod = (die.faces + v <= 1) ? `${prefix}=1` : `${prefix}<${die.faces + v}`;
      }
    }
    if (die.faces > 1) die.modifiers.push(mod);
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable explode modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifyExplode(die) {
    if (!this.hasExplode || die.modifiers.some(m => m.match(this.constructor.REGEX.explode))) return;
    const v = this.explode.value ?? 0;
    const l = this.explode.limit;
    const prefix = (this.explode.once || (l === 1)) ? "xo" : (l ? `x${l}` : "x");
    const _prefix = () => /x\d+/.test(prefix) ? `${prefix}=${die.faces}` : prefix;
    let valid;
    let mod;
    if (v === 0) {
      mod = _prefix();
      valid = (die.faces > 1) || (prefix === "xo");
    } else if (v > 0) {
      mod = (v >= die.faces) ? _prefix() : `${prefix}>=${v}`;
      valid = (v <= die.faces) && (((v === 1) && (prefix === "xo")) || (v > 1));
    } else if (v < 0) {
      const m = Math.max(1, die.faces + v);
      mod = `${prefix}>=${m}`;
      valid = (m > 1) || (prefix == "xo");
    }
    if (valid || l) die.modifiers.push(mod);
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable minimum modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifyMin(die) {
    if (!this.hasMin || die.modifiers.some(m => m.match(this.constructor.REGEX.minimum))) return;
    const f = die.faces;
    let mod;
    const min = this.minimum.value;
    if (this.minimum.maximize) mod = `min${f}`;
    else mod = `min${(min > 0) ? Math.min(min, f) : Math.max(1, f + min)}`;
    if (mod !== "min1") die.modifiers.push(mod);
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable maximum modifiers to a die.
   * @param {DieTerm} die     The die term that will be mutated.
   */
  _modifyMax(die) {
    if (!this.hasMax || die.modifiers.some(m => m.match(this.constructor.REGEX.maximum))) return;
    const zero = this.maximum.zero;
    const v = this.maximum.value;
    const max = (v === 0) ? (zero ? 0 : 1) : (v > 0) ? v : Math.max(zero ? 0 : 1, die.faces + v);
    if (max < die.faces) die.modifiers.push(`max${max}`);
  }

  /* -------------------------------------------------- */

  /**
   * Append applicable modifiers to a roll part.
   * @param {string[]|number[]} parts           The roll part. **will be mutated**
   * @param {object} [rollData]                 Roll data for roll construction.
   * @param {object} [options]
   * @param {boolean} [options.ignoreFirst]     Whether to ignore the 'first' property'.
   * @returns {boolean}                         Whether all but the first die were skipped.
   */
  modifyParts(parts, rollData = {}, options = {}) {
    if (!this.hasModifiers) return;
    const first = !options.ignoreFirst && this.config.first;
    for (let i = 0; i < parts.length; i++) {
      const part = String(parts[i]);
      const roll = new CONFIG.Dice.DamageRoll(part, rollData);
      if (!roll.dice.length) continue;

      for (const die of roll.dice) {
        this.modifyDie(die);
        if (first) break;
      }
      parts[i] = Roll.fromTerms(roll.terms).formula;
      if (first) return true;
    }
    return false;
  }

  /* -------------------------------------------------- */
  /*   Properties                                       */
  /* -------------------------------------------------- */

  /**
   * The babonus this lives on.
   * @type {Babonus}
   */
  get bonus() {
    return this.parent.parent;
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect the dice amount?
   * @type {boolean}
   */
  get hasAmount() {
    if (!this.amount.enabled) return false;
    return Number.isInteger(this.amount.value);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect explosive dice?
   * @type {boolean}
   */
  get hasExplode() {
    if (!this.explode.enabled) return false;
    return (this.maximum.value === null) || Number.isInteger(this.explode.value);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect the maximum cap?
   * @type {boolean}
   */
  get hasMax() {
    if (!this.maximum.enabled) return false;
    return Number.isInteger(this.maximum.value);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect the minimum cap?
   * @type {boolean}
   */
  get hasMin() {
    if (!this.minimum.enabled) return false;
    if (this.minimum.maximize) return true;
    return Number.isInteger(this.minimum.value) && (this.minimum.value !== 0);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus have applicable modifiers for dice?
   * @type {boolean}
   */
  get hasModifiers() {
    return this.hasAmount || this.hasSize || this.hasReroll || this.hasExplode || this.hasMin || this.hasMax;
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect rerolling?
   * @type {boolean}
   */
  get hasReroll() {
    if (!this.reroll.enabled) return false;
    return (this.reroll.value === null) || Number.isInteger(this.reroll.value);
  }

  /* -------------------------------------------------- */

  /**
   * Does this bonus affect the die size?
   * @type {boolean}
   */
  get hasSize() {
    if (!this.size.enabled) return false;
    return Number.isInteger(this.size.value);
  }
}
