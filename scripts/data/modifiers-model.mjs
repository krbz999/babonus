/* Child of Babonus#bonuses that holds all die modifiers. */
export class ModifiersModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      amount: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true})
      }),
      size: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true})
      }),
      reroll: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true}),
        invert: new foundry.data.fields.BooleanField(),
        recursive: new foundry.data.fields.BooleanField()
      }),
      explode: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true}),
        once: new foundry.data.fields.BooleanField()
      }),
      minimum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true}),
        maximize: new foundry.data.fields.BooleanField()
      }),
      maximum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true}),
        zero: new foundry.data.fields.BooleanField()
      }),
      config: new foundry.data.fields.SchemaField({
        first: new foundry.data.fields.BooleanField()
      })
    };
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  prepareDerivedData() {
    const rollData = this.parent.getRollData({deterministic: true});
    for (const m of ["amount", "size", "reroll", "explode", "minimum", "maximum"]) {
      const value = this[m].value;
      if (!value) {
        this[m].value = 0;
        continue;
      }
      const bonus = dnd5e.utils.simplifyBonus(value, rollData);
      this[m].value = Math.round(Number.isNumeric(bonus) ? bonus : null);
    }
  }

  /**
   * Regex to determine whether a die already has a modifier.
   */
  static REGEX = {
    reroll: /rr?([0-9]+)?([<>=]+)?([0-9]+)?/i,
    explode: /xo?([0-9]+)?([<>=]+)?([0-9]+)?/i,
    minimum: /(?:min)([0-9]+)/i,
    maximum: /(?:max)([0-9]+)/i
  };

  /**
   * Append applicable modifiers to a die.
   * @param {DieTerm} die
   */
  modifyDie(die) {
    const dm = die.modifiers;
    const {hasAmount, hasSize, hasReroll, hasExplode, hasMin, hasMax} = this;

    if (hasAmount) die.number = Math.max(0, die.number + this.amount.value);
    if (hasSize) die.faces = Math.max(0, die.faces + this.size.value);
    if (hasReroll && !dm.some(m => m.match(this.constructor.REGEX.reroll))) {
      const prefix = this.reroll.recursive ? "rr" : "r";
      const v = this.reroll.value;
      let mod;
      if (this.reroll.invert) {
        if (v > 0) mod = (v >= die.faces) ? `${prefix}=${die.faces}` : `${prefix}>${v}`; // reroll if strictly greater than x.
        else if (v === 0) mod = `${prefix}=${die.faces}`; // reroll if max.
        else mod = (die.faces + v <= 1) ? `${prefix}=1` : `${prefix}>${die.faces + v}`; // reroll if strictly greater than (size-x).
      } else {
        if (v > 0) mod = (v === 1) ? `${prefix}=1` : `${prefix}<${Math.min(die.faces, v)}`; // reroll if strictly less than x.
        else if (v === 0) mod = `${prefix}=1`; // reroll 1s.
        else mod = (die.faces + v <= 1) ? `${prefix}=1` : `${prefix}<${die.faces + v}`; // reroll if strictly less than (size-x).
      }
      if (die.faces > 1) dm.push(mod);
    }
    if (hasExplode && !dm.some(m => m.match(this.constructor.REGEX.explode))) {
      const v = this.explode.value;
      const prefix = this.explode.once ? "xo" : "x";
      let valid;
      let mod;
      if (v === 0) {
        mod = prefix;
        valid = (die.faces > 1) || (prefix === "xo");
      } else if (v > 0) {
        mod = (die.faces === v) ? prefix : `${prefix}>=${v}`;
        valid = (v <= die.faces) && (((v === 1) && (prefix === "xo")) || (v > 1));
      } else if (v < 0) {
        const m = Math.max(1, die.faces + v);
        mod = `${prefix}>=${m}`;
        valid = m > 1 || (prefix == "xo");
      }
      if (valid) dm.push(mod);
    }
    if (hasMin && !dm.some(m => m.match(this.constructor.REGEX.minimum))) {
      const f = die.faces;
      let mod;
      const min = this.minimum.value;
      if (this.minimum.maximize) mod = `min${f}`;
      else mod = `min${(min > 0) ? Math.min(min, f) : Math.max(1, f + min)}`;
      if (mod !== "min1") dm.push(mod);
    }
    if (hasMax && !dm.some(m => m.match(this.constructor.REGEX.maximum))) {
      const zero = this.maximum.zero;
      const v = this.maximum.value;
      const max = (v === 0) ? (zero ? 0 : 1) : (v > 0) ? v : Math.max(zero ? 0 : 1, die.faces + v);
      if (max < die.faces) dm.push(`max${max}`);
    }
  }

  /**
   * Append applicable modifiers to a roll part.
   * @param {string[]} parts                    The roll part. **will be mutated**
   * @param {object} [rollData]                 Roll data for roll construction.
   * @param {object} [options]
   * @param {boolean} [options.ignoreFirst]     Whether to ignore the 'first' property'.
   * @returns {boolean}                         Whether all but the first die were skipped.
   */
  modifyParts(parts, rollData = {}, options = {}) {
    if (!this.hasModifiers) return;
    const first = !options.ignoreFirst && this.config.first;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
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

  /* ----------------------------- */
  /*           Getters             */
  /* ----------------------------- */

  /**
   * The babonus this lives on.
   * @type {Babonus}
   */
  get bonus() {
    return this.parent.parent;
  }

  /**
   * Does this bonus have applicable modifiers for dice?
   * @type {boolean}
   */
  get hasModifiers() {
    return ["hasAmount", "hasSize", "hasReroll", "hasExplode", "hasMin", "hasMax"].some(m => this[m]);
  }

  /**
   * Does this bonus affect the dice amount?
   * @type {boolean}
   */
  get hasAmount() {
    if (!this.amount.enabled) return false;
    return Number.isInteger(this.amount.value);
  }

  /**
   * Does this bonus affect the die size?
   * @type {boolean}
   */
  get hasSize() {
    if (!this.size.enabled) return false;
    return Number.isInteger(this.size.value);
  }

  /**
   * Does this bonus affect rerolling?
   * @type {boolean}
   */
  get hasReroll() {
    if (!this.reroll.enabled) return false;
    return Number.isInteger(this.reroll.value);
  }

  /**
   * Does this bonus affect explosive dice?
   * @type {boolean}
   */
  get hasExplode() {
    if (!this.explode.enabled) return false;
    return Number.isInteger(this.explode.value);
  }

  /**
   * Does this bonus affect the minimum cap?
   * @type {boolean}
   */
  get hasMin() {
    if (!this.minimum.enabled) return false;
    if (this.minimum.maximize) return true;
    return Number.isInteger(this.minimum.value) && (this.minimum.value !== 0);
  }

  /**
   * Does this bonus affect the maximum cap?
   * @type {boolean}
   */
  get hasMax() {
    if (!this.maximum.enabled) return false;
    return Number.isInteger(this.maximum.value);
  }
}
