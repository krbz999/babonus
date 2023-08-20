export class ModifiersModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      reroll: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.NumberField(),
        recursive: new foundry.data.fields.BooleanField()
      }),
      explode: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.NumberField(),
        once: new foundry.data.fields.BooleanField()
      }),
      minimum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.NumberField()
      }),
      maximum: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField(),
        value: new foundry.data.fields.NumberField()
      }),
      config: new foundry.data.fields.SchemaField({
        first: new foundry.data.fields.BooleanField()
      })
    };
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
    const {r, x, min, max} = this;

    if (r && !dm.some(m => m.match(this.constructor.REGEX.reroll))) dm.push(r);
    if (x && !dm.some(m => m.match(this.constructor.REGEX.explode))) dm.push(x);
    if (min && !dm.some(m => m.match(this.constructor.REGEX.minimum))) dm.push(min);
    if (max && !dm.some(m => m.match(this.constructor.REGEX.maximum))) dm.push(max);
  }

  /* ----------------------------- */
  /* Getters                       */
  /* ----------------------------- */

  /**
   * The babonus this lives on.
   * @returns {Babonus}
   */
  get bonus() {
    return this.parent.parent;
  }

  /**
   * The applicable modifiers.
   * @returns {string[]}
   */
  get hasModifiers() {
    return ["r", "x", "min", "max"].some(m => this[m]);
  }

  /**
   * The reroll modifier.
   * @returns {string}
   */
  get r() {
    if (!this.reroll.enabled) return null;
    const prefix = this.reroll.recursive ? "rr" : "r";
    if (!Number.isNumeric(this.reroll.value)) return `${prefix}=1`;
    return `${prefix}<${this.reroll.value}`;
  }

  /**
   * The explosion modifier.
   * @returns {string}
   */
  get x() {
    if (!this.explode.enabled) return null;
    const prefix = this.explode.once ? "xo" : "x";
    if (!Number.isNumeric(this.explode.value)) return prefix;
    return `${prefix}>${this.explode.value}`;
  }

  /**
   * The minimum modifier.
   * @returns {string}
   */
  get min() {
    if (!this.minimum.enabled) return null;
    if (!Number.isNumeric(this.minimum.value) || !(this.minimum.value > 0)) return null;
    return `min${this.minimum.value}`;
  }

  /**
   * The maximum modifier.
   * @returns {string}
   */
  get max() {
    if (!this.maximum.enabled) return null;
    if (!Number.isNumeric(this.maximum.value) || !(this.maximum.value > 0)) return null;
    return `max${this.maximum.value}`;
  }
}
