import {MODULE} from "../constants.mjs";

export class BabonusWorkshop extends dnd5e.applications.DialogMixin(Application) {
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
      width: 510,
      height: 700,
      template: `modules/${MODULE.ID}/templates/babonus-workshop.hbs`,
      classes: [MODULE.ID, "builder", "dnd5e2"],
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
    return babonus.getCollection(this.document);
  }

  //#endregion

  /* ------------------------------- */
  /*           OVERRIDES             */
  /* ------------------------------- */

  //#region

  /** @override */
  setPosition(pos = {}) {
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
    data.parentName = this.document.name;

    // Get current bonuses on the document.
    data.currentBonuses = [];
    for (const bonus of this.collection) {
      data.currentBonuses.push({
        bonus: bonus,
        context: {
          collapsed: this._collapsedBonuses.has(bonus.id),
          description: await TextEditor.enrichHTML(bonus.description, {
            async: true, rollData: bonus.getRollData(), relativeTo: bonus.origin
          }),
          icon: bonus.icon,
          typeTooltip: `BABONUS.Type${bonus.type.capitalize()}.Label`
        }
      });
    }
    // Sort the bonuses alphabetically by name
    data.currentBonuses.sort((a, b) => a.bonus.name.localeCompare(b.bonus.name));

    // New babonus buttons.
    data.createButtons = Object.entries(babonus.abstract.DataModels).map(([type, cls]) => ({
      type, icon: cls.icon, label: `BABONUS.Type${type.capitalize()}.Label`
    }));

    data.ICON = MODULE.ICON;
    data.otterColor = this._otterColor;
    return data;
  }

  /** @override */
  activateListeners(html) {
    const content = html[0].parentElement;
    // Listeners that are always active.
    content.querySelectorAll("[data-action]").forEach(n => {
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
      content.querySelectorAll(".left-side, .right-side .functions").forEach(n => {
        n.style.pointerEvents = "none";
        n.classList.add("locked");
      });
      return;
    }
    super.activateListeners(html);

    // Listeners that require ability to edit.
    content.querySelectorAll("[data-action]").forEach(n => {
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
    const label = event.currentTarget.closest(".bonus, [data-item-id]");
    let dragData;
    const id = label.dataset.id ?? label.dataset.itemId;
    if (id) {
      const collection = this.collection ?? babonus.getCollection(this.document);
      const bab = collection.get(id);
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
    const bab = await BabonusWorkshop._fromDropData.call(this, data);
    if (!bab) return null;
    return BabonusWorkshop._embedBabonus(doc, bab);
  }

  /**
   * Turn drop data into a babonus.
   * @param {object} data                 An object of babonus data or a uuid.
   * @returns {Promise<Babonus|null>}     The created babonus.
   */
  static async _fromDropData(data) {
    if (!data.uuid || (data.type !== "Babonus")) return null;
    const bonus = await babonus.fromUuid(data.uuid);
    if (!bonus || (bonus.parent === this.document)) return null;
    data = bonus.toObject();
    data.id = foundry.utils.randomID();
    return new babonus.abstract.DataModels[data.type](data, {parent: this.document});
  }

  /**
   * Handle creating a new bonus.
   * @param {Event} event                 The initiating click event.
   * @returns {Promise<BabonusSheet>}     The sheet of the newly created bonus.
   */
  async _onClickType(event) {
    const type = event.currentTarget.dataset.type;
    const bonus = new babonus.abstract.DataModels[type]({
      type: type,
      id: foundry.utils.randomID()
    }, {parent: this.document});
    await this.constructor._embedBabonus(this.document, bonus, true);
    return this.collection.get(bonus.id).sheet.render(true);
  }

  /**
   * Render the sheet of an existing bonus.
   * @param {Event} event         The initiating click event.
   * @returns {BabonusSheet}      The sheet of a babonus.
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
   * @param {Event} event     The initiating click event.
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
   * @param {Event} event     The initiating click event.
   */
  _onOtterDance(event) {
    const spin = [{transform: "rotate(0)"}, {transform: "rotate(360deg)"}];
    const time = {duration: 1000, iterations: 1};
    if (!event.currentTarget.getAnimations().length) event.currentTarget.animate(spin, time);
  }

  /**
   * Collapse or expand a babonus and its description.
   * @param {Event} event     The initiating click event.
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
   * @param {Event} event     The initiating click event.
   */
  async _onClickId(event) {
    const bonus = this.collection.get(event.currentTarget.closest(".bonus").dataset.id);
    const id = (event.type === "contextmenu") ? bonus.id : bonus.uuid;
    await game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
      id, label: "Babonus", type: (event.type === "contextmenu") ? "id" : "uuid"
    }));
  }

  /**
   * Delete a babonus on the builder when hitting its trashcan icon.
   * @param {Event} event     The initiating click event.
   */
  async _onDeleteBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    bonus.deleteDialog();
  }

  /**
   * Toggle the enabled property on a babonus.
   * @param {Event} event     The initiating click event.
   */
  async _onToggleBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    bonus.toggle();
  }

  /**
   * Copy a babonus on the document.
   * @param {Event} event     The initiating click event.
   */
  async _onCopyBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const src = this.collection.get(id);
    const data = src.toObject();
    data.name = game.i18n.format("BABONUS.BonusCopy", {name: data.name});
    const bonus = new src.constructor(data, {parent: src.parent});
    this.constructor._embedBabonus(src.parent, bonus);
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
   * Embed a created babonus onto the target object.
   * @param {Document5e} object         The actor, item, or effect that should have the babonus.
   * @param {Babonus} bonus             The created babonus.
   * @param {boolean} [keepId]          Keep the ID or generate a new one?
   * @param {Set<string>} [filters]     A set of strings denoting keys to not delete from the bonus object.
   * @returns {Promise<Document5e>}     The actor, item, or effect that has received the babonus.
   */
  static async _embedBabonus(object, bonus, keepId = false, filters) {
    const data = bonus.toObject();
    filters ??= new Set();
    for (const id of Object.keys(data.filters)) {
      if (!filters.has(id) && !babonus.abstract.DataFields.filters[id].storage(bonus)) delete data.filters[id];
    }
    const id = keepId ? data.id : foundry.utils.randomID();
    data.id = id;

    let collection = babonus.getCollection(object);
    if (collection.has(id)) collection.delete(id);
    collection = collection.contents;
    collection.push(data);

    return object.setFlag("babonus", "bonuses", collection);
  }

  //#endregion
}
