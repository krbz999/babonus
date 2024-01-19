import {MODULE} from "../constants.mjs";
import {module} from "../data/_module.mjs";

export class BabonusWorkshop extends Application {
  /* ------------------------------- */
  /*            VARIABLES            */
  /* ------------------------------- */

  //#region

  // The right-hand side bonuses that have a collapsed description.
  _collapsedBonuses = new Set();

  // The color of the left-side otter.
  _otterColor = "black";
  _otterVomits = 0;

  constructor(object, options) {
    super(object, options);
    this.object = object;
    this.isItem = object.documentName === "Item";
    this.isEffect = object.documentName === "ActiveEffect";
    this.isActor = object.documentName === "Actor";
    this.appId = `${this.document.uuid.replaceAll(".", "-")}-babonus-workshop`;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 450,
      height: 700,
      template: `modules/${MODULE.ID}/templates/babonus-workshop.hbs`,
      classes: [MODULE.ID, "builder"],
      scrollY: [".current-bonuses .bonuses"],
      dragDrop: [{dragSelector: "[data-action='current-collapse']", dropSelector: ".current-bonuses .bonuses"}],
      resizable: true
    });
  }

  /**
   * A reference to the owner of the bonuses.
   * @type {Actor5e|Item5e|ActiveEffect5e}
   */
  get document() {
    return this.object;
  }

  /** @override */
  get id() {
    return `${MODULE.ID}-${this.document.uuid.replaceAll(".", "-")}`;
  }

  /** @override */
  get isEditable() {
    return this.document.sheet.isEditable;
  }

  /** @override */
  get title() {
    return `${MODULE.NAME}: ${this.document.name}`;
  }

  /**
   * A reference to the collection of bonuses on this document.
   * @type {Collection<Babonus>}
   */
  get collection() {
    return this.constructor._getCollection(this.document);
  }

  //#endregion

  /* ------------------------------- */
  /*           OVERRIDES             */
  /* ------------------------------- */

  //#region

  /** @override */
  setPosition(pos={}){
    const w = parseInt(pos.width);
    if (w) {
      const el = this.element[0]?.querySelector(".babonus.builder .pages .select-type");
      el?.classList.toggle("hidden", w < 510);
    }
    return super.setPosition(pos);
  }

  /** @override */
  async getData() {
    const data = {};
    data.isItem = this.isItem;
    data.isEffect = this.isEffect;
    data.isActor = this.isActor;

    // Get current bonuses on the document.
    data.currentBonuses = [];
    for (const bonus of this.collection) {
      data.currentBonuses.push({
        bonus: bonus,
        context: {
          collapsed: this._collapsedBonuses.has(bonus.id),
          description: await TextEditor.enrichHTML(bonus.description, {async: true, rollData: bonus.getRollData()}),
          icon: bonus.icon,
          typeTooltip: `BABONUS.Type${bonus.type.capitalize()}`
        }
      });
    }
    // Sort the bonuses alphabetically by name
    data.currentBonuses.sort((a, b) => a.bonus.name.localeCompare(b.bonus.name));

    // New babonus buttons.
    data.createButtons = Object.entries(module.models).map(([type, cls]) => ({
      type, icon: cls.icon, label: `BABONUS.Type${type.capitalize()}`
    }));

    data.ICON = MODULE.ICON;
    data.otterColor = this._otterColor;
    return data;
  }

  /** @override */
  activateListeners(html) {
    // Listeners that are always active.
    html[0].querySelectorAll("[data-action]").forEach(n => {
      const action = n.dataset.action;
      switch (action) {
        case "otter-rainbow":
          n.addEventListener("click", this._onOtterRainbow.bind(this));
          break;
        case "otter-dance":
          n.addEventListener("click", this._onOtterDance.bind(this));
          break;
        case "current-collapse":
          n.addEventListener("click", this._onCollapseBonus.bind(this));
          break;
        case "current-id":
          n.addEventListener("click", this._onClickId.bind(this));
          n.addEventListener("contextmenu", this._onClickId.bind(this));
          break;
      }
    });

    if (!this.isEditable) {
      html[0].querySelectorAll(".left-side, .right-side .functions").forEach(n => {
        n.style.pointerEvents = "none";
        n.classList.add("locked");
      });
      return;
    }
    super.activateListeners(html);

    // Listeners that require ability to edit.
    html[0].querySelectorAll("[data-action]").forEach(n => {
      const action = n.dataset.action;
      switch (action) {
        case "pick-type":
          n.addEventListener("click", this._onClickType.bind(this));
          break;
        case "current-toggle":
          n.addEventListener("click", this._onToggleBonus.bind(this));
          break;
        case "current-copy":
          n.addEventListener("click", this._onCopyBonus.bind(this));
          break;
        case "current-edit":
          n.addEventListener("click", this._onClickBonus.bind(this));
          break;
        case "current-delete":
          n.addEventListener("click", this._onDeleteBonus.bind(this));
          break;
      }
    });
  }

  /** @override */
  _canDragDrop() {
    return this.isEditable;
  }

  /** @override */
  _canDragStart() {
    return true;
  }

  /** @override */
  _onDragStart(event) {
    const label = event.currentTarget.closest(".bonus");
    let dragData;
    if (label.dataset.id) {
      const bab = this.collection.get(label.dataset.id);
      dragData = bab.toDragData();
    }
    if (!dragData) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /** @override */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const doc = this.document;
    if (!this.isEditable) return null;
    const bab = await this._fromDropData(data);
    if (!bab) return null;
    return this.constructor._embedBabonus(doc, bab);
  }

  /**
   * Turn drop data into a babonus.
   * @param {object} data             An object of babonus data or a uuid.
   * @returns {Promise<Babonus>}      The created babonus.
   */
  async _fromDropData(data) {
    if (!data.uuid || (data.type !== "Babonus")) return null;
    const bonus = await this.constructor._fromUuid(data.uuid);
    if (!bonus) return null;
    const babonusData = bonus.toObject();
    if (bonus.parent === this.document) return null;
    return this.constructor._createBabonus(babonusData, null, {parent: this.document});
  }

  /**
   * Handle creating a new bonus.
   * @param {PointerEvent} event          The initiating click event.
   * @returns {Promise<BabonusSheet>}     The sheet of the newly created bonus.
   */
  async _onClickType(event) {
    const type = event.currentTarget.dataset.type;
    const bonus = this.constructor._createBabonus({type: type}, null, {parent: this.document});
    await this.constructor._embedBabonus(this.document, bonus, true);
    return this.collection.get(bonus.id).sheet.render(true);
  }

  /**
   * Render the sheet of an existing bonus.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {BabonusSheet}          The sheet of a babonus.
   */
  _onClickBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    return bonus.sheet.render(true);
  }

  /** @override */
  render(...T) {
    this.document.apps[this.appId] = this;
    return super.render(...T);
  }

  /** @override */
  close(...T) {
    delete this.document.apps[this.appId];
    return super.close(...T);
  }

  //#endregion

  /* ------------------------------- */
  /*     CURRENT BONUSES METHODS     */
  /* ------------------------------- */

  //#region

  /**
   * Otter Rainbow.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onOtterRainbow(event) {
    this._otterColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    event.currentTarget.style.color = this._otterColor;
    const count = this._otterVomits++;
    const content = event.currentTarget.closest(".window-content");
    if (count >= 50) content.classList.toggle("vomit", true);
  }

  /**
   * Otter Dance.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onOtterDance(event) {
    const spin = [{transform: 'rotate(0)'}, {transform: 'rotate(360deg)'}];
    const time = {duration: 1000, iterations: 1};
    if (!event.currentTarget.getAnimations().length) event.currentTarget.animate(spin, time);
  }

  /**
   * Collapse or expand a babonus and its description.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onCollapseBonus(event) {
    const bonus = event.currentTarget.closest(".bonus");
    const id = bonus.dataset.id;
    const has = this._collapsedBonuses.has(id);
    bonus.classList.toggle("collapsed", !has);
    if (has) this._collapsedBonuses.delete(id);
    else this._collapsedBonuses.add(id);
  }

  /**
   * Handle copying the id or uuid of a babonus.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onClickId(event) {
    const bonus = this.collection.get(event.currentTarget.closest(".bonus").dataset.id);
    const id = (event.type === "contextmenu") ? bonus.uuid : bonus.id;
    await game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
      id, label: "Babonus", type: (event.type === "contextmenu") ? "uuid" : "id"
    }));
  }

  /**
   * Delete a babonus on the builder when hitting its trashcan icon. This resets the UI entirely.
   * @param {PointerEvent} event        The initiating click event.
   * @returns {Promise<Actor|Item>}     The actor or item having its babonus deleted.
   */
  async _onDeleteBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const name = this.collection.get(id).name;
    const prompt = await Dialog.confirm({
      title: game.i18n.format("BABONUS.ConfigurationDeleteTitle", {name}),
      content: game.i18n.format("BABONUS.ConfigurationDeleteAreYouSure", {name}),
      options: {id: `babonus-confirm-delete-${id}`}
    });
    if (!prompt) return false;
    return this.document.unsetFlag(MODULE.ID, `bonuses.${id}`);
  }

  /**
   * Toggle the enabled property on a babonus.
   * @param {PointerEvent} event        The initiating click event.
   * @returns {Promise<Actor|Item>}     The actor or item having its babonus toggled.
   */
  async _onToggleBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    return this.constructor._onToggleBonus(bonus);
  }
  static async _onToggleBonus(bonus, state = null) {
    const value = (state === null) ? !bonus.enabled : !!state;
    return bonus.parent.update({[`flags.babonus.bonuses.${bonus.id}.enabled`]: value});
  }

  /**
   * Copy a babonus on the actor or item.
   * @param {PointerEvent} event        The initiating click event.
   * @returns {Promise<Actor|Item>}     The actor or item having its babonus copied.
   */
  async _onCopyBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const data = this.collection.get(id).toObject();
    data.name = game.i18n.format("BABONUS.BonusCopy", {name: data.name});
    data.id = foundry.utils.randomID();
    data.enabled = false;
    return this.document.setFlag(MODULE.ID, `bonuses.${data.id}`, data);
  }

  //#endregion

  /**
   * ----------------------------------------------------
   *
   *
   *                   STATIC FUNCTIONS
   *
   *
   * ----------------------------------------------------
   */

  //#region

  /**
   * Gather a collection of babonuses from a document.
   * @param {Document} object           An actor, item, effect, or template.
   * @returns {Collection<Babonus>}     A collection of babonuses.
   */
  static _getCollection(object) {
    const bonuses = Object.entries(object.flags[MODULE.ID]?.bonuses ?? {});
    const contents = bonuses.reduce((acc, [id, data]) => {
      if (!foundry.data.validators.isValidId(id)) return acc;
      try {
        const bonus = this._createBabonus(data, id, {parent: object});
        acc.push([id, bonus]);
      } catch (err) {
        console.warn(err);
      }
      return acc;
    }, []);
    return new foundry.utils.Collection(contents);
  }

  /**
   * Create a Babonus with the given id (or a new one if none is provided).
   * @param {object} data             An object of babonus data.
   * @param {string} id               Optionally an id to assign the babonus.
   * @param {object} [options={}]     Additional options that modify the babonus creation.
   * @returns {Babonus}               The created babonus.
   */
  static _createBabonus(data, id, options = {}) {
    // if no id explicitly provided, make a new one.
    data.id = id ?? foundry.utils.randomID();

    const bonus = new module.models[data.type](data, options);
    return bonus;
  }

  /**
   * Embed a created babonus onto the target object.
   * @param {Document} object             The actor, item, or effect that should have the babonus.
   * @param {Babonus} bonus               The created babonus.
   * @param {boolean} [keepId=false]      Keep the ID or generate a new one?
   * @returns {Promise<Document>}         The actor, item, or effect that has received the babonus.
   */
  static async _embedBabonus(object, bonus, keepId = false) {
    const data = bonus.toObject();
    const id = keepId ? data.id : foundry.utils.randomID();
    data.id = id;
    await object.update({[`flags.${MODULE.ID}.bonuses.-=${data.id}`]: null}, {render: false, noHook: true});
    return object.setFlag(MODULE.ID, `bonuses.${id}`, data);
  }

  /**
   * Return a babonus using its uuid.
   * @param {string} uuid             The babonus uuid.
   * @returns {Promise<Babonus>}      The found babonus.
   */
  static async _fromUuid(uuid) {
    try {
      const parts = uuid.split(".");
      const id = parts.pop();
      parts.pop();
      const parentUuid = parts.join(".");
      const parent = await fromUuid(parentUuid);
      return this._getCollection(parent).get(id);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  //#endregion
}
