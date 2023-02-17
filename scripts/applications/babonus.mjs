import { ARBITRARY_OPERATORS, ATTACK_TYPES, BONUS_TYPES_FORMDATA, EQUIPPABLE_TYPES, FILTER_NAMES, ITEM_ROLL_TYPES, MODULE, MODULE_ICON, TYPES } from "../constants.mjs";
import { _babFromDropData, _createBabonus, _onDisplayKeysDialog, _getAppId, _getBonuses } from "../helpers/helpers.mjs";
import { getId } from "../public_api.mjs";
import { ConsumptionDialog } from "./consumptionApp.mjs";
import { AuraConfigurationDialog } from "./auraConfigurationApp.mjs";

export class BabonusWorkshop extends FormApplication {

  // The right-hand side bonuses that have a collapsed description.
  _collapsedBonuses = new Set();

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
    this.appId = `${this.object.uuid.replaceAll(".", "-")}-babonus-workshop`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      closeOnSubmit: false,
      width: 900,
      height: "auto",
      template: `modules/${MODULE}/templates/babonus.hbs`,
      classes: [MODULE],
      scrollY: [".current-bonuses .bonuses", "div.available-filters", "div.unavailable-filters"],
      dragDrop: [{ dragSelector: ".label[data-action='current-collapse']", dropSelector: ".current-bonuses .bonuses" }],
    });
  }

  get id() {
    return _getAppId(this.object);
  }

  // Whether the builder is active (shown) or not.
  get activeBuilder() {
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
    data.filters = [];

    if (this._bab) {
      // Editing a babonus.
      data.builder = {
        type: TYPES.find(t => t.value === this._bab.type),
        id: this._bab.id,
        intro: "BABONUS.EditingBonus",
        name: this._bab.name,
        description: this._bab.description
      };
      data.bonuses = BONUS_TYPES_FORMDATA[this._bab.type].map(b => {
        return { value: foundry.utils.getProperty(this._bab, b.NAME), ...b };
      });
      const keys = Object.keys(foundry.utils.expandObject(this._bab.toString()).filters ?? {});
      this._addedFilters = new Set(keys);
    } else if (this._type) {
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

    if (this.activeBuilder) {
      for (const id of FILTER_NAMES) {
        if (this._addedFilters.has(id) && (id !== "arbitraryComparison")) continue;
        const filterData = {
          id, header: game.i18n.localize(`BABONUS.Filters${id.capitalize()}`),
          description: `BABONUS.Filters${id.capitalize()}Tooltip`,
          requirements: `BABONUS.Filters${id.capitalize()}Requirements`
        };
        if (this._isFilterAvailable(id)) filterData.available = true;
        data.filters.push(filterData);
      }
      data.filters.sort((a, b) => a.header.localeCompare(b.header));
    }

    data.currentBonuses = _getBonuses(this.object);
    data.TYPES = TYPES;
    data.ICON = MODULE_ICON;

    data.otterColor = this._otterColor;

    return data;
  }

  /** @override */
  async _updateObject(event, formData) {
    if (this._bab) {
      // If editing, get some values from the old babonus.
      formData.id = this._bab.id;
      formData.type = this._bab.type;
      formData.itemOnly = this._bab.itemOnly;
      formData.optional = this._bab.optional;
      formData.consume = this._bab.consume;
      formData.aura = this._bab.aura;
    } else {
      // Generate some default value(s).
      formData.id = this.element[0].querySelector("[name='id']").value;
      formData.type = this._type;
    }

    // Attempt to save the babonus, otherwise show a warning.
    try {
      const bab = _createBabonus(formData, formData.id);
      await this.object.unsetFlag(MODULE, `bonuses.${formData.id}`);
      await this.object.setFlag(MODULE, `bonuses.${formData.id}`, bab.toObject());
      ui.notifications.info(game.i18n.format("BABONUS.NotificationSave", { name: formData.name, id: formData.id }));
    } catch (err) {
      console.warn(err);
      this._displayWarning();
      return;
    }
  }

  // show/hide aura config, and clamp aura range.
  // TODO?
  /** @override */
  async _onChangeInput(event) {

  }

  /** @override */
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

    // Builder methods.
    html[0].querySelector("[data-action='cancel']").addEventListener("click", this._onCancelBuilder.bind(this));
    html[0].querySelectorAll("[data-action='keys-dialog']").forEach(b => b.addEventListener("click", _onDisplayKeysDialog.bind(this)));
    html[0].querySelectorAll("[data-action='pick-type']").forEach(a => a.addEventListener("click", this._onPickType.bind(this)));
    html[0].querySelectorAll("[data-action='delete-filter']").forEach(d => d.addEventListener("click", this._onDeleteFilter.bind(this)));
    html[0].querySelectorAll("[data-action='add-filter']").forEach(a => a.addEventListener("click", this._onAddFilter.bind(this)));
    html[0].querySelector("[data-action='dismiss-warning']").addEventListener("click", this._onDismissWarning.bind(this));

    // Current bonuses.
    html[0].querySelectorAll("[data-action='current-toggle']").forEach(a => a.addEventListener("click", this._onToggleBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-copy']").forEach(a => a.addEventListener("click", this._onCopyBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-edit']").forEach(a => a.addEventListener("click", this._onEditBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-delete']").forEach(a => a.addEventListener("click", this._onDeleteBonus.bind(this)));
    html[0].querySelectorAll("[data-action='current-aura']").forEach(a => a.addEventListener("click", this._onToggleAura.bind(this)));
    html[0].querySelectorAll("[data-action='current-optional']").forEach(a => a.addEventListener("click", this._onToggleOptional.bind(this)));
    html[0].querySelectorAll("[data-action='current-consume']").forEach(a => a.addEventListener("click", this._onToggleConsume.bind(this)));
    html[0].querySelectorAll("[data-action='current-itemOnly']").forEach(a => a.addEventListener("click", this._onToggleExclusive.bind(this)));
    html[0].querySelectorAll("[data-action='current-collapse']").forEach(l => l.addEventListener("click", this._onToggleCollapse.bind(this)));
  }

  /**
   * Canceling out of the builder.
   * @param {PointerEvent} event    The click event.
   */
  _onCancelBuilder(event) {
    this._toggleMode();
  }

  /**
   * Deleting a filter by clicking the trashcan icon.
   * @param {PointerEvent} event    The click event.
   */
  _onDeleteFilter(event) {
    event.currentTarget.closest(".form-group").remove();
    this._updateAddedFilters();
  }

  // Initialize the builder when picking a babonus type.
  _onPickType(event) {
    this._type = event.currentTarget.dataset.type;
    this._bab = null;
    this._addedFilters.clear();
    this._toggleMode();
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

  /* Update the right-side bonuses. */
  async _updateCurrentBonuses() {
    this._saveScrollPositions(this.element);
    this._restoreScrollPositions(this.element);
    this._dragDrop.forEach(d => d.bind(this.element[0])); // rebind drag selectors.
  }

  // paste the values of an existing bonus.

  // TODO... unused?
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

  // method to delete a bonus when hitting the Trashcan button.
  async _onDeleteBonus(event) {
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
  async _onToggleAura(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = getId(this.object, id);
    const path = `bonuses.${id}.aura.enabled`;
    const state = this.object.getFlag(MODULE, path);
    if (bab.isTemplateAura || bab.hasAura) return this.object.setFlag(MODULE, path, false);
    else if (event.shiftKey) return this.object.setFlag(MODULE, path, !state);
    return new AuraConfigurationDialog(this.object, { bab, builder: this }).render(true);
  }

  // toggle the 'self only' property of an item.
  async _onToggleExclusive(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.object.flags.babonus.bonuses[id].itemOnly;
    return this.object.setFlag(MODULE, `bonuses.${id}.itemOnly`, !state);
  }

  // trigger the consumption app, or turn consumption off.
  async _onToggleConsume(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const bab = getId(this.object, id);
    const path = `bonuses.${id}.consume.enabled`;
    const state = this.object.flags.babonus.bonuses[id].consume.enabled;
    if (bab.isConsuming) return this.object.setFlag(MODULE, path, false);
    else if (event.shiftKey) return this.object.setFlag(MODULE, path, !state);
    return new ConsumptionDialog(this.object, { bab }).render(true);
  }

  // toggle the 'is optional' property of a bonus.
  async _onToggleOptional(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const state = this.object.flags.babonus.bonuses[id].optional;
    return this.object.setFlag(MODULE, `bonuses.${id}.optional`, !state);
  }

  // Toggle a bonus between enabled and disabled.
  async _onToggleBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const key = `bonuses.${id}.enabled`;
    const state = this.object.getFlag(MODULE, key);
    if (![true, false].includes(state)) {
      ui.notifications.error("The state of this babonus was invalid.");
      return null;
    }
    return this.object.setFlag(MODULE, key, !state);
  }

  // copy a bonus, with new id, and appended to its name
  async _onCopyBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const data = foundry.utils.duplicate(this.object.flags.babonus.bonuses[id]);
    data.name = game.i18n.format("BABONUS.BonusCopy", { name: data.name });
    data.id = foundry.utils.randomID();
    data.enabled = false;
    await this.object.setFlag(MODULE, `bonuses.${data.id}`, data);
    ui.notifications.info(game.i18n.format("BABONUS.NotificationCopy", data));
  }

  // edit a bonus, with the same id.
  // TODO.
  _onEditBonus(event) {
    const id = event.currentTarget.closest(".bonus").dataset.id;
    const data = this.object.flags.babonus.bonuses[id];
    this._type = null;
    this._bab = _createBabonus(data, id, { strict: true });
    this._addedFilters = new Set(Object.keys(foundry.utils.expandObject(this._bab.toString()).filters ?? {}));
    this._toggleMode();
  }

  /**
   * Create a form-group for each filter on a babonus we are editing.
   */
  async _initializeBuilder() {
    const formData = this._bab.toString();
    const DIV = document.createElement("DIV");
    DIV.innerHTML = "";
    for (const id of this._addedFilters) {
      console.log("Creating a form group for", id);
      DIV.innerHTML += await this._appendNewFilterFormGroup(id, formData);
    }
    this._appendListenersToFilters(DIV);
    this.element[0].querySelector("div.filters").append(...DIV.children);
  }

  /**
   * Dismiss the warning.
   * @param {PointerEvent} event    The click event.
   */
  _onDismissWarning(event) {
    event.currentTarget.classList.toggle("active", false);
  }

  /**
   * Show the warning.
   */
  _displayWarning() {
    this.element[0].querySelector("[data-action='dismiss-warning']").classList.toggle("active", true);
  }

  /**
   * Toggle between builder and overview modes.
   */
  _toggleMode() {
    this.element[0].querySelectorAll(".left-side > *, .right-side > *").forEach(n => {
      n.style.display = n.style.display === "none" ? "" : "none";
    });
  }

  // TODO.
  _saveScrollPositions(html) {
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
  async render(force = false, options = {}) {
    const wasBabUpdate = foundry.utils.hasProperty(options, "data.flags.babonus");
    if (!(wasBabUpdate || force)) return;
    this.object.apps[this.appId] = this;
    return super.render(force, options);
  }

  /** @override */
  close(...T) {
    super.close(...T);
    delete this.object.apps[this.appId];
  }

  /**
   * Reset temporary values on the application when saving a babonus or canceling the builder.
   */
  _deleteTemporaryValues() {
    this._type = null;
    this._bab = null;
    this._addedFilters.clear();
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
   * Update the Set storing current filter names for easy access, and then
   * add or remove the 'hidden' class from the available/unavailable filters.
   */
  _updateAddedFilters() {
    this._addedFilters.clear();
    const added = this.element[0].querySelectorAll(".left-side .filters [data-id]");
    added.forEach(a => this._addedFilters.add(a.dataset.id));
    FILTER_NAMES.forEach(id => {
      const available = this._isFilterAvailable(id);
      const [av, unav] = this.element[0].querySelectorAll(`.right-side .filter[data-id="${id}"]`);
      av.classList.toggle("hidden", !available);
      unav.classList.toggle("hidden", available || this._addedFilters.has(id));
    });
  }

  /**
   * Handle the click event when adding a new filter to the builder.
   * @param {PointerEvent} event    The initiating click event.
   */
  async _onAddFilter(event) {
    const id = event.currentTarget.closest(".filter").dataset.id;
    const DIV = document.createElement("DIV");
    if (id === "arbitraryComparison") DIV.innerHTML = await this._onAddFilterRepeatable(id);
    else DIV.innerHTML = await this._appendNewFilterFormGroup(id);
    this._appendListenersToFilters(DIV);
    this.element[0].querySelector("div.filters").append(...DIV.children);
    this._updateAddedFilters();
  }

  /**
   * Create and append the form-group for a specific filter, then add listeners.
   * @param {string} id         The id of the filter to add.
   * @param {object} formData   The toString'd data of a babonus in case of one being edited.
   * @returns {string}          The template.
   */
  async _appendNewFilterFormGroup(id, formData = null) {
    const data = {
      tooltip: `BABONUS.Filters${id.capitalize()}Tooltip`,
      label: `BABONUS.Filters${id.capitalize()}Label`,
      id,
      appId: this.object.id,
      array: this._newFilterArrayOptions(id),
      value: null
    };

    if (formData) this._prepareData(data, formData);

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

    return renderTemplate(template, data);
  }

  /**
   * Create and append the form-group for a specific repeatable filter, then add listeners.
   * @param {string} id     The id of the filter to add.
   */
  async _onAddFilterRepeatable(id) {
    const idx = this.element[0].querySelectorAll(`.left-side [data-id="${id}"]`).length;
    const DIV = document.createElement("DIV");
    DIV.innerHTML = await renderTemplate("modules/babonus/templates/builder_components/text_select_text.hbs", {
      tooltip: `BABONUS.Filters${id.capitalize()}Tooltip`,
      label: `BABONUS.Filters${id.capitalize()}Label`,
      id, array: [{ idx, selectOptions: ARBITRARY_OPERATORS }]
    });
    this._appendListenersToFilters(DIV);
    this.element[0].querySelector("div.filters").append(...DIV.children);
  }

  /**
   * Helper function to append listeners to created form groups (filters).
   * @param {html} fg   The form-groups created.
   */
  _appendListenersToFilters(fg) {
    fg.querySelectorAll("[data-action='delete-filter']").forEach(n => n.addEventListener("click", this._onDeleteFilter.bind(this)));
    fg.querySelectorAll("[data-action='keys-dialog']").forEach(n => n.addEventListener("click", _onDisplayKeysDialog.bind(this)));
  }

  /**
   * Helper function for array of options.
   * @param {string} id     The name attribute of the filter.
   */
  _newFilterArrayOptions(id) {
    if (id === "attackTypes") {
      return ATTACK_TYPES.map(a => ({ value: a, label: a.toUpperCase(), tooltip: CONFIG.DND5E.itemActionTypes[a] }));
    } else if (id === "itemTypes") {
      return ITEM_ROLL_TYPES.map(i => ({ value: i, label: i.slice(0, 4).toUpperCase(), tooltip: `ITEM.Type${i.titleCase()}` }));
    } else if (id === "spellLevels") {
      return Object.entries(CONFIG.DND5E.spellLevels).map(([value, tooltip]) => ({ value, label: value, tooltip }));
    } else if (id === "spellComponents") {
      return Object.entries(CONFIG.DND5E.spellComponents).concat(Object.entries(CONFIG.DND5E.spellTags)).map(([key, { abbr, label }]) => ({ value: key, label: abbr, tooltip: label }));
    }
  }

  /**
   * Prepare previous values, checked boxes, etc., for a created form-group when a babonus is edited.
   * @param {object} data       The pre-mutated object of handlebars data. ** will be mutated **
   * @param {object} formData   The toString'd data of a babonus in case of one being edited.
   */
  _prepareData(data, formData) {
    if (data.id === "arbitraryComparison") {
      data.array = foundry.utils.duplicate(this._bab.filters[id]).map((n, idx) => ({ idx, ...n }));
    } else if ([
      "abilities",
      "baseWeapons",
      "customScripts",
      "damageTypes",
      "saveAbilities",
      "spellSchools",
      "statusEffects",
      "targetEffects",
      "throwTypes"
    ].includes(data.id)) {
      data.value = formData[`filters.${data.id}`];
    } else if ([
      "creatureTypes",
      "weaponProperties"
    ].includes(data.id)) {
      data.value = { needed: formData[`filters.${data.id}.needed`], unfit: formData[`filters.${data.id}.unfit`] };
    } else if (data.id === "remainingSpellSlots") {
      data.value = { min: formData[`filters.${data.id}.min`], max: formData[`filters.${data.id}.max`] };
    } else if ([
      "attackTypes",
      "itemTypes",
      "spellLevels"
    ].includes(data.id)) {
      const fd = formData[`filters.${data.id}`];
      for (const a of data.array) if (fd.includes(a.value)) a.checked = true;
    } else if (data.id === "itemRequirements") {
      data.array = {
        equipped: formData[`filters.${data.id}.equipped`],
        attuned: formData[`filters.${data.id}.attuned`]
      };
    } else if (data.id === "spellComponents") {
      for (const a of data.array) a.checked = formData[`filters.${data.id}.types`].includes(a.value);
      data.value = formData[`filters.${data.id}.match`];
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
      baseWeapons: true,
      creatureTypes: true,
      customScripts: true,
      damageTypes: ["attack", "damage", "save"].includes(this._type),
      itemRequirements: this._canEquipItem(this.object) || this._canAttuneToItem(this.object),
      itemTypes: ["attack", "damage", "save"].includes(this._type),
      remainingSpellSlots: true,
      saveAbilities: ["save"].includes(this._type),
      spellComponents: true,
      spellLevels: true,
      spellSchools: true,
      statusEffects: true,
      targetEffects: true,
      throwTypes: ["throw"].includes(this._type),
      weaponProperties: true
    }[id] ?? false;
  }
}
