import {MODULE, SETTINGS} from "../constants.mjs";

export default class TokenAura {
  static RED = 0xFF0000;
  static GREEN = 0x00FF00;
  static WHITE = 0xFFFFFF;

  /**
   * @constructor
   * @param {TokenDocument5e} token
   * @param {Babonus} bonus
   */
  constructor(token, bonus) {
    this.#token = token;
    this.#bonus = bonus;
    this.showAuras = game.settings.get(MODULE.ID, SETTINGS.AURA);

    babonus._currentAuras ??= {};
    const old = babonus._currentAuras[bonus.uuid];
    if (old) old.destroy({fadeOut: false});
    babonus._currentAuras[bonus.uuid] = this;
  }

  /**
   * Do auras show and fade in and out?
   * @type {boolean}
   */
  #showAuras = true;
  get showAuras() {
    return this.#showAuras;
  }
  set showAuras(bool) {
    this.#showAuras = bool;
  }

  /**
   * The origin of the aura.
   * @type {TokenDocument5e}
   */
  #token = null;
  get token() {
    return this.#token;
  }

  #bonus = null;
  get bonus() {
    return this.#bonus;
  }

  /**
   * The drawn pixi graphics.
   * @type {PIXI.Graphics|null}
   */
  #element = null;
  get element() {
    return this.#element;
  }
  set element(g) {
    this.#element = g;
  }

  /**
   * The container element for the aura.
   * @type {PIXI.Container}
   */
  #container = null;
  get container() {
    return this.#container;
  }
  set container(c) {
    this.#container = c;
  }

  /**
   * A current token target this aura is being evaluated against.
   * Not the origin of the aura.
   * @type {Token5e}
   */
  #target = null;
  get target() {
    return this.#target;
  }
  set target(token) {
    this.#target = token;
  }

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

  /**
   * The radius of this aura, in feet.
   * @type {number}
   */
  get radius() {
    return this.bonus.aura.range;
  }

  /**
   * Can this aura be drawn?
   * @type {boolean}
   */
  get isDrawable() {
    return this.bonus.aura._validRange;
  }

  /**
   * Should this aura apply its bonus to the target?
   * @type {boolean}
   */
  get isApplying() {
    return this.element?.tint === this.constructor.GREEN;
  }

  /**
   * Initialize the aura.
   * @param {Token5e} target      The target to test containment against.
   */
  initialize(target) {
    this.target = target;
    this.refresh({fadeIn: true});
  }

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
    this.container.addChild(this.element);

    // Fade in the container.
    if (fadeIn) this.fadeIn();
  }

  /**
   * Fade in the aura over a period of time.
   */
  fadeIn() {
    if (!this.container || !this.showAuras) return;
    CanvasAnimation.animate(
      [{attribute: "alpha", parent: this.container, to: 1, from: 0}],
      {name: foundry.utils.randomID(), duration: 1000, easing: (x) => x * x}
    );
  }

  /**
   * Create the inner pixi element and assign it.
   * @returns {PIXI.Graphics|null}
   */
  create() {
    if (!this.isDrawable) return null;

    const {width, height} = this.token;
    const center = this.token.object.center;
    const radius = this.radius + canvas.grid.distance * Math.max(width, height) * 0.5;
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
    g.lineStyle({width: 3, color: this.constructor.WHITE, alpha: 0.75});
    g.beginFill(0xFFFFFF, 0.03).drawPolygon(sweep).endFill();

    this.element = g;

    return g;
  }

  /**
   * Create and assign a container if one is missing,
   * add the aura element to it, and add the container to the grid.
   * @returns {PIXI.Container|null}
   */
  draw() {
    if (!this.element) return null;
    const o = this.token.object;
    if (!o || !o.visible || !o.renderable) return null;

    if (!this.container) {
      const container = new PIXI.Container();
      canvas.interface.grid.addChild(container);
      this.container = container;

      container.alpha = this.showAuras ? 1 : 0;
    }
    return this.container;
  }

  /**
   * Set the color of the aura to either white, red, or green.
   */
  colorize() {
    if (!this.target) this.element.tint = this.constructor.WHITE;
    else this.element.tint = this.contains(this.target) ? this.constructor.GREEN : this.constructor.RED;
  }

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

  /**
   * Destroy the aura and its container.
   * @param {object} [options]
   * @param {boolean} [options.fadeOut]     Should the aura fade out or be destroyed immediately?
   * @param {number} [options.duration]     Fade-out duration.
   */
  destroy({fadeOut = true, duration = 4000} = {}) {
    const remove = () => {
      this.container?.destroy();
      delete babonus._currentAuras[this.bonus.uuid];
    };

    if (this.container && fadeOut && this.showAuras) {
      CanvasAnimation.animate(
        [{attribute: "alpha", parent: this.container, to: 0, from: 1}],
        {name: foundry.utils.randomID(), duration, easing: (x) => x * x}
      ).then(() => remove());
    } else remove();
  }
}
