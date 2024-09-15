import {MODULE} from "../constants.mjs";

export default class BabonusWorkshop extends dnd5e.applications.DialogMixin(Application) {
  constructor(object, options) {
    super(object, options);
    this.object = object;
    this.isItem = object.documentName === "Item";
    this.isEffect = object.documentName === "ActiveEffect";
    this.isActor = object.documentName === "Actor";
    this.appId = `${this.document.uuid.replaceAll(".", "-")}-babonus-workshop`;
  }

  /* -------------------------------------------------- */

  /**
   * The right-hand side bonuses that have a collapsed description.
   * @type {Set<string>}
   */
  #collapsedBonuses = new Set();

  /* -------------------------------------------------- */

  /**
   * The color of the left-side otter.
   * @type {string}
   */
  #otterColor = "black";

  /* -------------------------------------------------- */

  /**
   * Number of times the left-side otter has been clicked.
   * @type {number}
   */
  #otterVomits = 0;

  /* -------------------------------------------------- */

  /**
   * A reference to the owner of the bonuses.
   * @type {Actor5e|Item5e|ActiveEffect5e|RegionDocument}
   */
  get document() {
    return this.object;
  }

  /* -------------------------------------------------- */

  /** @override */
  get id() {
    return `${MODULE.ID}-${this.document.uuid.replaceAll(".", "-")}`;
  }

  /* -------------------------------------------------- */

  /** @override */
  get isEditable() {
    return this.document.sheet.isEditable;
  }

  /* -------------------------------------------------- */

  /** @override */
  get title() {
    return `${MODULE.NAME}: ${this.document.name}`;
  }

  /* -------------------------------------------------- */

  /**
   * A reference to the collection of bonuses on this document.
   * @type {Collection<Babonus>}
   */
  get collection() {
    return babonus.getCollection(this.document);
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /** @override */
  setPosition(pos = {}) {
    const w = parseInt(pos.width);
    if (w) {
      const el = this.element[0]?.querySelector(".babonus.builder .pages .select-type");
      el?.classList.toggle("hidden", w < 510);
    }
    return super.setPosition(pos);
  }

  /* -------------------------------------------------- */

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
          collapsed: this.#collapsedBonuses.has(bonus.id),
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
      type, icon: cls.metadata.icon, label: `BABONUS.Type${type.capitalize()}.Label`
    }));

    data.ICON = MODULE.ICON;
    data.otterColor = this.#otterColor;
    return data;
  }

  /* -------------------------------------------------- */

  /** @override */
  activateListeners(html) {
    const content = html[0].parentElement;
    // Listeners that are always active.
    content.querySelectorAll("[data-action]").forEach(n => {
      const action = n.dataset.action;
      switch (action) {
        case "otter-rainbow":
          n.addEventListener("click", this.#onOtterRainbow.bind(this));
          break;
        case "otter-dance":
          n.addEventListener("click", this.#onOtterDance.bind(this));
          break;
        case "current-collapse":
          n.addEventListener("click", this.#onCollapseBonus.bind(this));
          break;
        case "current-id":
          n.addEventListener("click", this.#onClickId.bind(this));
          n.addEventListener("contextmenu", this.#onClickId.bind(this));
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
          n.addEventListener("click", this.#onClickType.bind(this));
          break;
        case "current-toggle":
          n.addEventListener("click", this.#onToggleBonus.bind(this));
          break;
        case "current-copy":
          n.addEventListener("click", this.#onCopyBonus.bind(this));
          break;
        case "current-edit":
          n.addEventListener("click", this.#onClickBonus.bind(this));
          break;
        case "current-delete":
          n.addEventListener("click", this.#onDeleteBonus.bind(this));
          break;
      }
    });
  }

  /* -------------------------------------------------- */

  /** @override */
  _canDragDrop() {
    return this.isEditable;
  }

  /* -------------------------------------------------- */

  /** @override */
  _canDragStart() {
    return true;
  }

  /* -------------------------------------------------- */

  /** @override */
  _onDragStart(event) {
    const label = event.currentTarget.closest(".bonus, [data-item-id]");
    let dragData;
    const id = label.dataset.id ?? label.dataset.itemId;
    if (id) {
      const bab = this.collection.get(id);
      dragData = bab.toDragData();
    }
    if (!dragData) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /* -------------------------------------------------- */

  /** @override */
  async _onDrop(event) {
    if (!this.isEditable) return;
    let data = TextEditor.getDragEventData(event);
    if (!data.uuid || (data.type !== "Babonus")) return;

    let bonus = await babonus.fromUuid(data.uuid);
    if (!bonus || (bonus.parent === this.document)) return;

    data = bonus.toObject();
    data.id = foundry.utils.randomID();
    bonus = new babonus.abstract.DataModels[data.type](data, {parent: this.document});
    babonus.embedBabonus(this.document, bonus);
  }

  /* -------------------------------------------------- */

  /**
   * Handle creating a new bonus.
   * @param {Event} event     The initiating click event.
   */
  async #onClickType(event) {
    const type = event.currentTarget.dataset.type;
    const bonus = new babonus.abstract.DataModels[type]();
    const id = await babonus.embedBabonus(this.document, bonus, {bonusId: true});
    this.collection.get(id).sheet.render(true);
  }

  /* -------------------------------------------------- */

  /**
   * Render the sheet of an existing bonus.
   * @param {Event} event         The initiating click event.
   * @returns {BabonusSheet}      The sheet of a babonus.
   */
  #onClickBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    return bonus.sheet.render(true);
  }

  /* -------------------------------------------------- */

  /** @override */
  render(...T) {
    this.document.apps[this.appId] = this;
    return super.render(...T);
  }

  /* -------------------------------------------------- */

  /** @override */
  close(...T) {
    delete this.document.apps[this.appId];
    return super.close(...T);
  }

  /* -------------------------------------------------- */

  /**
   * Otter Rainbow.
   * @param {Event} event     The initiating click event.
   */
  #onOtterRainbow(event) {
    this.#otterColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    event.currentTarget.style.color = this.#otterColor;
    const count = this.#otterVomits++;
    const content = event.currentTarget.closest(".window-content");
    if (count >= 50) content.classList.toggle("vomit", true);
  }

  /* -------------------------------------------------- */

  /**
   * Otter Dance.
   * @param {Event} event     The initiating click event.
   */
  #onOtterDance(event) {
    const spin = [{transform: "rotate(0)"}, {transform: "rotate(360deg)"}];
    const time = {duration: 1000, iterations: 1};
    if (!event.currentTarget.getAnimations().length) event.currentTarget.animate(spin, time);
  }

  /* -------------------------------------------------- */

  /**
   * Collapse or expand a babonus and its description.
   * @param {Event} event     The initiating click event.
   */
  #onCollapseBonus(event) {
    const bonus = event.currentTarget.closest(".bonus");
    const id = bonus.dataset.id;
    const has = this.#collapsedBonuses.has(id);
    bonus.classList.toggle("collapsed", !has);
    if (has) this.#collapsedBonuses.delete(id);
    else this.#collapsedBonuses.add(id);
  }

  /* -------------------------------------------------- */

  /**
   * Handle copying the id or uuid of a babonus.
   * @param {Event} event     The initiating click event.
   */
  async #onClickId(event) {
    const bonus = this.collection.get(event.currentTarget.closest(".bonus").dataset.id);
    const id = (event.type === "contextmenu") ? bonus.id : bonus.uuid;
    await game.clipboard.copyPlainText(id);
    ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", {
      id, label: "Babonus", type: (event.type === "contextmenu") ? "id" : "uuid"
    }));
  }

  /* -------------------------------------------------- */

  /**
   * Delete a babonus on the builder when hitting its trashcan icon.
   * @param {Event} event     The initiating click event.
   */
  async #onDeleteBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    bonus.deleteDialog();
  }

  /* -------------------------------------------------- */

  /**
   * Toggle the enabled property on a babonus.
   * @param {Event} event     The initiating click event.
   */
  async #onToggleBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bonus = this.collection.get(id);
    bonus.toggle();
  }

  /* -------------------------------------------------- */

  /**
   * Copy a babonus on the document.
   * @param {Event} event     The initiating click event.
   */
  async #onCopyBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    babonus.duplicateBonus(this.collection.get(id));
  }
}
