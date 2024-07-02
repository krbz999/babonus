import {MODULE, SETTINGS} from "../constants.mjs";

export default class TokenAura {
  /**
   * @constructor
   * @param {TokenDocument5e} token
   * @param {Babonus} bonus
   */
  constructor(token, bonus) {
    this.#token = token;
    this.#bonus = bonus;
    this.showAuras = game.settings.get(MODULE.ID, SETTINGS.AURA);
    this.padRadius = !canvas.grid.isGridless || game.settings.get(MODULE.ID, SETTINGS.RADIUS);

    const auras = this.auras;
    const old = auras[bonus.uuid];
    if (old) old.destroy({fadeOut: false});
    auras[bonus.uuid] = this;
  }

  /* -------------------------------------------------- */

  /**
   * The color of the aura when the target is not contained within it.
   * @type {Color}
   */
  static RED = new Color(0xFF0000);

  /* -------------------------------------------------- */

  /**
   * The color of the aura when the target is contained within it.
   * @type {Color}
   */
  static GREEN = new Color(0x00FF00);

  /* -------------------------------------------------- */

  /**
   * The untinted default color of the aura.
   * @type {Color}
   */
  static WHITE = new Color(0xFFFFFF);

  /* -------------------------------------------------- */

  /**
   * The collection of auras being kept track of.
   * @type {Record<string, TokenAura>}
   */
  get auras() {
    babonus._currentAuras ??= {};
    return babonus._currentAuras;
  }

  /* -------------------------------------------------- */

  /**
   * The default color of the aura (white).
   * @type {Color}
   */
  get white() {
    return this.constructor.WHITE;
  }

  /* -------------------------------------------------- */

  /**
   * The name of this aura.
   * @type {string}
   */
  get name() {
    return `${this.bonus.uuid}-aura`;
  }

  /* -------------------------------------------------- */

  /**
   * Do auras show and fade in and out?
   * @type {boolean}
   */
  #showAuras = true;

  /* -------------------------------------------------- */

  /**
   * Do auras show and fade in and out?
   * @type {boolean}
   */
  get showAuras() {
    return this.#showAuras;
  }

  /* -------------------------------------------------- */

  /**
   * Set whether auras show and fade in and out.
   * @param {boolean} bool      Whether to show.
   */
  set showAuras(bool) {
    this.#showAuras = bool;
  }

  /* -------------------------------------------------- */

  /**
   * Do auras pad the radius due to token sizes?
   * @type {boolean}
   */
  #padRadius = true;

  /* -------------------------------------------------- */

  /**
   * Do auras pad the radius due to token sizes?
   * @type {boolean}
   */
  get padRadius() {
    return this.#padRadius;
  }

  /* -------------------------------------------------- */

  /**
   * Set whether auras are padded due to token size.
   * @param {boolean} bool      Whether to pad.
   */
  set padRadius(bool) {
    this.#padRadius = bool;
  }

  /* -------------------------------------------------- */

  /**
   * The origin of the aura.
   * @type {TokenDocument5e}
   */
  #token = null;

  /* -------------------------------------------------- */

  /**
   * The origin of the aura.
   * @type {TokenDocument5e}
   */
  get token() {
    return this.#token;
  }

  /* -------------------------------------------------- */

  /**
   * The babonus from which to draw data.
   * @type {Babonus}
   */
  #bonus = null;

  /* -------------------------------------------------- */

  /**
   * The babonus from which to draw data.
   * @type {Babonus}
   */
  get bonus() {
    return this.#bonus;
  }

  /* -------------------------------------------------- */

  /**
   * The drawn pixi graphics.
   * @type {PIXI.Graphics|null}
   */
  #element = null;

  /* -------------------------------------------------- */

  /**
   * The drawn pixi graphics.
   * @type {PIXI.Graphics|null}
   */
  get element() {
    return this.#element;
  }

  /* -------------------------------------------------- */

  /**
   * Set the displayed pixi graphical element.
   * @param {PIXI.Graphics}
   */
  set element(g) {
    this.#element = g;
  }

  /* -------------------------------------------------- */

  /**
   * The container element for the aura.
   * @type {PIXI.Container}
   */
  #container = null;

  /* -------------------------------------------------- */

  /**
   * The container element for the aura.
   * @type {PIXI.Container}
   */
  get container() {
    return this.#container;
  }

  /* -------------------------------------------------- */

  /**
   * Set the container element for the aura.
   * @param {PIXI.Container} c      The container.
   */
  set container(c) {
    this.#container = c;
  }

  /* -------------------------------------------------- */

  /**
   * A current token target this aura is being evaluated against. Not the origin of the aura.
   * @type {Token5e}
   */
  #target = null;

  /* -------------------------------------------------- */

  /**
   * A current token target this aura is being evaluated against. Not the origin of the aura.
   * @type {Token5e}
   */
  get target() {
    return this.#target;
  }

  /* -------------------------------------------------- */

  /**
   * Set the current token target of this aura.
   * @param {Token5e}
   */
  set target(token) {
    this.#target = token;
  }

  /* -------------------------------------------------- */

  /**
   * The type of wall restrictions that apply to this bonus.
   * @type {Set<string>}
   */
  get restrictions() {
    const r = new Set();
    for (const [k, v] of Object.entries(this.bonus.aura.require)) {
      if (v) r.add(k);
    }
    return r;
  }

  /* -------------------------------------------------- */

  /**
   * The radius of this aura, in grid measurement units.
   * @type {number}
   */
  get radius() {
    return this.bonus.aura.range;
  }

  /* -------------------------------------------------- */

  /**
   * Can this aura be drawn?
   * @type {boolean}
   */
  get isDrawable() {
    return this.bonus.aura._validRange;
  }

  /* -------------------------------------------------- */

  /**
   * Should this aura apply its bonus to the target?
   * @type {boolean}
   */
  get isApplying() {
    return this.element?.tint === this.constructor.GREEN;
  }

  /* -------------------------------------------------- */

  /**
   * Is this aura visible?
   * @type {boolean}
   */
  get visible() {
    return this.token.object.visible && this.token.object.renderable;
  }

  /* -------------------------------------------------- */

  /**
   * Initialize the aura.
   * @param {Token5e} target      The target to test containment against.
   */
  initialize(target) {
    this.target = target;
    this.refresh({fadeIn: true});
  }

  /* -------------------------------------------------- */

  /**
   * Refresh the drawn state of the container and the contained aura.
   * @param {object} [options]
   * @param {boolean} [options.fadeIn]      Should the aura fade in?
   */
  refresh({fadeIn = false} = {}) {
    // Create element.
    this.create();

    // Create container if missing.
    this.draw();

    // Color the element.
    this.colorize();

    // Add element to container.
    if (!this.container) return;
    this.container.addChild(this.element);

    // Fade in the container.
    if (this.visible) {
      if (fadeIn) this.fadeIn();
      else this.show();
    } else this.hide();
  }

  /* -------------------------------------------------- */

  /**
   * Immediately hide this aura.
   */
  hide() {
    if (!this.container) return;
    CanvasAnimation.terminateAnimation(this.name);
    this.container.alpha = 0;
  }

  /* -------------------------------------------------- */

  /**
   * Immediately show this aura.
   */
  show() {
    if (!this.container) return;
    CanvasAnimation.terminateAnimation(this.name);
    this.container.alpha = 1;
  }

  /* -------------------------------------------------- */

  /**
   * Fade in the aura over a period of time.
   */
  fadeIn() {
    if (!this.container || !this.showAuras) return;
    this.show();
    CanvasAnimation.animate(
      [{attribute: "alpha", parent: this.container, to: 1, from: 0}],
      {name: this.name, duration: 200, easing: (x) => x * x}
    );
  }

  /* -------------------------------------------------- */

  /**
   * Create the inner pixi element and assign it.
   * @returns {PIXI.Graphics|null}
   */
  create() {
    if (!this.isDrawable) return null;

    let radius = this.radius;
    if (this.padRadius) radius += canvas.grid.distance * Math.max(this.token.width, this.token.height) * 0.5;

    const center = this.token.object.center;
    const points = canvas.grid.getCircle(center, radius);

    let sweep = new PIXI.Polygon(points);
    for (const type of this.restrictions) {
      sweep = ClockwiseSweepPolygon.create(center, {
        includeDarkness: type === "sight",
        type: type,
        debug: false,
        useThreshold: type !== "move",
        boundaryShapes: [sweep]
      });
    }

    if (this.element) this.element.destroy();

    const g = new PIXI.Graphics();
    g.lineStyle({width: 3, color: this.white, alpha: 0.75});
    g.beginFill(0xFFFFFF, 0.03).drawPolygon(sweep).endFill();

    this.element = g;

    return g;
  }

  /* -------------------------------------------------- */

  /**
   * Create and assign a container if one is missing,
   * add the aura element to it, and add the container to the grid.
   * @returns {PIXI.Container|null}
   */
  draw() {
    if (!this.element || !this.token.object) return null;

    if (!this.container) {
      const container = new PIXI.Container();
      canvas.interface.grid.addChild(container);
      this.container = container;

      if (this.showAuras) this.show();
      else this.hide();
    }
    return this.container;
  }

  /* -------------------------------------------------- */

  /**
   * Set the color of the aura to either white, red, or green.
   */
  colorize() {
    if (!this.target) this.element.tint = this.white;
    else this.element.tint = this.contains(this.target) ? this.constructor.GREEN : this.constructor.RED;
  }

  /* -------------------------------------------------- */

  /**
   * Does this aura contain a token within its bounds?
   * @param {Token5e} token     A token placeable to test.
   * @returns {boolean}
   */
  contains(token) {
    if (!this.element || !token) return false;

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
        if (shape.contains(p.x, p.y) && this.element.containsPoint(point)) {
          return true;
        }
      }
    }
    return false;
  }

  /* -------------------------------------------------- */

  /**
   * Destroy the aura and its container.
   * @param {object} [options]
   * @param {boolean} [options.fadeOut]     Should the aura fade out or be destroyed immediately?
   * @param {number} [options.duration]     Fade-out duration.
   */
  destroy({fadeOut = true, duration = 500} = {}) {
    const remove = () => {
      this.container?.destroy();
      delete this.auras[this.bonus.uuid];
    };

    if (this.container && fadeOut && this.showAuras && this.visible) {
      this.show();
      CanvasAnimation.animate(
        [{attribute: "alpha", parent: this.container, to: 0, from: 1}],
        {name: this.name, duration, easing: (x) => x * x}
      ).then(() => remove());
    } else remove();
  }
}
