import { BabonusFilterPicker } from "./filterPicker.mjs";
import { FILTER_ITEM_TYPE_REQUIREMENTS, MODULE, MODULE_ICON, TYPES } from "../constants.mjs";
import { KeyGetter, _babFromDropData, _createBabonus, _getAppId } from "../helpers/helpers.mjs";
import { _canAttuneToItem, _canEquipItem, _employFilter } from "../helpers/filterPickerHelpers.mjs";
import { BabonusKeysDialog } from "./keysDialog.mjs";
import { getId } from "../public_api.mjs";

export class BabonusWorkshop extends FormApplication {
  constructor(object, options) {
    super(object, options);
    this.filterPicker = new BabonusFilterPicker(this);
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

  get isEditable() {
    return this.object.sheet.isEditable;
  }

  // gather data for babonus workshop render.
  async getData() {
    const data = await super.getData();

    data.isItem = this.isItem;
    data.isEffect = this.isEffect;
    data.isActor = this.isActor;
    if (data.isItem) {
      data.canEquip = _canEquipItem(this.object);
      data.canAttune = _canAttuneToItem(this.object);
      data.canConfigureTemplate = this.object.hasAreaTarget;
    }
    data.bonuses = await this.filterPicker.getHTMLCurrentBonuses();
    data.TYPES = TYPES;
    data.ICON = MODULE_ICON;

    data.otterColor = this._otterColor ?? "black";

    return data;
  }

  // add the babonus to the object.
  async _updateObject(event, formData) {
    // type must be explicitly set on the data.
    formData.type = this._target;
    formData.itemOnly = !!this._itemOnly;
    formData.optional = !!this._optional;

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
      ui.notifications.info(game.i18n.format("BABONUS.WARNINGS.SUCCESS", { name: formData.name, id: formData.id }));
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
    if (fp) fp.innerHTML = await this.filterPicker.getHTMLFilters();
    this._restoreScrollPositions(this.element);
  }

  // show/hide aura config, and clamp aura range.
  async _onChangeInput(event) {
    await this._rerenderFilters();

    if (event.target.name === "aura.enabled") {
      const body = this.element[0].querySelector(".left-side .aura-config .aura");
      if (event.target.checked) body.innerHTML = await this.filterPicker.getHTMLAura();
      else body.innerHTML = "";
    } else if (event.target.name === "aura.range") {
      event.target.value = Math.clamped(Math.round(event.target.value), -1, 500);
    }
  }

  activateListeners(html) {
    if (!this.isEditable) {
      html[0].style.pointerEvents = "none";
      html[0].classList.add("uneditable");
      return;
    }
    super.activateListeners(html);
    this.filterPicker.activateListeners(html);

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

    // CANCEL button.
    html[0].addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-type='cancel-button']");
      if (!btn) return;
      return this.render();
    });

    // KEYS buttons.
    html[0].addEventListener("click", async (event) => {
      const keyButton = event.target.closest("button.babonus-keys");
      if (!keyButton) return;

      // the containing form-group, which has the 'name' in its dataset.
      const fg = keyButton.closest(".form-group");

      const name = fg.dataset.name;
      const types = foundry.utils.duplicate(KeyGetter[name]);

      // find current semi-colon lists.
      const [list, list2] = fg.querySelectorAll("input[type='text']");
      const values = list.value.split(";");
      const values2 = list2?.value.split(";");
      types.map(t => {
        t.checked = values.includes(t.value);
        t.checked2 = values2?.includes(t.value);
      });
      const data = { description: `BABONUS.TOOLTIPS.${name}`, types };

      const template = `modules/babonus/templates/subapplications/keys${list2 ? "Double" : "Single"}.hbs`;
      const content = await renderTemplate(template, data);
      const title = game.i18n.format("BABONUS.KEYS_DIALOG.HEADER", {
        name: game.i18n.localize(`BABONUS.FILTER_PICKER.${name}.HEADER`)
      });
      const selected = await BabonusKeysDialog.prompt({
        title,
        label: game.i18n.localize("BABONUS.LABELS.APPLY_KEYS"),
        content,
        rejectClose: false,
        options: { name, appId: this.id },
        callback: function(html) {
          const selector = "td:nth-child(2) input[type='checkbox']:checked";
          const selector2 = "td:nth-child(3) input[type='checkbox']:checked";
          const checked = [...html[0].querySelectorAll(selector)];
          const checked2 = [...html[0].querySelectorAll(selector2)];
          return {
            first: checked.map(i => i.id).join(";") ?? "",
            second: checked2.map(i => i.id).join(";") ?? ""
          };
        },
      });

      if (!selected) return;
      if (Object.values(selected).every(a => foundry.utils.isEmpty(a))) return;

      list.value = selected.first;
      if (list2) list2.value = selected.second;
      return;
    });

    // ITEM_ONLY/TOGGLE/COPY/EDIT/DELETE anchors.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".functions a");
      if (!a) return;
      const { type } = a.dataset;
      const { id } = a.closest(".bonus").dataset;

      if (type === "optional") return this._toggleOptional(id);
      else if (type === "itemOnly") return this._toggleItemOnly(id);
      else if (type === "toggle") return this._toggleBonus(id);
      else if (type === "copy") return this._copyBonus(id);
      else if (type === "edit") return this._editBonus(id);
      else if (type === "delete") {
        a.style.pointerEvents = "none";
        const prompt = await this._deleteBonus(id);
        if (a) a.style.pointerEvents = "";
        if (!prompt) return;
      }
    });

    // Collapse description.
    html[0].addEventListener("click", (event) => {
      const label = event.target.closest(".bonus .header .label");
      if (!label) return;
      const bonus = label.closest(".bonus");
      bonus.classList.toggle("collapsed");
    });

    // when you pick a TARGET.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".left-side .select-target .targets a");
      if (!a) return;
      return this._initializeBuilder({ type: a.dataset.type });
    });

    // when you pick an item type, update this._itemTypes.
    html[0].addEventListener("click", (event) => {
      const a = event.target.closest(".form-group[data-name='itemTypes']");
      if (!a) return;
      this._updateItemTypes();
    });

    // when you hit that delete filter button.
    html[0].addEventListener("click", (event) => {
      const a = event.target.closest(".filter-deletion");
      if (!a) return;
      a.closest(".form-group").remove();
      this._updateItemTypes();
      this._updateAddedFilters();
    });

    // click warning away.
    html[0].addEventListener("click", (event) => {
      const el = event.target.closest("#babonus-warning.active");
      if (el) this._displayWarning(false);
    });

  }

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

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const doc = this.object;
    if (!this.isEditable) return false;
    if (doc.uuid === data.uuid) return false;
    const bab = await _babFromDropData(data, doc);
    return doc.setFlag(MODULE, `bonuses.${bab.id}`, bab.toObject());
  }

  // format the UI to show the builder, optionally with current filters when editing an existing babonus.
  async _initializeBuilder({ type, id, addedFilters }) {
    this._target = type;
    this._id = id ?? foundry.utils.randomID();
    this._addedFilters = addedFilters;

    // create html for required fields, bonuses fields, and sometimes the aura field (if existing bonus).
    this.element[0].querySelector(".left-side .required-fields .required").innerHTML = await this.filterPicker.getHTMLRequired(!!addedFilters);
    this.element[0].querySelector(".left-side .bonuses-inputs .bonuses").innerHTML = await this.filterPicker.getHTMLBonuses();
    if (this._formData?.["aura.enabled"]) {
      this.element[0].querySelector(".left-side .aura-config .aura").innerHTML = await this.filterPicker.getHTMLAura();
    }

    // only valid when editing an existing bonus:
    if (this._addedFilters) {
      // create form-groups for each existing filter in the bonus being edited.
      for (const name of addedFilters) await _employFilter(this, name);
      // add the existing babonus's values to the created form-groups.
      await this._initializeExistingBonusValues();
    }

    // hide initial UI:
    const hide = this.element[0].querySelectorAll(".left-side div.select-target, .right-side div.current-bonuses");
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
    this.element[0].querySelector(".right-side .current-bonuses .bonuses").innerHTML = await this.filterPicker.getHTMLCurrentBonuses();
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
    ].map(i => i.dataset.name).filter(i => i?.length > 0));
    this._rerenderFilters();
  }

  /* Helper method that is run every time a filter is added or deleted. */
  _updateItemTypes() {
    const formGroup = this.element[0].querySelector(".left-side .filters .form-group[data-name='itemTypes']");
    const types = formGroup?.querySelectorAll("input[name='filters.itemTypes']:checked") ?? [];
    this._itemTypes = new Set(Array.from(types).map(t => t.value));
    for (const key of Object.keys(FILTER_ITEM_TYPE_REQUIREMENTS)) {
      // if the item type is not present:
      if (!this._itemTypes.has(key) || this._itemTypes.size > 1) {
        for (const name of FILTER_ITEM_TYPE_REQUIREMENTS[key]) {
          const el = this.element[0].querySelector(`.left-side .form-group[data-name="${name}"]`);
          if (el) {
            el.remove();
            this._addedFilters.delete(name);
          }
        }
      }
    }
  }

  // method to delete a bonus when hitting the Trashcan button.
  async _deleteBonus(id) {
    const { name } = this.object.getFlag(MODULE, `bonuses.${id}`);
    const prompt = await Dialog.confirm({
      title: game.i18n.format("BABONUS.DELETE.DELETE_BONUS", { name }),
      content: game.i18n.format("BABONUS.DELETE.ARE_YOU_SURE", { name })
    });
    if (!prompt) return false;
    await this.object.unsetFlag(MODULE, `bonuses.${id}`);
    ui.notifications.info(game.i18n.format("BABONUS.WARNINGS.DELETED", { name, id }));
  }

  // toggle the 'self only' property of an item.
  async _toggleItemOnly(id) {
    const key = `bonuses.${id}.itemOnly`;
    const state = this.object.getFlag(MODULE, key);
    return this.object.setFlag(MODULE, key, !state);
  }

  // toggle the 'is optional' property of a bonus.
  async _toggleOptional(id) {
    const key = `bonuses.${id}.optional`;
    const state = this.object.getFlag(MODULE, key);
    return this.object.setFlag(MODULE, key, !state);
  }

  // toggle a bonus between enabled=true and enabled=false.
  async _toggleBonus(id) {
    const key = `bonuses.${id}.enabled`;
    const state = this.object.getFlag(MODULE, key);
    if (state !== true && state !== false) return ui.notifications.error("The state of this babonus was invalid.");
    return this.object.setFlag(MODULE, key, !state);
  }

  // copy a bonus, with new id, and appended to its name
  async _copyBonus(id) {
    const data = this.object.getFlag(MODULE, `bonuses.${id}`) ?? {};
    const bonusData = foundry.utils.duplicate(data);
    bonusData.name = `${bonusData.name} (Copy)`;
    bonusData.id = foundry.utils.randomID();
    bonusData.enabled = false;
    await this.object.setFlag(MODULE, `bonuses.${bonusData.id}`, bonusData);
    ui.notifications.info(game.i18n.format("BABONUS.WARNINGS.COPIED", {
      name: bonusData.name,
      id: bonusData.id
    }));
  }

  // edit a bonus, with the same id.
  async _editBonus(id) {
    const data = this.object.getFlag(MODULE, `bonuses.${id}`);
    const bab = _createBabonus(data, id, { strict: false });
    const formData = bab.toString();
    const type = bab.type;
    this._formData = formData;
    this._babObject = bab.toObject();
    this._itemOnly = bab.itemOnly;
    this._optional = bab.optional;
    const addedFilters = new Set(Object.keys(foundry.utils.expandObject(formData).filters ?? {}));
    await this._initializeBuilder({ type, id, addedFilters });
    this._updateItemTypes();
    this._updateAddedFilters();
  }

  // helper method to show/hide a warning in the BAB.
  _displayWarning(force) {
    const warning = this.element[0].querySelector("#babonus-warning");
    warning.classList.toggle("active", force);
  }

  _saveScrollPositions(html) {
    const selector = ".right-side .current-bonuses .bonuses .bonus.collapsed";
    const scrolls = html[0].querySelectorAll(selector);
    this._collapsedBonuses = [...scrolls].map(c => c.dataset.id);
    super._saveScrollPositions(html);
  }

  _restoreScrollPositions(html) {
    this._collapsedBonuses?.map(c => {
      const selector = `.right-side .current-bonuses .bonuses .bonus[data-id='${c}']`;
      html[0].querySelector(selector)?.classList.add("collapsed");
    });
    super._restoreScrollPositions(html);
  }

  render(...T) {
    super.render(...T);
    this._deleteTemporaryValues();
    this.object.apps[this.filterPicker.id] = this.filterPicker;
  }

  close(...T) {
    super.close();
    delete this.object.apps[this.filterPicker.id];
  }

  /**
   * Delete temporary values from the BAB.
   * These are only relevant while building a bonus
   * and are used only by the FilterPicker.
   */
  _deleteTemporaryValues() {
    delete this._target;
    delete this._addedFilters;
    delete this._itemTypes;
    delete this._id;
    delete this._formData;
    delete this._babObject;
    delete this._itemOnly;
    delete this._optional;
  }
}
