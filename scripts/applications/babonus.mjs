import {MODULE} from "../constants.mjs";
import {ConsumptionDialog} from "./consumptionApp.mjs";
import {AuraConfigurationDialog} from "./auraConfigurationApp.mjs";
import {BabonusKeysDialog} from "./keysDialog.mjs";
import {module} from "../data/_module.mjs";

export class BabonusWorkshop extends FormApplication {
  /**
   * ----------------------------------------------------
   *
   *
   *                      VARIABLES
   *
   *
   * ----------------------------------------------------
   */

  //#region

  // The right-hand side bonuses that have a collapsed description.
  _collapsedBonuses = new Set();

  // The ids of the filters that have been added.
  _addedFilters = new Set();

  // The color of the left-side otter.
  _otterColor = "black";

  // The babonuses that exist on this document.
  collection = null;

  constructor(object, options) {
    super(object, options);
    this.isItem = object.documentName === "Item";
    this.isEffect = object.documentName === "ActiveEffect";
    this.isActor = object.documentName === "Actor";
    this.appId = `${this.document.uuid.replaceAll(".", "-")}-babonus-workshop`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      closeOnSubmit: false,
      width: 1000,
      height: 900,
      template: `modules/${MODULE.ID}/templates/babonus.hbs`,
      classes: [MODULE.ID, "builder"],
      scrollY: [".current-bonuses .bonuses", "div.available-filters", "div.unavailable-filters"],
      dragDrop: [{dragSelector: ".label[data-action='current-collapse']", dropSelector: ".current-bonuses .bonuses"}],
      resizable: true
    });
  }

  get document() {
    return this.object;
  }

  get id() {
    return `${MODULE.ID}-${this.document.id}`;
  }

  get isEditable() {
    return this.document.sheet.isEditable;
  }

  get title() {
    return `${MODULE.NAME}: ${this.document.name}`;
  }

  //#endregion

  /**
   * ----------------------------------------------------
   *
   *
   *                      OVERRIDES
   *
   *
   * ----------------------------------------------------
   */

  //#region

  /** @override */
  async getData() {
    const data = await super.getData();

    // Save the collection of bonuses that exist on this document.
    this.collection = this.constructor._getCollection(this.document);

    data.isItem = this.isItem;
    data.isEffect = this.isEffect;
    data.isActor = this.isActor;
    data.activeBuilder = !!this._currentBabonus;

    if (data.isItem) {
      data.canEquip = this._canEquipItem(this.document);
      data.canAttune = this._canAttuneToItem(this.document);
      data.canConfigureTemplate = this.document.hasAreaTarget;
    }

    // Initial values of the filters.
    data.filters = [];

    if (data.activeBuilder) {
      // The type of the bonus.
      const type = this._currentBabonus.type;

      // Whether it is edit mode or create mode.
      data.isEditing = this.collection.has(this._currentBabonus.id);
      if (data.isEditing) data._filters = this._filters;

      // The current bonus being made or edited.
      data.currentBabonus = this._currentBabonus;
      data.builder = {label: `BABONUS.Type${type.capitalize()}`};
      data.addedFilters = this._addedFilters;

      // Construct data for the filter pickers.
      for (const [id, cls] of Object.entries(module.filters)) {
        const filterData = {
          id: id,
          // whether is should be shown in 'available filters'.
          available: cls.isFilterAvailable(this._addedFilters, this._currentBabonus)
        };
        filterData.unavailable = !(filterData.available || this._addedFilters.has(id));
        data.filters.push(filterData);
      }
      data.filters.sort((a, b) => {
        a = `BABONUS.Filters${a.id.capitalize()}`;
        b = `BABONUS.Filters${b.id.capitalize()}`;
        return game.i18n.localize(a).localeCompare(game.i18n.localize(b));
      });
    }

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
      type,
      icon: cls.icon,
      label: `BABONUS.Type${type.capitalize()}`
    }));
    data.ICON = MODULE.ICON;
    data.otterColor = this._otterColor;

    delete this._filters;
    return data;
  }

  /** @override */
  async _updateObject(event, formData) {
    try {
      const newData = foundry.utils.expandObject(formData);
      const previousData = this._currentBabonus.toObject();
      delete previousData.filters;
      foundry.utils.mergeObject(newData, previousData, {overwrite: false});
      const bonus = this.constructor._createBabonus(newData, newData.id, {strict: true});
      await this.constructor._embedBabonus(this.document, bonus);
      ui.notifications.info(game.i18n.format("BABONUS.NotificationSave", bonus));
    } catch (err) {
      console.warn(err);
      this._displayWarning();
      return;
    }
  }

  /** @override */
  activateListeners(html) {
    // Otter.
    html[0].querySelector("[data-action='otter-rainbow']").addEventListener("click", this._onOtterRainbow.bind(this));
    html[0].querySelector("[data-action='otter-dance']").addEventListener("click", this._onOtterDance.bind(this));
    html[0].querySelectorAll("[data-action='current-collapse']").forEach(n => {
      n.addEventListener("click", this._onCollapseBonus.bind(this));
    });

    if (!this.isEditable) {
      html[0].querySelectorAll(".left-side, .right-side .functions").forEach(n => {
        n.style.pointerEvents = "none";
        n.classList.add("locked");
      });
      return;
    }
    super.activateListeners(html);

    // Builder methods.
    html[0].querySelector("[data-action='cancel']").addEventListener("click", this._onCancelBuilder.bind(this));
    html[0].querySelectorAll("[data-action='keys-dialog']").forEach(a => a.addEventListener("click", this._onDisplayKeysDialog.bind(this)));
    html[0].querySelectorAll("[data-action='pick-type']").forEach(a => a.addEventListener("click", this._onPickType.bind(this)));
    html[0].querySelectorAll("[data-action='delete-filter']").forEach(a => a.addEventListener("click", this._onDeleteFilter.bind(this)));
    html[0].querySelectorAll("[data-action='add-filter']").forEach(a => a.addEventListener("click", this._onAddFilter.bind(this)));
    html[0].querySelector("[data-action='dismiss-warning']").addEventListener("click", this._onDismissWarning.bind(this));
    html[0].querySelectorAll("[data-action='section-collapse']").forEach(a => a.addEventListener("click", this._onSectionCollapse.bind(this)));

    // Current bonuses.
    html[0].querySelectorAll("[data-action='current-toggle']").forEach(a => a.addEventListener("click", this._onToggleBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-copy']").forEach(a => a.addEventListener("click", this._onCopyBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-edit']").forEach(a => a.addEventListener("click", this._onEditBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-delete']").forEach(a => a.addEventListener("click", this._onDeleteBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-aura']").forEach(a => a.addEventListener("click", this._onToggleAura.bind(this)));
    html[0].querySelectorAll("[data-action='current-aura']").forEach(a => a.addEventListener("contextmenu", this._onToggleAura.bind(this)));
    html[0].querySelectorAll("[data-action='current-optional']").forEach(a => a.addEventListener("click", this._onToggleOptional.bind(this)));
    html[0].querySelectorAll("[data-action='current-consume']").forEach(a => a.addEventListener("click", this._onToggleConsume.bind(this)));
    html[0].querySelectorAll("[data-action='current-consume']").forEach(a => a.addEventListener("contextmenu", this._onToggleConsume.bind(this)));
    html[0].querySelectorAll("[data-action='current-exclusive']").forEach(a => a.addEventListener("click", this._onToggleExclusive.bind(this)));
    html[0].querySelectorAll("[data-action='current-id']").forEach(a => a.addEventListener("click", this._onClickId.bind(this)));
    html[0].querySelectorAll("[data-action='current-id']").forEach(a => a.addEventListener("contextmenu", this._onClickId.bind(this)));
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

  //#endregion

  /**
   * ----------------------------------------------------
   *
   *
   *                   RENDERING METHODS
   *
   *
   * ----------------------------------------------------
   */

  //#region

  /**
   * Special implementation of rendering, to reset the entire application to a clean state.
   * @param {PointerEvent} event              The initiating click event.
   * @returns {Promise<BabonusWorkshop>}      This application.
   */
  async _renderClean(event) {
    this._addedFilters.clear();
    delete this._currentBabonus;
    return super.render(false);
  }

  /**
   * Special implementation of rendering, for when entering creation mode.
   * @param {PointerEvent} event              The initiating click event.
   * @returns {Promise<BabonusWorkshop>}      This application.
   */
  async _renderCreator(event) {
    const type = event.currentTarget.dataset.type;
    this._currentBabonus = this.constructor._createBabonus({type, name: game.i18n.localize("BABONUS.NewBabonus")}, null, {parent: this.document});
    this._addedFilters.clear();
    return super.render(false);
  }

  /**
   * Special implementation of rendering, for when entering edit mode.
   * @param {PointerEvent} event              The initiating click event.
   * @returns {Promise<BabonusWorkshop>}      This application.
   */
  async _renderEditor(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    this._currentBabonus = this.collection.get(id);
    this._addedFilters = new Set(Object.keys(this._currentBabonus.toObject().filters));

    // Create the form groups for each active filter.
    const DIV = document.createElement("DIV");
    DIV.innerHTML = "";
    for (const id of this._addedFilters) {
      DIV.innerHTML += await module.filters[id].render(this._currentBabonus);
    }
    this._filters = DIV.innerHTML;

    return super.render(false);
  }

  /** @override */
  async render(force = false, options = {}) {
    // To automatically render in a clean state, the reason
    // for rendering must either be due to an update in the
    // object's babonus flags, or 'force' must explicitly be set to 'true'.
    const wasBabUpdate = foundry.utils.hasProperty(options, `data.flags.${MODULE.ID}`);
    if (!(wasBabUpdate || force)) return;
    delete this._currentBabonus;
    this._addedFilters.clear();
    this.document.apps[this.appId] = this;
    return super.render(force, options);
  }

  /** @override */
  close(...T) {
    super.close(...T);
    delete this.document.apps[this.appId];
  }

  //#endregion

  /**
   * ----------------------------------------------------
   *
   *
   *                CURRENT BONUSES METHODS
   *
   *
   * ----------------------------------------------------
   */

  //#region

  /**
   * Otter Rainbow.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onOtterRainbow(event) {
    this._otterColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    event.currentTarget.style.color = this._otterColor;
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
    ui.notifications.info(game.i18n.format("BABONUS.NotificationDelete", {name, id}));
    return this.document.unsetFlag(MODULE.ID, `bonuses.${id}`);
  }

  /**
   * Toggle the aura configuration of the babonus on or off, or open the config dialog.
   * @param {PointerEvent} event                                The initiating click event.
   * @returns {Promise<Actor|Item|AuraConfigurationDialog>}     The actor, item, or aura config.
   */
  async _onToggleAura(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = this.collection.get(id);
    const path = `bonuses.${id}.aura.enabled`;
    // Right-click always shows the application.
    if (event.type === "contextmenu") return new AuraConfigurationDialog(this.document, {bab, builder: this}).render(true);
    if (bab.aura.isTemplate || bab.aura.isToken) return this.document.setFlag(MODULE.ID, path, false);
    else if (event.shiftKey) return this.document.setFlag(MODULE.ID, path, !bab.aura.enabled);
    return new AuraConfigurationDialog(this.document, {bab, builder: this}).render(true);
  }

  /**
   * Toggle the exclusivity property on a babonus.
   * @param {PointerEvent} event        The initiating click event.
   * @returns {Promise<Actor|Item>}     The actor or item having its babonus toggled.
   */
  async _onToggleExclusive(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.collection.get(id).exclusive;
    return this.document.setFlag(MODULE.ID, `bonuses.${id}.exclusive`, !state);
  }

  /**
   * Toggle the consumption property on a babonus.
   * @param {PointerEvent} event                          The initiating click event.
   * @returns {Promise<Actor|Item|ConsumptionDialog>}     The actor, item, or consumption config.
   */
  async _onToggleConsume(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = this.collection.get(id);
    const path = `bonuses.${id}.consume.enabled`;
    // Right-click always shows the application.
    if (event.type === "contextmenu") return new ConsumptionDialog(this.document, {bab}).render(true);
    if (bab.consume.isConsuming) return this.document.setFlag(MODULE.ID, path, false);
    else if (event.shiftKey) return this.document.setFlag(MODULE.ID, path, !bab.consume.enabled);
    return new ConsumptionDialog(this.document, {bab}).render(true);
  }

  /**
   * Toggle the optional property on a babonus.
   * @param {PointerEvent} event        The initiating click event.
   * @returns {Promise<Actor|Item>}     The actor or item having its babonus toggled.
   */
  async _onToggleOptional(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.collection.get(id).optional;
    return this.document.setFlag(MODULE.ID, `bonuses.${id}.optional`, !state);
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
  static async _onToggleBonus(bonus, state=null){
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
    ui.notifications.info(game.i18n.format("BABONUS.NotificationCopy", data));
    return this.document.setFlag(MODULE.ID, `bonuses.${data.id}`, data);
  }

  /**
   * Edit a babonus by adding it to the builder. This also sets all related stored values.
   * @param {PointerEvent} event              The initiating click event.
   * @returns {Promise<BabonusWorkshop>}      This application.
   */
  async _onEditBonus(event) {
    // Render the application specifically in this mode.
    return this._renderEditor(event);
  }

  //#endregion

  /**
   * ----------------------------------------------------
   *
   *                 FILTER PICKER AND
   *                  BUILDER METHODS
   *
   *
   * ----------------------------------------------------
   */

  //#region

  /**
   * Collapse a section in the builder.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onSectionCollapse(event) {
    event.currentTarget.closest("header").classList.toggle("collapsed");
  }

  /**
   * Helper function to display the keys dialog and subsequently place the
   * selected values in the input fields that its button was placed near.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onDisplayKeysDialog(event) {
    const formGroup = event.currentTarget.closest(".form-group");
    const filterId = formGroup.dataset.id;

    const field = module.filters[filterId];
    const list = field.choices;
    const canExclude = field.canExclude;

    // The text input.
    const values = formGroup.querySelector("input[type='text']").value.split(";");

    for (let value of values) {
      value = value.trim();
      const key = value.replaceAll("!", "");
      const val = list.find(e => e.value === key);
      if (!val) continue;
      if (value.startsWith("!")) val.exclude = true;
      else val.include = true;
    }

    const newValue = await BabonusKeysDialog.prompt({
      rejectClose: false,
      options: {filterId, appId: this.appId, values: list, canExclude},
      callback: function(html) {
        const selects = Array.from(html[0].querySelectorAll("select"));
        return selects.reduce((acc, select) => {
          if (select.value === "include") return `${acc}${select.dataset.value};`;
          else if (select.value === "exclude") return `${acc}!${select.dataset.value};`;
          else return acc;
        }, "");
      },
    });

    if (!newValue) return;
    formGroup.querySelector("input[type='text']").value = newValue;
  }

  /**
   * Dismiss the warning about invalid data.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onDismissWarning(event) {
    event.currentTarget.classList.toggle("active", false);
  }

  /**
   * Show the warning about invalid data. This is usually just a missing name for the babonus.
   */
  _displayWarning() {
    this.element[0].querySelector("[data-action='dismiss-warning']").classList.toggle("active", true);
  }

  /**
   * Canceling out of the builder.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {BabonusWorkshop}       This application.
   */
  _onCancelBuilder(event) {
    return this._renderClean(event);
  }

  /**
   * Deleting a filter by clicking the trashcan icon.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onDeleteFilter(event) {
    event.currentTarget.closest(".form-group").remove();
    this._updateFilterPicker();
  }

  /**
   * When picking a type to create a new babonus, store the type, remove
   * any stored bab, set the filters, and then toggle the builder on.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onPickType(event) {
    this._renderCreator(event);
  }

  /**
   * Convenience method to update the right-side filter picker and the internal set of filters.
   */
  _updateFilterPicker() {
    //  Update the 'addedFilters' set with what is found in the builder currently.
    this._addedFilters.clear();
    const added = this.element[0].querySelectorAll(".left-side .bonus-filters [data-id]");
    added.forEach(a => this._addedFilters.add(a.dataset.id));

    // Update the filter picker by reading the 'addedFilters' set and toggling the hidden states.
    Object.keys(module.filters).forEach(id => {
      const available = module.filters[id].isFilterAvailable(this._addedFilters, this._currentBabonus);
      const [av, unav] = this.element[0].querySelectorAll(`.right-side .filter[data-id="${id}"]`);
      av.classList.toggle("hidden", !available);
      unav.classList.toggle("hidden", available || this._addedFilters.has(id));
    });
  }

  /**
   * Handle the click event when adding a new filter to the builder.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onAddFilter(event) {
    const id = event.currentTarget.closest(".filter").dataset.id;
    await this._appendNewFilter(id);
    this._updateFilterPicker();
  }

  /**
   * Append one specific filter to the builder.
   * @param {string} id     The id of the filter.
   */
  async _appendNewFilter(id) {
    const DIV = document.createElement("DIV");
    DIV.innerHTML = await this._templateFilter(id);
    this._appendListenersToFilters(DIV);
    this.element[0].querySelector(".left-side .bonus-filters").append(...DIV.children);
  }

  /**
   * Get the inner html of a filter you want to add.
   * @param {string} id             The id of the filter.
   * @returns {Promise<string>}     The template.
   */
  async _templateFilter(id) {
    const field = module.filters[id];
    if (!field.repeatable) return field.render();
    else {
      const nodes = this.element[0].querySelectorAll(`.left-side [data-id="${id}"]`);
      const idx = Math.max(...Array.from(nodes).map(node => node.dataset.idx));
      return field.render(null, idx + 1);
    }
  }

  /**
   * Helper function to append listeners to created form-groups (filters).
   * @param {html} fg     The form-groups created.
   */
  _appendListenersToFilters(fg) {
    fg.querySelectorAll("[data-action='delete-filter']").forEach(n => {
      n.addEventListener("click", this._onDeleteFilter.bind(this));
    });
    fg.querySelectorAll("[data-action='keys-dialog']").forEach(n => {
      n.addEventListener("click", this._onDisplayKeysDialog.bind(this));
    });
  }

  /**
   * Whether this item is one that can be equipped.
   * @param {Item} item     The item being viewed.
   * @returns {boolean}     Whether it can be equipped.
   */
  _canEquipItem(item) {
    return (item instanceof Item) && !!dnd5e.dataModels.item.config[item.type].schema.getField("equipped");
  }

  /**
   * Whether this item has been set as attuned or attunement required.
   * @param {Item} item     The item being viewed.
   * @returns {boolean}     Whether it is or can be attuned to.
   */
  _canAttuneToItem(item) {
    const {REQUIRED, ATTUNED} = CONFIG.DND5E.attunementTypes;
    return (item instanceof Item) && [REQUIRED, ATTUNED].includes(item.system.attunement);
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
   * @param {Document} object         The actor, item, or effect that should have the babonus.
   * @param {Babonus} bonus           The created babonus.
   * @returns {Promise<Document>}     The actor, item, or effect that has received the babonus.
   */
  static async _embedBabonus(object, bonus) {
    await object.update({[`flags.${MODULE.ID}.bonuses.-=${bonus.id}`]: null}, {render: false, noHook: true});
    return object.setFlag(MODULE.ID, `bonuses.${bonus.id}`, bonus.toObject());
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
