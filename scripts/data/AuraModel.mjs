import {module} from "./_module.mjs";

export class AuraModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      enabled: new foundry.data.fields.BooleanField({required: false, initial: true}),
      template: new foundry.data.fields.BooleanField({required: false}),
      range: new foundry.data.fields.StringField({nullable: true, initial: null}),
      self: new foundry.data.fields.BooleanField({required: false, initial: true}),
      disposition: new foundry.data.fields.NumberField({initial: this.OPTIONS.ANY, choices: Object.values(this.OPTIONS)}),
      blockers: new module.filters.auraBlockers(),
      require: new foundry.data.fields.SchemaField({
        sight: new foundry.data.fields.BooleanField(),
        move: new foundry.data.fields.BooleanField()
      })
    };
  }

  static get OPTIONS() {
    return {ALLY: 1, ENEMY: -1, ANY: 2};
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  static migrateData(source) {
    if (source.isTemplate) source.template = source.isTemplate;
  }

  /** @override */
  prepareDerivedData() {
    // Prepare aura range.
    if (this.range) {
      const range = dnd5e.utils.simplifyBonus(this.range, this.getRollData({deterministic: true}));
      this.range = range;
    }
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
   * Get whether this has a range that matters.
   * @returns {boolean}
   */
  get _validRange() {
    return this.range === -1 || this.range > 0;
  }

  /**
   * Whether the babonus is an enabled and valid aura centered on a token. This is true if the property is enabled, the
   * template aura property is not enabled, and the range of the aura is valid.
   * @returns {boolean}
   */
  get isToken() {
    return this.enabled && !this.template && this._validRange;
  }

  /**
   * Whether the babonus is a template aura. This is true if the aura property is enabled, along with the 'template' aura
   * property, and the item on which the babonus is embedded can create a measured template.
   * @returns {boolean}
   */
  get isTemplate() {
    const item = this.bonus.parent;
    if (!(item instanceof Item)) return false;
    return this.enabled && this.template && item.hasAreaTarget;
  }

  /**
   * Whether the babonus aura is suppressed due to its originating actor having at least one of the blocker conditions.
   * @returns {boolean}
   */
  get isBlocked() {
    return new Set(this.blockers).intersects(this.bonus.actor.statuses);
  }

  /* ----------------------------- */
  /* Bonus Collector methods       */
  /* ----------------------------- */

  /**
   * Return whether this should be filtered out of token auras due to being blocked from affecting its owner.
   * @returns {boolean}
   */
  get isAffectingSelf() {
    if (!this.isToken) return true;
    return !this.isBlocked && this.self;
  }

  /**
   * Is this a token aura that is not blocked?
   * @returns {boolean}
   */
  get isActiveTokenAura() {
    return this.enabled && !this.template && this._validRange && !this.isBlocked;
  }
}
