import {MODULE, SETTINGS} from "../constants.mjs";
import {BabonusWorkshop} from "./babonus.mjs";
import {module} from "../data/_module.mjs";

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
export class BonusCollector {
  // The type of bonuses being collected.
  type = null;
  babonusClass = null;
  bonuses = [];

  // The item performing the roll, if any.
  item = null;

  // The actor performing the roll or owning the item performing the roll.
  actor = null;

  /**
   * The token document of the actor performing the roll, and any related
   * properties, such as its disposition and the grid spaces that it occupies.
   */
  token = null;
  tokenObject = null;
  disposition = null;
  elevation = null;
  tokenCenters = null;

  templates = [];
  tokens = [];

  /** The collected bonuses. */
  actorBonuses = [];
  tokenBonuses = [];
  templateBonuses = [];

  constructor(data) {
    // Set up type and class.
    this.type = data.type;
    this.babonusClass = module.models[this.type];

    // Set up item and actor.
    if (data.object instanceof Item) {
      this.item = data.object;
      this.actor = data.object.actor;
    } else {
      this.actor = data.object;
    }

    // Set up canvas elements.
    this.token = this.actor.token?.object ?? this.actor.getActiveTokens()[0];
    if (this.token) {
      this.tokenDocument = this.token.document;
      this.disposition = this.tokenDocument.disposition;
      this.elevation = this.tokenDocument.elevation;
      this.tokenCenters = this.constructor._collectTokenCenters(this.tokenDocument);

      // Find all templates and all other tokens.
      this.templates = canvas.scene.templates;
      this.tokens = canvas.scene.tokens.filter(t => {
        if (!t.actor) return false;
        if (t.actor.type === "group") return false;
        return t !== this.token.document;
      });
    }

    this.bonuses = this._collectBonuses();
  }

  /**
   * A method that can be called at any point to retrieve the bonuses hung on to.
   * This returns a collection of uuids mapping to bonuses due to ids not necessarily changing.
   * @returns {Collection<Babonus>}     The collection of bonuses.
   */
  returnBonuses() {
    if (game.settings.get(MODULE.ID, SETTINGS.AURA)) this.drawAuras();
    return new foundry.utils.Collection(this.bonuses.map(b => [b.uuid, b]));
  }

  /**
   * *******************************************************************
   *
   *
   *                          COLLECTION METHODS
   *
   *
   *
   * *******************************************************************
   */

  /**
   * Main collection method that calls the below collectors for self, all tokens, and all templates.
   * This method also ensures that overlapping templates from one item do not apply twice.
   */
  _collectBonuses() {
    // Clear the arrays.
    this.actorBonuses = [];
    this.tokenBonuses = [];
    this.templateBonuses = [];

    this.actorBonuses = this._collectFromSelf();
    for (const token of this.tokens) if (!token.hidden) this.tokenBonuses.push(...this._collectFromToken(token));

    // Special consideration for templates; allow overlapping without stacking the same bonus.
    const _templateBonuses = [];
    for (const template of this.templates) {
      _templateBonuses.push(...this._collectFromTemplate(template));
    }
    this.templateBonuses.push(...new foundry.utils.Collection(_templateBonuses.map(b => [`${b.item.uuid}.Babonus.${b.id}`, b])));

    const bonuses = Array.from(this.actorBonuses).concat(this.templateBonuses);
    for (const [token, pixi, bonus, bool] of this.tokenBonuses) if (bool) bonuses.push(bonus);


    return bonuses;
  }

  /**
   * Get all bonuses that originate from yourself.
   * @returns {Babonus[]}     The array of bonuses.
   */
  _collectFromSelf() {

    // A filter for discarding blocked or suppressed auras, template auras, and auras that do not affect self.
    const validSelfAura = (bab) => {
      return bab.aura.isAffectingSelf;
    };

    const actor = this._collectFromDocument(this.actor, [validSelfAura]);
    const items = this.actor.items.reduce((acc, item) => acc.concat(this._collectFromDocument(item, [validSelfAura])), []);
    const effects = this.actor.appliedEffects.reduce((acc, effect) => acc.concat(this._collectFromDocument(effect, [validSelfAura])), []);
    return [...actor, ...items, ...effects];
  }

  /**
   * Get all bonuses that originate from another token on the scene.
   * @param {TokenDocument} token                         The token.
   * @returns {array<Token, PIXI, Babonus, boolean>}      An array from `this.auraMaker`.
   */
  _collectFromToken(token) {
    // array of arrays: token / pixi graphic / babonus / 'contained?'
    const bonuses = [];

    const checker = (object) => {
      const collection = BabonusWorkshop._getCollection(object);
      for (const bonus of collection) {
        if (this.type !== bonus.type) continue; // discard bonuses of the wrong type.
        if (!bonus.aura.isActiveTokenAura) continue; // discard blocked, suppressed, and template auras.
        if (!this._matchTokenDisposition(token, bonus)) continue; // discard invalid targeting bonuses.
        if (this._generalFilter(bonus)) {
          bonuses.push(this.auraMaker(token.object, bonus));
        }
      }
    }

    checker(token.actor);
    for (const item of token.actor.items) checker(item);
    for (const effect of token.actor.appliedEffects) checker(effect);

    return bonuses;
  }

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

  /**
   * General collection method that all other collection methods call in some fashion.
   * Gets an array of babonuses from that document.
   * @param {Document} document         The token, actor, item, effect, or template.
   * @param {Function[]} filterings     An array of additional functions used to filter.
   * @returns {Babonus[]}               An array of babonuses of the right type.
   */
  _collectFromDocument(document, filterings = []) {
    const flags = document.flags.babonus?.bonuses ?? {};
    const bonuses = Object.entries(flags).reduce((acc, [id, data]) => {
      if (this.type !== data.type) return acc;
      if (!foundry.data.validators.isValidId(id)) return acc;
      try {
        const bab = new this.babonusClass(data, {parent: document});
        if (!this._generalFilter(bab)) return acc;
        for (const func of filterings) {
          if (!func(bab)) return acc;
        }
        acc.push(bab);
      } catch (err) {
        console.warn(err);
      }
      return acc;
    }, []);
    return bonuses;
  }

  /**
   * Some general filters that apply no matter where the babonus is located.
   * @param {Babonus} bonus     A babonus to evaluate.
   * @returns {boolean}         Whether it should immediately be discarded.
   */
  _generalFilter(bonus) {
    if (!bonus.enabled) return false;

    // Stuff that applies only if the bonus is on an item.
    if (bonus.parent instanceof Item) {
      if (bonus.isSuppressed) return false;
      if (bonus.isExclusive && (this.item?.uuid !== bonus.parent.uuid)) return false;
    }

    // Stuff that applies only if the bonus is on an effect.
    else if (bonus.parent instanceof ActiveEffect) {}

    // Stuff that applies only if the bonus is on a template.
    else if (bonus.parent instanceof MeasuredTemplateDocument) {
      const item = bonus.item;
      if (!item || bonus.isSuppressed) return false;
    }

    return true;
  }

  /**
   * *******************************************************************
   *
   *
   *                           UTILITY FUNCTIONS
   *
   *
   *
   * *******************************************************************
   */

  /**
   * Get the centers of all grid spaces that overlap with a token document.
   * @param {TokenDocument} tokenDoc      The token document on the scene.
   * @returns {object[]}                  An array of xy coordinates.
   */
  static _collectTokenCenters(tokenDoc) {
    const object = tokenDoc.document ? tokenDoc : tokenDoc.object;
    const {width, height, x, y} = object.document;
    const grid = canvas.scene.grid.size;
    const halfGrid = grid / 2;

    if (width <= 1 && height <= 1) return [object.center];

    const centers = [];
    for (let a = 0; a < width; a++) {
      for (let b = 0; b < height; b++) {
        centers.push({
          x: x + a * grid + halfGrid,
          y: y + b * grid + halfGrid
        });
      }
    }
    return centers;
  }

  /**
   * Get whether the rolling token has any grid center within a given template.
   * @param {MeasuredTemplate} template     A measured template placeable.
   * @returns {boolean}                     Whether the rolling token is contained.
   */
  _tokenWithinTemplate(template) {
    const {shape, x: tx, y: ty} = template;
    return this.tokenCenters.some(({x, y}) => shape.contains(x - tx, y - ty));
  }

  /**
   * Get whether an aura can target the rolling actor's token depending on its targeting.
   * @param {TokenDocument} token     The token on whom the aura was found.
   * @param {Babonus} bonus           The babonus with the aura.
   * @returns {boolean}               Whether the bonus can apply.
   */
  _matchTokenDisposition(token, bonus) {
    const tisp = token.disposition;
    const bisp = bonus.aura.disposition;
    return this._matchDisposition(tisp, bisp);
  }

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

  /**
   * Given a disposition of a template/token and the targeting of of an aura, get whether the aura should apply.
   * @param {number} tisp   Token or template disposition.
   * @param {number} bisp   The targeting disposition of a babonus.
   * @returns {boolean}     Whether the targeting applies.
   */
  _matchDisposition(tisp, bisp) {
    const aura = module.fields.aura.OPTIONS;
    if (bisp === aura.ANY) {
      // If the bonus targets everyone, immediately return true.
      return true;
    } else if (bisp === aura.ALLY) {
      // If the bonus targets allies, the roller and the source must match.
      return tisp === this.disposition;
    } else if (bisp === aura.ENEMY) {
      // If the bonus targets enemies, the roller and the source must have opposite dispositions.
      const modes = CONST.TOKEN_DISPOSITIONS;
      const set = new Set([tisp, this.disposition]);
      return set.has(modes.FRIENDLY) && set.has(modes.HOSTILE);
    }
  }

  /**
   * Create a PIXI aura without drawing it, and return whether the roller is within it.
   * @credit to @freeze2689
   * @param {Token} token       A token placeable with an aura.
   * @param {Babonus} bonus     The bonus with an aura.
   * @returns {array<*>}        The token, the PIXI graphic, the babonus, and whether the roller is contained within.
   */
  auraMaker(token, bonus) {
    const shape = new PIXI.Graphics();
    const hasLimitedRadius = bonus.aura.range > 0;
    const radius = hasLimitedRadius ? bonus.aura.range * canvas.dimensions.distancePixels + token.h / 2 : undefined;
    const alpha = 0.08;
    const color = 0xFFFFFF;

    let m, s;
    if (bonus.aura.require.move) {
      m = CONFIG.Canvas.polygonBackends.move.create(token.center, {
        type: "move", hasLimitedRadius, radius
      });
    }
    if (bonus.aura.require.sight) {
      s = CONFIG.Canvas.polygonBackends.sight.create(token.center, {
        type: "sight", hasLimitedRadius, radius, useThreshold: true
      });
    }

    // Case 1: No constraints.
    if (!m && !s) {
      if (!hasLimitedRadius) return [token, null, bonus, true];
      const center = token.center;
      shape.beginFill(color, alpha).drawCircle(center.x, center.y, radius).endFill();
    }

    // Case 2: Both constraints.
    else if (m && s) {
      shape.beginFill(color, alpha).drawPolygon(m.intersectPolygon(s)).endFill();
    }

    // Case 3: Single constraint.
    else if (m || s) {
      shape.beginFill(color, alpha).drawShape(m ?? s).endFill();
    }

    shape.pivot.set(token.x, token.y);
    const contains = this.tokenCenters.some(p => shape.containsPoint(p));
    return [token, shape, bonus, contains];
  }

  /**
   * Draw auras on the canvas.
   * @param {array<*>} array     The token, the PIXI graphic, the babonus, and whether the roller is contained within.
   */
  drawAuras() {
    for (const [token, aura, bonus, bool] of this.tokenBonuses) {
      if (!(bonus.aura.range > 0)) continue;
      aura.tint = bool ? 0x00FF00 : 0xFF0000;
      aura.id = foundry.utils.randomID();
      token.addChild(aura);
      setTimeout(() => token.removeChild(aura), 5000);
    }
  }
}
