const {BooleanField, StringField, NumberField, SchemaField} = foundry.data.fields;

export default class AuraModel extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      enabled: new BooleanField({
        label: "BABONUS.FIELDS.Aura.Enabled.Label",
        hint: "BABONUS.FIELDS.Aura.Enabled.Hint"
      }),
      template: new BooleanField({
        label: "BABONUS.FIELDS.Aura.Template.Label",
        hint: "BABONUS.FIELDS.Aura.Template.Hint"
      }),
      range: new StringField({
        required: true,
        label: "BABONUS.FIELDS.Aura.Range.Label",
        hint: "BABONUS.FIELDS.Aura.Range.Hint"
      }),
      self: new BooleanField({
        initial: true,
        label: "BABONUS.FIELDS.Aura.Self.Label",
        hint: "BABONUS.FIELDS.Aura.Self.Hint"
      }),
      disposition: new NumberField({
        label: "BABONUS.FIELDS.Aura.Disposition.Label",
        hint: "BABONUS.FIELDS.Aura.Disposition.Hint",
        initial: 2,
        choices: {
          2: "BABONUS.FIELDS.Aura.Disposition.OptionAny",
          1: "BABONUS.FIELDS.Aura.Disposition.OptionAlly",
          "-1": "BABONUS.FIELDS.Aura.Disposition.OptionEnemy"
        }
      }),
      blockers: new babonus.abstract.DataFields.fields.auraBlockers({
        label: "BABONUS.FIELDS.Aura.Blockers.Label",
        hint: "BABONUS.FIELDS.Aura.Blockers.Hint"
      }),
      require: new SchemaField(CONST.WALL_RESTRICTION_TYPES.reduce((acc, k) => {
        acc[k] = new BooleanField({
          label: `BABONUS.FIELDS.Aura.Require${k.capitalize()}.Label`,
          hint: `BABONUS.FIELDS.Aura.Require${k.capitalize()}.Hint`
        });
        return acc;
      }, {}))
    };
  }

  /* -------------------------------------------------- */

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /* -------------------------------------------------- */

  /** @override */
  static migrateData(source) {
    if (source.isTemplate) source.template = source.isTemplate;
  }

  /* -------------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    // Prepare aura range.
    if (this.range) {
      const range = dnd5e.utils.simplifyBonus(this.range, this.getRollData());
      this.range = range;
    }

    // Scene regions cannot be auras.
    if (this.bonus.region) this.enabled = false;
  }

  /* -------------------------------------------------- */

  /**
   * Get applicable roll data from the origin.
   * @returns {object}      The roll data.
   */
  getRollData() {
    return this.parent.getRollData({deterministic: true});
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
   * Get whether this has a range that matters.
   * @type {boolean}
   */
  get _validRange() {
    return (this.range === -1) || (this.range > 0);
  }

  /* -------------------------------------------------- */

  /**
   * Whether the babonus is an enabled and valid aura centered on a token. This is true if the property is enabled, the
   * template aura property is not enabled, and the range of the aura is valid.
   * @type {boolean}
   */
  get isToken() {
    return this.enabled && !this.template && this._validRange && !this.bonus.isExclusive;
  }

  /* -------------------------------------------------- */

  /**
   * Whether the babonus is a template aura. This is true if the aura property is enabled, along with the 'template' aura
   * property, and the item on which the babonus is embedded can create a measured template.
   * @type {boolean}
   */
  get isTemplate() {
    const item = this.bonus.parent;
    if (!(item instanceof Item)) return false;
    return this.enabled && this.template && item.hasAreaTarget && !this.bonus.isExclusive;
  }

  /* -------------------------------------------------- */

  /**
   * Whether the babonus aura is suppressed due to its originating actor having at least one of the blocker conditions.
   * @type {boolean}
   */
  get isBlocked() {
    const actor = this.bonus.actor;
    const blockers = new Set(this.blockers);
    const ci = actor.system.traits?.ci?.value ?? new Set();
    for (const c of ci) blockers.delete(c);
    return blockers.intersects(actor.statuses);
  }

  /* -------------------------------------------------- */
  /*   Bonus collection                                 */
  /* -------------------------------------------------- */

  /**
   * Return whether this should be filtered out of token auras due to being blocked from affecting its owner.
   * @type {boolean}
   */
  get isAffectingSelf() {
    if (!this.isToken) return true;
    return !this.isBlocked && this.self;
  }

  /* -------------------------------------------------- */

  /**
   * Is this a token aura that is not blocked?
   * @type {boolean}
   */
  get isActiveTokenAura() {
    return this.enabled && !this.template && this._validRange && !this.isBlocked;
  }
}
