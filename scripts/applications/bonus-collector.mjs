/**
 * A helper class that collects and then hangs onto the bonuses for one particular
 * roll. The bonuses are filtered here only with regards to:
 * - aura blockers, aura range, aura disposition
 * - the hidden state of tokens
 * - the hidden state of measured templates
 * - item exclusivity (babonus being item-only)
 * - item attunement/equipped state (isSuppressed)
 * - effects being unavailable
 */
export default class BonusCollector {
  constructor({activity, item, actor, type}) {
    this.activity = activity;
    this.item = item;
    this.actor = actor;
    this.type = type;

    // Set up canvas elements.
    this.token = this.actor.token?.object ?? this.actor.getActiveTokens()[0];
    if (this.token) this.tokenCenters = this.constructor._collectTokenCenters(this.token);

    this.bonuses = this._collectBonuses();
  }

  /* -------------------------------------------------- */

  /**
   * The type of bonuses being collected.
   * @type {string}
   */
  type = null;

  /* -------------------------------------------------- */

  /**
   * Collected bonuses.
   * @type {Babonus[]}
   */
  bonuses = [];

  /* -------------------------------------------------- */

  /**
   * The activity being used.
   * @type {Activity|null}
   */
  activity = null;

  /* -------------------------------------------------- */

  /**
   * The item performing the roll, if any.
   * @type {Item5e|null}
   */
  item = null;

  /* -------------------------------------------------- */

  /**
   * The actor performing the roll or owning the item performing the roll.
   * @type {Actor5e}
   */
  actor = null;

  /* -------------------------------------------------- */

  /**
   * The token object of the actor performing the roll, if any.
   * @type {Token5e|null}
   */
  token = null;

  /* -------------------------------------------------- */

  /**
   * Center points of all occupied grid spaces of the token placeable.
   * @type {object[]}
   */
  tokenCenters = [];

  /* -------------------------------------------------- */

  /**
   * Token documents on the same scene which are valid, not a group, and not the same token.
   * @type {TokenDocument5e[]}
   */
  tokens = [];

  /* -------------------------------------------------- */

  /**
   * Reference to auras that are to be drawn later.
   * @type {Set<TokenAura>}
   */
  auras = new Set();

  /* -------------------------------------------------- */

  /**
   * A method that can be called at any point to retrieve the bonuses hung on to.
   * This returns a collection of uuids mapping to bonuses due to ids not necessarily changing.
   * @returns {Collection<Babonus>}     The collection of bonuses.
   */
  returnBonuses() {
    return new foundry.utils.Collection(this.bonuses.map(b => [b.uuid, b]));
  }

  /* -------------------------------------------------- */

  /**
   * Main collection method that calls the below collectors for self, all tokens, and all templates.
   * This method also ensures that overlapping templates from one item do not apply twice.
   * @returns {Babonus[]}
   */
  _collectBonuses() {
    const bonuses = {
      actor: this._collectFromSelf(),
      token: [],
      template: [],
      regions: []
    };

    // Token and template auras.
    if (this.token) {

      // Collect token auras.
      const _uuids = new Set();
      for (const token of this.token.scene.tokens) {
        if (token.actor && (token.actor.type !== "group") && (token !== this.token.document) && !token.hidden) {
          if (_uuids.has(token.actor.uuid)) continue;
          bonuses.token.push(...this._collectFromToken(token));
          _uuids.add(token.actor.uuid);
        }
      }

      // Special consideration for templates; allow overlapping without stacking the same bonus.
      const map = new Map();
      for (const template of this.token.scene.templates) {
        const boni = this._collectFromTemplate(template);
        for (const b of boni) map.set(`${b.item.uuid}.Babonus.${b.id}`, b);
      }
      bonuses.template.push(...map.values());

      // Collection from scene regions.
      for (const region of this.token.document.regions) {
        const collected = this._collectFromRegion(region);
        bonuses.regions.push(...collected);
      }
    }

    return bonuses.actor.concat(bonuses.token).concat(bonuses.template).concat(bonuses.regions);
  }

  /* -------------------------------------------------- */

  /**
   * Destroy all auras that were created and drawn during this collection.
   */
  destroyAuras() {
    for (const aura of this.auras) aura.destroy({fadeOut: true});
  }

  /* -------------------------------------------------- */

  /**
   * Get all bonuses that originate from yourself.
   * @returns {Babonus[]}     The array of bonuses.
   */
  _collectFromSelf() {

    // A filter for discarding blocked or suppressed auras, template auras, and auras that do not affect self.
    const validSelfAura = (bab) => {
      return !bab.aura.isTemplate && bab.aura.isAffectingSelf;
    };

    const enchantments = [];
    if (this.item) {
      for (const effect of this.item.allApplicableEffects()) {
        if (effect.active) enchantments.push(...this._collectFromDocument(effect, [validSelfAura]));
      }
    }

    const actor = this._collectFromDocument(this.actor, [validSelfAura]);
    const items = this.actor.items.reduce((acc, item) => acc.concat(this._collectFromDocument(item, [validSelfAura])), []);
    const effects = this.actor.appliedEffects.reduce((acc, effect) => acc.concat(this._collectFromDocument(effect, [validSelfAura])), []);
    return [...enchantments, ...actor, ...items, ...effects];
  }

  /* -------------------------------------------------- */

  /**
   * Get all bonuses that originate from another token on the scene.
   * @param {TokenDocument5e} token     The token.
   * @returns {Babonus[]}               The array of aura bonuses that apply.
   */
  _collectFromToken(token) {
    const bonuses = [];

    const checker = (object) => {
      const collection = babonus.getCollection(object);
      for (const bonus of collection) {
        if (this.type !== bonus.type) continue; // discard bonuses of the wrong type.
        if (!bonus.aura.isActiveTokenAura) continue; // discard blocked and suppressed auras.
        if (bonus.aura.isTemplate) continue; // discard template auras.
        if (!this._matchTokenDisposition(token, bonus)) continue; // discard invalid targeting bonuses.
        if (!this._generalFilter(bonus)) continue;

        // Skip creating pixi auras for infinite-range auras.
        if (bonus.aura.range === -1) {
          bonuses.push(bonus);
        } else {
          const aura = new babonus.abstract.applications.TokenAura(token, bonus);
          aura.initialize(this.token);
          if (aura.isApplying) bonuses.push(bonus);
          this.auras.add(aura);
        }
      }
    };

    checker(token.actor);
    for (const item of token.actor.items) checker(item);
    for (const effect of token.actor.appliedEffects) checker(effect);

    return bonuses;
  }

  /* -------------------------------------------------- */

  /**
   * Get all bonuses that originate from templates the rolling token is standing on.
   * @param {MeasuredTemplateDocument} template     The template.
   * @returns {Babonus[]}                           The array of bonuses.
   */
  _collectFromTemplate(template) {
    if (template.hidden) return [];
    if (!this._tokenWithinTemplate(template.object)) return [];

    // A filter for discarding template auras that are blocked or do not affect self (if they are your own).
    const templateAuraChecker = (bab) => {
      if (bab.aura.isBlocked) return false;
      const isOwn = this.token.actor === bab.actor;
      if (isOwn) return bab.aura.self;
      return this._matchTemplateDisposition(template, bab);
    };

    const templates = this._collectFromDocument(template, [templateAuraChecker]);
    return templates;
  }

  /* -------------------------------------------------- */

  /**
   * Collect bonuses from a scene region the token is standing in.
   * @param {RegionDocument} region     The region.
   * @returns {Babonus[]}               The array of bonuses.
   */
  _collectFromRegion(region) {
    return this._collectFromDocument(region, []);
  }

  /* -------------------------------------------------- */

  /**
   * General collection method that all other collection methods call in some fashion.
   * Gets an array of babonuses from that document.
   * @param {Document5e} document          The token, actor, item, effect, or template.
   * @param {function[]} [filterings]      An array of additional functions used to filter.
   * @returns {Babonus[]}                  An array of babonuses of the right type.
   */
  _collectFromDocument(document, filterings = []) {
    const bonuses = babonus.getCollection(document).reduce((acc, bonus) => {
      if (this.type !== bonus.type) return acc;
      if (!this._generalFilter(bonus)) return acc;
      for (const fn of filterings) if (!fn(bonus)) return acc;
      acc.push(bonus);
      return acc;
    }, []);
    return bonuses;
  }

  /* -------------------------------------------------- */

  /**
   * Some general filters that apply no matter where the babonus is located.
   * @param {Babonus} bonus     A babonus to evaluate.
   * @returns {boolean}         Whether it should immediately be discarded.
   */
  _generalFilter(bonus) {
    if (!bonus.enabled) return false;
    if (bonus.isSuppressed) return false;

    // Filter for exclusivity.
    if (!bonus.isExclusive) return true;
    const item = bonus.item;
    return item ? (this.item?.uuid === item.uuid) : true;
  }

  /* -------------------------------------------------- */

  /**
   * Get the centers of all grid spaces that overlap with a token document.
   * @param {Token5e} token     The token document on the scene.
   * @returns {object[]}        An array of xy coordinates.
   */
  static _collectTokenCenters(token) {
    const points = [];
    const shape = token.shape;
    const [i, j, i1, j1] = canvas.grid.getOffsetRange(token.bounds);
    const delta = (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) ? canvas.dimensions.size : 1;
    const offset = (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) ? canvas.dimensions.size / 2 : 0;
    for (let x = i; x < i1; x += delta) {
      for (let y = j; y < j1; y += delta) {
        const point = canvas.grid.getCenterPoint({i: x + offset, j: y + offset});
        const p = {
          x: point.x - token.document.x,
          y: point.y - token.document.y
        };
        if (shape.contains(p.x, p.y)) points.push(point);
      }
    }
    return points;
  }

  /* -------------------------------------------------- */

  /**
   * Get whether the rolling token has any grid center within a given template.
   * @param {MeasuredTemplate} template     A measured template placeable.
   * @returns {boolean}                     Whether the rolling token is contained.
   */
  _tokenWithinTemplate(template) {
    const {shape, x: tx, y: ty} = template;
    return this.tokenCenters.some(({x, y}) => shape.contains(x - tx, y - ty));
  }

  /* -------------------------------------------------- */

  /**
   * Get whether an aura can target the rolling actor's token depending on its targeting.
   * @param {TokenDocument5e} token     The token on whom the aura was found.
   * @param {Babonus} bonus             The babonus with the aura.
   * @returns {boolean}                 Whether the bonus can apply.
   */
  _matchTokenDisposition(token, bonus) {
    const tisp = token.disposition;
    const bisp = bonus.aura.disposition;
    return this._matchDisposition(tisp, bisp);
  }

  /* -------------------------------------------------- */

  /**
   * Get whether a template aura can target the contained token depending on its targeting.
   * @param {MeasuredTemplateDocument} template   The containing template.
   * @param {Babonus} bonus                       The babonus with the aura.
   * @returns {boolean}                           Whether the bonus can apply.
   */
  _matchTemplateDisposition(template, bonus) {
    const tisp = template.flags.babonus.templateDisposition;
    const bisp = bonus.aura.disposition;
    return this._matchDisposition(tisp, bisp);
  }

  /* -------------------------------------------------- */

  /**
   * Given a disposition of a template/token and the targeting of of an aura, get whether the aura should apply.
   * @param {number} tisp   Token or template disposition.
   * @param {number} bisp   The targeting disposition of a babonus.
   * @returns {boolean}     Whether the targeting applies.
   */
  _matchDisposition(tisp, bisp) {
    if (bisp === 2) { // any
      // If the bonus targets everyone, immediately return true.
      return true;
    } else if (bisp === 1) { // allies
      // If the bonus targets allies, the roller and the source must match.
      return tisp === this.token.document.disposition;
    } else if (bisp === -1) { // enemies
      // If the bonus targets enemies, the roller and the source must have opposite dispositions.
      const modes = CONST.TOKEN_DISPOSITIONS;
      const set = new Set([tisp, this.token.document.disposition]);
      return set.has(modes.FRIENDLY) && set.has(modes.HOSTILE);
    }
  }
}

/* -------------------------------------------------- */

Hooks.on("refreshToken", function(token) {
  for (const aura of Object.values(babonus._currentAuras ?? {})) {
    if ((aura.target === token) || (aura.token === token.document)) aura.refresh();
  }
});

/* -------------------------------------------------- */

Hooks.on("deleteToken", function(tokenDoc) {
  for (const aura of Object.values(babonus._currentAuras ?? {})) {
    if (aura.token === tokenDoc) aura.destroy({fadeOut: false});
  }
});

/* -------------------------------------------------- */

Hooks.on("canvasTearDown", (canvas) => babonus._currentAuras = {});
