import { ATTACK_TYPES, BONUS_TYPES_FORMDATA, EQUIPPABLE_TYPES, FILTER_ITEM_TYPE_REQUIREMENTS, FILTER_NAMES, ITEM_ROLL_TYPES, MODULE, MODULE_ICON, TYPES } from "../constants.mjs";
import { _babFromDropData, _createBabonus, _displayKeysDialog, _getAppId, _getBonuses } from "../helpers/helpers.mjs";
import { getId } from "../public_api.mjs";
import { ConsumptionDialog } from "./consumptionApp.mjs";
import { AuraConfigurationDialog } from "./auraConfigurationApp.mjs";

export class BabonusWorkshop extends FormApplication {

  // The right-hand side bonuses that have a collapsed description.
  _collapsedBonuses = new Set();

  // The item types that have been selected in the 'itemTypes' filter.
  _itemTypes = new Set();

  // The ids of the filters that have been added.
  _addedFilters = new Set();

  // The color of the left-side otter.
  _otterColor = "black";

  // The type of babonus being created.
  _type = null;

  // The current babonus being edited.
  _bab = null;

  constructor(object, options) {
    super(object, options);
    this.isItem = object.documentName === "Item";
    this.isEffect = object.documentName === "ActiveEffect";
    this.isActor = object.documentName === "Actor";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      closeOnSubmit: false,
      width: 900,
      height: "auto",
      template: `modules/${MODULE}/templates/babonus.hbs`,
      classes: [MODULE],
      scrollY: [".current-bonuses .bonuses", "div.available-filters", "div.unavailable-filters"],
      dragDrop: [{ dragSelector: "[data-action='bonus-label']", dropSelector: ".current-bonuses .bonuses" }]
    });
  }

  get id() {
    return _getAppId(this.object);
  }

  // Whether the builder is active (shown) or not.
  get activeBuilder(){
    return !!(this._type || this._bab);
  }

  get isEditable() {
    return this.object.sheet.isEditable;
  }

  // gather data for babonus workshop render.
  async getData() {
    const data = await super.getData();

    data.isItem = this.isItem;
    data.isEffect = this.isEffect;
    data.isActor = this.isActor;
    data.activeBuilder = this.activeBuilder;

    if (data.isItem) {
      data.canEquip = this._canEquipItem(this.object);
      data.canAttune = this._canAttuneToItem(this.object);
      data.canConfigureTemplate = this.object.hasAreaTarget;
    }

    // Initial values of the filters.
    data.filters = {available: [], unavailable: []};

    if(this._bab){
      // Editing a babonus.
      data.builder = {
        type: TYPES.find(t => t.value === this._bab.type),
        id: this._bab.id,
        intro: "BABONUS.EditingBonus",
        name: this._bab.name,
        description: this._bab.description
      };
      data.bonuses = BONUS_TYPES_FORMDATA[this._bab.type];
      const keys = Object.keys(foundry.utils.expandObject(this._bab.toString()).filters);
      this._addedFilters = new Set(keys);
    } else if ( this._type){
      // Creating a babonus.
      data.builder = {
        type: TYPES.find(t => t.value === this._type),
        id: foundry.utils.randomID(),
        intro: "BABONUS.CreatingBonus",
        name: null,
        description: null
      };
      data.bonuses = BONUS_TYPES_FORMDATA[this._type];
      this._addedFilters = new Set();
    }

    if(this.activeBuilder){
      for(const id of FILTER_NAMES){
        if(this._addedFilters.has(id) && (id !== "arbitraryComparison")) continue;
        const filterData = {
          id, header: game.i18n.localize(`BABONUS.Filters${id.capitalize()}`),
          description: `BABONUS.Filters${id.capitalize()}Tooltip`,
          requirements: `BABONUS.Filters${id.capitalize()}Requirements`
        };
        if(this._isFilterAvailable(id)) data.filters.available.push(filterData);
        else data.filters.unavailable.push(filterData);
      }
      for(const v of Object.values(data.filters)) {
        v.sort((a,b) => a.header.localeCompare(b.header));
      }
    }

    data.currentBonuses = _getBonuses(this.object);
    data.TYPES = TYPES;
    data.ICON = MODULE_ICON;

    data.otterColor = this._otterColor;

    return data;
  }

  // add the babonus to the object.
  async _updateObject(event, formData) {
    // type must be explicitly set on the data.
    formData.type = this._type;
    formData.itemOnly = !!this._itemOnly;
    formData.optional = !!this._optional;
    formData.consume = this._consume ?? { enabled: false, type: null, value: { min: null, max: null }, scales: false };
    formData.aura = this._aura ?? { enabled: false, range: null, isTemplate: false, blockers: [], self: false };

    // replace id if it is invalid.
    const validId = foundry.data.validators.isValidId(this._id) ? true : foundry.utils.randomID();
    if (validId === true) formData.id = this._id;
    else {
      this._id = validId;
      formData.id = validId;
    }

    try {
      const BAB = _createBabonus(formData, formData.id);
      this._displayWarning(false);
      await this.object.unsetFlag(MODULE, `bonuses.${formData.id}`);
      await this.object.setFlag(MODULE, `bonuses.${formData.id}`, BAB.toObject());
      ui.notifications.info(game.i18n.format("BABONUS.NotificationSave", { name: formData.name, id: formData.id }));
      return this.render();
    } catch (err) {
      console.warn(err);
      this._displayWarning(true);
      return;
    }
  }

  // rerender the available/unavailable filters on the right-hand side.
  async _rerenderFilters() {
    this._saveScrollPositions(this.element);
    const fp = this.element[0].querySelector(".right-side div.filter-picker");
    if (fp) {/** re-render filters */}
    this._restoreScrollPositions(this.element);
  }

  // show/hide aura config, and clamp aura range.
  async _onChangeInput(event) {
    await this._rerenderFilters();
  }

  activateListeners(html) {
    if (!this.isEditable) {
      html[0].style.pointerEvents = "none";
      html[0].classList.add("uneditable");
      return;
    }
    super.activateListeners(html);

    const spin = [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }];
    const time = { duration: 1000, iterations: 1 };
    html[0].addEventListener("click", (event) => {
      const otterA = event.target.closest(".babonus h1 .fa-solid.fa-otter:first-child");
      const otterB = event.target.closest(".babonus h1 .fa-solid.fa-otter:last-child");
      if (otterA) {
        otterA.style.color = "#" + Math.floor(Math.random() * 16777215).toString(16);
        this._otterColor = otterA.style.color;
      }
      else if (otterB && !otterB.getAnimations().length) otterB.animate(spin, time);
    });

    // Canceling out of the builder.
    html[0].querySelector("button[data-action='cancel']").addEventListener("click", this._cancelBuilder.bind(this));

    // Open a helper keys dialog window.
    html[0].querySelectorAll("[data-action='keys-dialog']").forEach(b => b.addEventListener("click", _displayKeysDialog.bind(this)));

    // Toggle whether the babonus consumes an attribute off its parent item or actor.
    html[0].querySelectorAll(".functions a[data-action='consume']").forEach(a => a.addEventListener("click", this._toggleConsume.bind(this)));

    // Toggle whether the babonus is exclusive to its parent item.
    html[0].querySelectorAll(".functions a[data-action='itemOnly']").forEach(a => a.addEventListener("click", this._toggleItemOnly.bind(this)));

    // Toggle whether the bonus is optional.
    html[0].querySelectorAll(".functions a[data-action='optional']").forEach(a => a.addEventListener("click", this._toggleOptional.bind(this)));

    // Toggle the aura of a babonus.
    html[0].querySelectorAll(".functions a[data-action='aura']").forEach(a => a.addEventListener("click", this._toggleAura.bind(this)));

    // Edit a bonus on the document.
    html[0].querySelectorAll(".functions a[data-action='edit']").forEach(a => a.addEventListener("click", this._editBonus.bind(this)));

    // Delete a bonus on the document.
    html[0].querySelectorAll(".functions a[data-action='delete']").forEach(a => a.addEventListener("click", this._deleteBonus.bind(this)));

    // Copy a bonus on the document.
    html[0].querySelectorAll(".functions a[data-action='copy']").forEach(a => a.addEventListener("click", this._copyBonus.bind(this)));

    // Toggle a bonus on or off.
    html[0].querySelectorAll(".functions a[data-action='toggle']").forEach(a => a.addEventListener("click", this._toggleBonus.bind(this)));

    // Collapse description.
    html[0].querySelectorAll(".bonus .header .label").forEach(l => l.addEventListener("click", this._onToggleCollapse.bind(this)));

    // Initialize the builder when picking a babonus type.
    html[0].querySelectorAll(".select-type .types a[data-type]").forEach(a => a.addEventListener("click", this._onPickType.bind(this)));

    // When you pick an item type, update this._itemTypes.
    html[0].querySelectorAll(".form-group[data-id='itemTypes']").forEach(f => f.addEventListener("click", this._updateItemTypes.bind(this)));

    // When you delete a filter.
    html[0].querySelectorAll("[data-action='delete-filter']").forEach(d => d.addEventListener("click", this._onDeleteFilter.bind(this)));

    // When you add a filter.
    html[0].querySelectorAll("[data-action='add-filter']").forEach(a => a.addEventListener("click", this._onAddFilter.bind(this)));

    // Click the warning to make it go away.
    html[0].querySelector("#babonus-warning").addEventListener("click", this._dismissWarning.bind(this));
  }

  /**
   * Canceling out of the builder.
   * @param {PointerEvent} event    The click event.
   */
  _cancelBuilder(event) {
    this.render();
  }

  /**
   * Deleting a filter by clicking the trashcan icon.
   * @param {PointerEvent} event    The click event.
   */
  _onDeleteFilter(event) {
    const fg = event.currentTarget.closest(".form-group");
    const id = fg.dataset.id;
    fg.remove();
    if (id === "itemTypes") this._updateItemTypes();
    this._updateAddedFilters();
  }

  // Initialize the builder when picking a babonus type.
  async _onPickType(event) {
    return this.render(false, {type: event.currentTarget.dataset.type});
  }

  /**
   * Collapse or expand a babonus and its description.
   * @param {PointerEvent} event    The click event.
   */
  _onToggleCollapse(event) {
    const bonus = event.currentTarget.closest(".bonus");
    const id = bonus.dataset.id;
    const has = this._collapsedBonuses.has(id);
    bonus.classList.toggle("collapsed", !has);
    if (has) this._collapsedBonuses.delete(id);
    else this._collapsedBonuses.add(id);
  }

  /** @override */
  _onDragStart(event) {
    const label = event.currentTarget.closest(".bonus");
    let dragData;
    if (label.dataset.id) {
      const bab = getId(this.object, label.dataset.id);
      dragData = bab.toDragData();
    }
    if (!dragData) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /** @override */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const doc = this.object;
    if (!this.isEditable) return false;
    if (doc.uuid === data.uuid) return false;
    const bab = await _babFromDropData(data, doc);
    return doc.setFlag(MODULE, `bonuses.${bab.id}`, bab.toObject());
  }

  // format the UI to show the builder, optionally with current filters when editing an existing babonus.
  async _initializeBuilder({ type, id }) {
    return;
    this._type = type;
    this._id = id ?? foundry.utils.randomID();


    // only valid when editing an existing bonus:
    if (this._addedFilters) {
      // create form-groups for each existing filter in the bonus being edited.
      for (const name of this._addedFilters) await _employFilter(this, name, true);
      // add the existing babonus's values to the created form-groups.
      await this._initializeExistingBonusValues();
    }

    // hide initial UI:
    const hide = this.element[0].querySelectorAll(".left-side div.select-type, .right-side div.current-bonuses");
    for (const h of hide) h.style.display = "none";
    // show builder UI:
    const show = this.element[0].querySelectorAll(".left-side div.inputs, .right-side div.filter-picker");
    for (const s of show) s.style.display = "";

    // update the filters.
    return this._rerenderFilters();
  }

  /* Update the right-side bonuses. */
  async _updateCurrentBonuses() {
    this._saveScrollPositions(this.element);
    this._restoreScrollPositions(this.element);
    this._dragDrop.forEach(d => d.bind(this.element[0])); // rebind drag selectors.
  }

  // paste the values of an existing bonus.
  async _initializeExistingBonusValues() {
    const data = this._formData; // flattened values.
    for (const name of Object.keys(data)) {
      if (data[name] instanceof Array) {
        for (const innerName of data[name]) {
          const el = this.element[0].querySelector(`[name="${name}"][value="${innerName}"]`);
          if (el) el.checked = true;
        }
      } else if (typeof data[name] === "string" || typeof data[name] === "number") {
        const el = this.element[0].querySelector(`[name="${name}"]`);
        if (el) el.value = data[name];
      } else if (typeof data[name] === "boolean") {
        const el = this.element[0].querySelector(`[name="${name}"]`);
        if (el) el.checked = data[name];
      }
    }
  }

  /* Update the Set storing current filter names for easy access. */
  _updateAddedFilters() {
    this._addedFilters = new Set([
      ...this.element[0].querySelectorAll(".left-side .bonus-filters .filters .form-group")
    ].map(i => i.dataset.id).filter(i => i?.length > 0));
    this._rerenderFilters();
  }

  /* Helper method that is run every time a filter is added or deleted. */
  _updateItemTypes() {
    const formGroup = this.element[0].querySelector(".left-side .filters .form-group[data-id='itemTypes']");
    const types = formGroup?.querySelectorAll("input[name='filters.itemTypes']:checked") ?? [];
    this._itemTypes = new Set(Array.from(types).map(t => t.value));
    for (const key of Object.keys(FILTER_ITEM_TYPE_REQUIREMENTS)) {
      // if the item type is not present:
      if (!this._itemTypes.has(key) || this._itemTypes.size > 1) {
        for (const name of FILTER_ITEM_TYPE_REQUIREMENTS[key]) {
          const el = this.element[0].querySelector(`.left-side .form-group[data-id="${name}"]`);
          if (el) {
            el.remove();
            this._addedFilters.delete(name);
          }
        }
      }
    }
  }

  // method to delete a bonus when hitting the Trashcan button.
  async _deleteBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const name = this.object.flags.babonus.bonuses[id].name;
    const prompt = await Dialog.confirm({
      title: game.i18n.format("BABONUS.ConfigurationDeleteTitle", { name }),
      content: game.i18n.format("BABONUS.ConfigurationDeleteAreYouSure", { name }),
      options: { id: `babonus-confirm-delete-${id}` }
    });
    if (!prompt) return false;
    await this.object.unsetFlag(MODULE, `bonuses.${id}`);
    ui.notifications.info(game.i18n.format("BABONUS.NotificationDelete", { name, id }));
  }

  // trigger the aura config app, or turn aura off.
  async _toggleAura(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = getId(this.object, id);
    const path = `bonuses.${id}.aura.enabled`;
    const state = this.object.getFlag(MODULE, path);
    if (bab.isTemplateAura || bab.hasAura) return this.object.setFlag(MODULE, path, false);
    else if (event.shiftKey) return this.object.setFlag(MODULE, path, !state);
    return new AuraConfigurationDialog(this.object, { bab, builder: this }).render(true);
  }

  // toggle the 'self only' property of an item.
  async _toggleItemOnly(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.object.flags.babonus.bonuses[id].itemOnly;
    return this.object.setFlag(MODULE, `bonuses.${id}.itemOnly`, !state);
  }

  // trigger the consumption app, or turn consumption off.
  async _toggleConsume(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = getId(this.object, id);
    const path = `bonuses.${id}.consume.enabled`;
    const state = this.object.flags.babonus.bonuses[id].consume.enabled;
    if (bab.isConsuming) return this.object.setFlag(MODULE, path, false);
    else if (event.shiftKey) return this.object.setFlag(MODULE, path, !state);
    return new ConsumptionDialog(this.object, { bab }).render(true);
  }

  // toggle the 'is optional' property of a bonus.
  async _toggleOptional(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.object.flags.babonus.bonuses[id].optional;
    return this.object.setFlag(MODULE, `bonuses.${id}.optional`, !state);
  }

  // Toggle a bonus between enabled and disabled.
  async _toggleBonus(event) {
    const id = event.currentTarget.closest(".bonus[data-id]").dataset.id;
    const key = `bonuses.${id}.enabled`;
    const state = this.object.getFlag(MODULE, key);
    if (![true, false].includes(state)) {
      ui.notifications.error("The state of this babonus was invalid.");
      return null;
    }
    return this.object.setFlag(MODULE, key, !state);
  }

  // copy a bonus, with new id, and appended to its name
  async _copyBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const data = foundry.utils.duplicate(this.object.flags.babonus.bonuses[id]);
    data.name = game.i18n.format("BABONUS.BonusCopy", { name: data.name });
    data.id = foundry.utils.randomID();
    data.enabled = false;
    await this.object.setFlag(MODULE, `bonuses.${data.id}`, data);
    ui.notifications.info(game.i18n.format("BABONUS.NotificationCopy", data));
  }

  // edit a bonus, with the same id.
  async _editBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const data = this.object.flags.babonus.bonuses[id];
    const bab = _createBabonus(data, id, { strict: false });
    const formData = bab.toString();
    const type = bab.type;
    this._formData = formData;
    this._babObject = bab.toObject();
    this._itemOnly = bab.itemOnly;
    this._optional = bab.optional;
    this._consume = bab.consume;
    this._aura = bab.aura;
    const addedFilters = new Set(Object.keys(foundry.utils.expandObject(formData).filters ?? {}));
    await this._initializeBuilder({ type, id, addedFilters });
    this._updateItemTypes();
    this._updateAddedFilters();
  }

  /**
   * Dismiss the warning.
   * @param {PointerEvent} event    The click event.
   */
  _dismissWarning(event) {
    event.currentTarget.classList.toggle("active", false);
  }

  /**
   * Show the warning.
   */
  _displayWarning() {
    this.element[0].querySelector("#babonus-warning").classList.toggle("active", true);
  }

  /** @override */
  _saveScrollPositions(html) {
    /*const selector = ".right-side .current-bonuses .bonuses .bonus.collapsed";
    const scrolls = html[0].querySelectorAll(selector);
    this._collapsedBonuses = [...scrolls].map(c => c.dataset.id);*/
    super._saveScrollPositions(html);
  }

  /** @override */
  _restoreScrollPositions(html) {
    this._collapsedBonuses.forEach(id => {
      const bonus = html[0].querySelector(`.right-side .bonus[data-id='${id}']`);
      if (bonus) bonus.classList.add("collapsed");
    });
    super._restoreScrollPositions(html);
  }

  /** @override */
  render(force = false, options = {}) {
    if (options.bab) {
      this._bab = options.babonus;
    }else if(options.type){
      this._type = options.type;
    } else {
      this._deleteTemporaryValues();
    }
    super.render(force, options);
  }

  /** @override */
  close(...T) {
    super.close(...T);
  }

  /**
   * Delete temporary values from the BAB. These are only relevant while building a bonus.
   */
  _deleteTemporaryValues() {
    this._addedFilters.clear();
    this._itemTypes.clear();
    this._activeBuilder = false;
    this._type = null;
    this._bab = null;

    /*

    delete this._id;
    delete this._formData;

    delete this._itemOnly;
    delete this._optional;
    delete this._consume;
    delete this._aura;
    */
  }

  /**
   * ----------------------------------------------------
   *
   *
   *                 FILTER PICKER METHODS
   *
   *
   * ----------------------------------------------------
   */

  /**
   * Create and append the form-group for a specific filter.
   * @param {PointerEvent} event   The initiating click event.
   */
  async _onAddFilter(event) {
    const id = event.currentTarget.closest(".filter").dataset.id;
    if (id === "arbitraryComparison") return this._onAddFilterRepeatable(id);

    const data = {
      tooltip: `BABONUS.Filters${id.capitalize()}Tooltip`,
      label: `BABONUS.Filters${id.capitalize()}Label`,
      id,
      appId: this.object.id,
      array: this._newFilterArrayOptions(id)
    };

    const template = ("modules/babonus/templates/builder_components/" + {
      abilities: "text_keys.hbs",
      attackTypes: "checkboxes.hbs",
      baseWeapons: "text_keys.hbs",
      creatureTypes: "text_text_keys.hbs",
      customScripts: "textarea.hbs",
      damageTypes: "text_keys.hbs",
      itemRequirements: "label_checkbox_label_checkbox.hbs",
      itemTypes: "checkboxes.hbs",
      remainingSpellSlots: "text_dash_text.hbs",
      saveAbilities: "text_keys.hbs",
      spellComponents: "checkboxes_select.hbs",
      spellLevels: "checkboxes.hbs",
      spellSchools: "text_keys.hbs",
      statusEffects: "text_keys.hbs",
      targetEffects: "text_keys.hbs",
      throwTypes: "text_keys.hbs",
      weaponProperties: "text_text_keys.hbs"
    }[id]);

    if (id === "spellComponents") {
      data.selectOptions = [
        { value: "ANY", label: "BABONUS.FiltersSpellComponentsMatchAny" },
        { value: "ALL", label: "BABONUS.FiltersSpellComponentsMatchAll" }
      ];
    } else if ("itemRequirements" === id) {
      data.canEquip = this._canEquipItem(this.object);
      data.canAttune = this._canAttuneToItem(this.object);
    }

    const DIV = document.createElement("DIV");
    DIV.innerHTML = await renderTemplate(template, data);
    const fg = this.element[0].querySelector("div.filters").appendChild(...DIV.children);
    return this._appendListenersToFilter(fg);
  }

  /**
   * Employs a single new row of a repeatable filter.
   * @param {string} id     The name attribute of the filter.
   */
  async _onAddFilterRepeatable(id) {
    const idx = this.element[0].querySelectorAll(`.left-side [data-id="${id}"]`).length;
    const DIV = document.createElement("DIV");
    DIV.innerHTML = await renderTemplate("modules/babonus/templates/builder_components/text_select_text.hbs", {
      tooltip: `BABONUS.Filters${id.capitalize()}Tooltip`,
      label: `BABONUS.Filters${id.capitalize()}Label`,
      id, array: [idx]
    });
    const fg = this.element[0].querySelector("div.filters").appendChild(...DIV.children);
    return this._appendListenersToFilter(fg);
  }

  /**
   * Helper function to append listeners to created form groups (filters).
   * @param {html} fg   The form group created.
   */
  _appendListenersToFilter(fg){
    fg.querySelector("[data-action='delete-filter']").addEventListener("click", this._onDeleteFilter.bind(this));
    fg.querySelector("[data-action='keys-dialog']")?.addEventListener("click", _displayKeysDialog.bind(this));
  }

  /**
   * Helper function for array of options.
   * @param {string} id     The name attribute of the filter.
   */
  _newFilterArrayOptions(id) {
    if (id === "attackTypes") {
      return ATTACK_TYPES.map(a => ({ value: a, label: a.toUpperCase(), tooltip: CONFIG.DND5E.itemActionTypes[a] }));
    } else if (id === "itemTypes") {
      return ITEM_ROLL_TYPES.map(i => ({ value: i, label: i.slice(0, 4).toUpperCase(), tooltip: `DND5E.ItemType${i.titleCase()}` }));
    } else if (id === "spellLevels") {
      return Object.entries(CONFIG.DND5E.spellLevels).map(([value, tooltip]) => ({ value, label: value, tooltip }));
    } else if (id === "spellComponents") {
      return Object.entries(CONFIG.DND5E.spellComponents).concat(Object.entries(CONFIG.DND5E.spellTags)).map(([key, { abbr, label }]) => ({ value: key, label: abbr, tooltip: label }));
    }
  }

  /**
 * Whether this item is one that can be equipped.
 * @param {Item5e} item     The item being viewed.
 * @returns {boolean}       Whether it is or can be equipped.
 */
  _canEquipItem(item) {
    return EQUIPPABLE_TYPES.includes(item.type);
  }

  /**
   * Whether this item has been set as attuned or attunement required.
   * @param {Item5e} item     The item being viewed.
   * @returns {boolean}       Whether it is or can be attuned to.
   */
  _canAttuneToItem(item) {
    const { REQUIRED, ATTUNED } = CONFIG.DND5E.attunementTypes;
    return [REQUIRED, ATTUNED].includes(item.system.attunement);
  }

  /**
   * Returns whether a filter is available to be added to babonus.
   * @param {string} id   The id of the filter.
   * @returns {boolean}   Whether the filter can be added.
   */
  _isFilterAvailable(id) {
    if (id === "arbitraryComparison") return true;
    if (this._addedFilters.has(id)) return false;

    return {
      abilities: ["attack", "damage", "save"].includes(this._type),
      attackTypes: ["attack", "damage"].includes(this._type),
      baseWeapons: this._itemTypes.has("weapon") && this._itemTypes.size === 1,
      creatureTypes: true,
      customScripts: true,
      damageTypes: ["attack", "damage", "save"].includes(this._type),
      itemRequirements: this._canEquipItem(this.object) || this._canAttuneToItem(this.object),
      itemTypes: ["attack", "damage", "save"].includes(this._type),
      remainingSpellSlots: true,
      saveAbilities: ["save"].includes(this._type),
      spellComponents: this._itemTypes.has("spell") && this._itemTypes.size === 1,
      spellLevels: this._itemTypes.has("spell") && this._itemTypes.size === 1,
      spellScools: this._itemTypes.has("spell") && this._itemTypes.size === 1,
      statusEffects: true,
      targetEffects: true,
      throwTypes: ["throw"].includes(this._type),
      weaponProperties: this._itemTypes.has("weapon") && this._itemTypes.size === 1
    }[id] ?? false;
  }
}
