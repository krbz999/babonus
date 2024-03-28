import {MODULE, SETTINGS} from "../constants.mjs";
import {BabonusWorkshop} from "./babonus-workshop.mjs";
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
  /**
   * The type of bonuses being collected.
   * @type {string}
   */
  type = null;

  /**
   * Collected bonuses.
   * @type {Babonus[]}
   */
  bonuses = [];

  /**
   * The item performing the roll, if any.
   * @type {Item5e|null}
   */
  item = null;

  /**
   * The actor performing the roll or owning the item performing the roll.
   * @type {Actor5e}
   */
  actor = null;

  /**
   * The token object of the actor performing the roll, if any.
   * @type {Token5e|null}
   */
  token = null;

  /**
   * Center points of all occupied grid spaces of the token placeable.
   * @type {object[]}
   */
  tokenCenters = [];

  /**
   * Token documents on the same scene which are valid, not a group, and not the same token.
   * @type {TokenDocument5e[]}
   */
  tokens = [];

  /**
   * Reference to auras that are to be drawn later.
   * @type {[Token5e, Q, Babonus, boolean]}
   */
  _auras = [];

  constructor(data) {
    // Set up type.
    this.type = data.type;

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
      this.tokenCenters = this.constructor._collectTokenCenters(this.token.document);
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

  /*************************************/
  /*                                   */
  /*         COLLECTION METHODS        */
  /*                                   */
  /*************************************/

  /**
   * Main collection method that calls the below collectors for self, all tokens, and all templates.
   * This method also ensures that overlapping templates from one item do not apply twice.
   * @returns {Babonus[]}
   */
  _collectBonuses() {
    const bonuses = {
      actor: this._collectFromSelf(),
      token: [],
      template: []
    };

    // Token and template auras.
    if (this.token) {
      for(const token of this.token.scene.tokens) {
        if (token.actor && (token.actor.type !== "group") && (token !== this.token.document) && !token.hidden) {
          bonuses.token.push(...this._collectFromToken(token));
        }
      }

      // Special consideration for templates; allow overlapping without stacking the same bonus.
      const map = new Map();
      for (const template of this.token.scene.templates) {
        const boni = this._collectFromTemplate(template);
        for(const b of boni) map.set(`${b.item.uuid}.Babonus.${b.id}`, b);
      }
      bonuses.template.push(...map.values());
    }

    const tokenBonuses = bonuses.token.reduce((acc, [t, p, bonus, bool]) => {
      if (bool) acc.push(bonus);
      return acc;
    }, []);
    // Save a reference to the auras for drawing them later.
    this._auras = bonuses.token;

    return bonuses.actor.concat(tokenBonuses).concat(bonuses.template);
  }

  /**
   * Get all bonuses that originate from yourself.
   * @returns {Babonus[]}     The array of bonuses.
   */
  _collectFromSelf() {

    // A filter for discarding blocked or suppressed auras, template auras, and auras that do not affect self.
    const validSelfAura = (bab) => {
      return !bab.aura.isTemplate && bab.aura.isAffectingSelf;
    };

    const actor = this._collectFromDocument(this.actor, [validSelfAura]);
    const items = this.actor.items.reduce((acc, item) => acc.concat(this._collectFromDocument(item, [validSelfAura])), []);
    const effects = this.actor.appliedEffects.reduce((acc, effect) => acc.concat(this._collectFromDocument(effect, [validSelfAura])), []);
    return [...actor, ...items, ...effects];
  }

  /**
   * Get all bonuses that originate from another token on the scene.
   * @param {TokenDocument5e} token                   The token.
   * @returns {[Token5e, PIXI, Babonus, boolean]}     An array from the aura maker.
   */
  _collectFromToken(token) {
    // array of arrays: token / pixi graphic / babonus / 'contained?'
    const bonuses = [];

    const checker = (object) => {
      const collection = BabonusWorkshop._getCollection(object);
      for (const bonus of collection) {
        if (this.type !== bonus.type) continue; // discard bonuses of the wrong type.
        if (!bonus.aura.isActiveTokenAura) continue; // discard blocked and suppressed auras.
        if (bonus.aura.isTemplate) continue; // discard template auras.
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
   * @param {Document5e} document          The token, actor, item, effect, or template.
   * @param {function[]} [filterings]      An array of additional functions used to filter.
   * @returns {Babonus[]}                  An array of babonuses of the right type.
   */
  _collectFromDocument(document, filterings = []) {
    const flags = document.flags.babonus?.bonuses ?? {};
    const bonuses = Object.entries(flags).reduce((acc, [id, data]) => {
      if (this.type !== data.type) return acc;
      if (!foundry.data.validators.isValidId(id)) return acc;
      try {
        const bab = new module.models[this.type](data, {parent: document});
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
    if (bonus.isSuppressed) return false; // if the origin item (if there is one) is unequipped/unattuned.

    // Filter for exclusivity.
    if (!bonus.isExclusive) return true;
    const item = bonus.item;
    return item ? (this.item?.uuid === item.uuid) : true;
  }

  /*************************************/
  /*                                   */
  /*         UTILITY FUNCTIONS         */
  /*                                   */
  /*************************************/

  /**
   * Get the centers of all grid spaces that overlap with a token document.
   * @param {TokenDocument5e} tokenDoc      The token document on the scene.
   * @returns {object[]}                    An array of xy coordinates.
   */
  static _collectTokenCenters(tokenDoc) {
    const object = tokenDoc.object;
    const {width, height, x, y} = tokenDoc;
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
   * @param {TokenDocument5e} token     The token on whom the aura was found.
   * @param {Babonus} bonus             The babonus with the aura.
   * @returns {boolean}                 Whether the bonus can apply.
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
      return tisp === this.token.document.disposition;
    } else if (bisp === aura.ENEMY) {
      // If the bonus targets enemies, the roller and the source must have opposite dispositions.
      const modes = CONST.TOKEN_DISPOSITIONS;
      const set = new Set([tisp, this.token.document.disposition]);
      return set.has(modes.FRIENDLY) && set.has(modes.HOSTILE);
    }
  }

  /**
   * Create a PIXI aura without drawing it, and return whether the roller is within it.
   * @credit to @freeze2689
   * @param {Token5e} token                           A token placeable with an aura.
   * @param {Babonus} bonus                           The bonus with an aura.
   * @returns {[Token5e, PIXI, Babonus, boolean]}     The token, the PIXI graphic, the babonus,
   *                                                  and whether the roller is contained within.
   */
  auraMaker(token, bonus) {
    const cnt = Object.values(bonus.aura.require).filter(x => x);
    if (!cnt && !(bonus.aura.range > 0)) return [token, null, bonus, true];

    const circle = babonus.createRestrictedCircle(token, bonus.aura.range, bonus.aura.require);
    const shape = new PIXI.Graphics();
    shape.beginFill(0xFFFFFF, 0.08).drawPolygon(circle).endFill();
    shape.pivot.set(token.x, token.y);
    const contains = this.tokenCenters.some(p => circle.contains(p.x, p.y));
    return [token, shape, bonus, contains];
  }

  /**
   * Draw auras on the canvas.
   */
  drawAuras() {
    for (const [token, aura, bonus, bool] of this._auras) {
      if (!(bonus.aura.range > 0)) continue;
      aura.tint = bool ? 0x00FF00 : 0xFF0000;
      aura.id = foundry.utils.randomID();
      token.addChild(aura);
      setTimeout(() => token.removeChild(aura), 5000);
    }
  }
}
