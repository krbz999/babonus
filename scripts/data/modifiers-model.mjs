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
        recursive: new foundry.data.fields.BooleanField()
      }),
      explode: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true}),
        once: new foundry.data.fields.BooleanField()
      }),
      minimum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true})
      }),
      maximum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.StringField({required: true})
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
        this[m].value = null;
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

    // Assume these are all strings of integers or null.
    const {amt, sz, r, x, min, max} = this;
    if (amt) die.number = Math.max(0, die.number + parseInt(amt));
    if (sz > 0) die.faces += sz;
    if (r && !dm.some(m => m.match(this.constructor.REGEX.reroll))) dm.push(r);
    if (x && !dm.some(m => m.match(this.constructor.REGEX.explode))) dm.push(x);
    if (min && !dm.some(m => m.match(this.constructor.REGEX.minimum))) {
      const minimum = this.minimum.value;
      if (minimum === -1) dm.push(`min${die.faces}`);
      else dm.push(`min${Math.clamped(minimum, 2, die.faces)}`);
    }
    if (max && !dm.some(m => m.match(this.constructor.REGEX.maximum))) dm.push(max);
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
    return ["amt", "sz", "r", "x", "min", "max"].some(m => this[m]);
  }

  /**
   * The added amount of dice.
   * @type {string|null}
   */
  get amt() {
    if (!this.amount.enabled) return null;
    const am = parseInt(this.amount.value);
    return isNaN(am) ? null : am.signedString();
  }

  /**
   * The increase in die size.
   * @type {number}
   */
  get sz() {
    if (!this.size.enabled) return null;
    if (!Number.isInteger(this.size.value)) return null;
    return Math.max(0, this.size.value);
  }

  /**
   * The reroll modifier.
   * @type {string|null}
   */
  get r() {
    if (!this.reroll.enabled) return null;
    const prefix = this.reroll.recursive ? "rr" : "r";
    if (!Number.isNumeric(this.reroll.value) || !(this.reroll.value > 1)) return `${prefix}=1`;
    return `${prefix}<${this.reroll.value}`;
  }

  /**
   * The explosion modifier.
   * @type {string|null}
   */
  get x() {
    if (!this.explode.enabled) return null;
    const prefix = this.explode.once ? "xo" : "x";
    if (!Number.isNumeric(this.explode.value) || !(this.explode.value > 0)) return prefix;
    return `${prefix}>${this.explode.value}`;
  }

  /**
   * The minimum modifier.
   * @type {string|null}
   */
  get min() {
    if (!this.minimum.enabled) return null;
    const isMax = this.minimum.value === -1;
    if (!isMax && !(Number.isNumeric(this.minimum.value) && (this.minimum.value > 1))) return null;
    return `min${this.minimum.value}`;
  }

  /**
   * The maximum modifier.
   * @type {string|null}
   */
  get max() {
    if (!this.maximum.enabled) return null;
    if (!Number.isNumeric(this.maximum.value) || !(this.maximum.value > 0)) return null;
    return `max${this.maximum.value}`;
  }
}
