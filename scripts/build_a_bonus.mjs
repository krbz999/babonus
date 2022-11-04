import { AttackBabonus, Babonus, DamageBabonus, HitDieBabonus, SaveBabonus, ThrowBabonus } from "./applications/dataModel.mjs";
import { BabonusFilterPicker } from "./applications/filterPicker.mjs";
import { itemsValidForAttackDamageSave, itemTypeRequirements, MODULE, TYPES } from "./constants.mjs";
import { superSlugify, getBonuses, getTargets, KeyGetter } from "./helpers.mjs";
import { BabonusKeysDialog } from "./keys_dialog.mjs";
import { dataHasAllRequirements, finalizeData, validateData } from "./validator.mjs";

export class Build_a_Bonus extends FormApplication {
  constructor(object, options) {
    super(object, options);
    this.filterPicker = new BabonusFilterPicker(this, {});
    this.isItem = object.documentName === "Item";
    this.isEffect = object.documentName === "ActiveEffect";
    this.isActor = object.documentName === "Actor";
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      closeOnSubmit: false,
      width: 900,
      height: "auto",
      template: `modules/${MODULE}/templates/build_a_bonus.hbs`,
      classes: [MODULE],
      scrollY: [".current-bonuses .bonuses", ".available-filters", ".unavailable-filters"]
    });
  }

  get id() {
    return `${MODULE}-${this.object.id}`;
  }

  get isEditable() {
    return this.object.sheet.isEditable;
  }

  async getData() {
    const data = await super.getData();

    data.isItem = this.isItem;
    data.isEffect = this.isEffect;
    data.isActor = this.isActor;
    if (data.isItem) {
      data.canEquip = foundry.utils.hasProperty(this.object, "system.equipped");
      const { REQUIRED, ATTUNED } = CONFIG.DND5E.attunementTypes;
      data.canAttune = [REQUIRED, ATTUNED].includes(this.object.system.attunement);
      data.canConfigureTemplate = this.object.hasAreaTarget;
    }
    data.bonuses = getBonuses(this.object);
    data.TYPES = TYPES;

    return data;
  }

  async _updateObject(event, formData) {
    for (const key of Object.keys(formData)) {
      if (!formData[key]) delete formData[key];
      else if (foundry.utils.isEmpty(formData[key])) delete formData[key];
    }
    formData.type = this._target;
    const BAB = new {
      attack: AttackBabonus,
      damage: DamageBabonus,
      save: SaveBabonus,
      throw: ThrowBabonus,
      hitdie: HitDieBabonus
    }[this._target](formData);
    console.log("BABONUS:", BAB);
    console.log("OBJECT:", BAB.toObject());
    return;
    event.stopPropagation();
    const button = event.submitter;
    if (!button) return;

    // save a bonus.
    if (button.dataset.type === "save-button") {
      const build = await this.build_a_bonus(formData);
      if (!build) return;
    }

    else return;

    this.setPosition();
    this.render()
  }

  async _rerenderFilters() {
    const fp = this.element[0].querySelector(".right-side div.filter-picker");
    if (fp) fp.innerHTML = await this.filterPicker.getHTMLFilters();
  }

  async _onChangeInput(event) {
    await this._rerenderFilters();

    if (event.target.name === "aura.enabled") {
      const body = this.element[0].querySelector(".left-side .aura-config .aura");
      if (event.target.checked) body.innerHTML = await this.filterPicker.getHTMLAura();
      else body.innerHTML = "";
    } else if (event.target.name === "aura.range") {
      event.target.value = Math.clamped(Math.round(event.target.value), -1, 500);
    } else if (event.target.name === "id") {
      event.target.value = superSlugify(event.target.value);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.filterPicker.activateListeners(html);
    const app = this;

    // CANCEL button.
    html[0].addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-type='cancel-button']");
      if (!btn) return;
      return this.render();
    })

    // KEYS buttons.
    html[0].addEventListener("click", async (event) => {
      const keyButton = event.target.closest("button.babonus-keys");
      if (!keyButton) return;
      const type = keyButton.dataset.type;

      const types = foundry.utils.duplicate(KeyGetter[type]);
      // find list.
      if (type !== "weaponProperties") {
        const selector = [
          `[name="filters.${type}"]`,
          `[name="${type}"]`,
          //`[name="filters.${type}.types"]`, // for spellComponents
          `[name="aura.${type}"]` // for aura.blockers
        ].join(", ");
        const input = html[0].querySelector(selector);
        const values = input.value.split(";");
        types.map(t => t.checked = values.includes(t.value));
      } else {
        const needed = html[0].querySelector(`[name="filters.weaponProperties.needed"]`).value.split(";");
        const unfit = html[0].querySelector(`[name="filters.weaponProperties.unfit"]`).value.split(";");
        // for checkboxes:
        types.map(t => {
          t.needed = needed.includes(t.value);
          t.unfit = unfit.includes(t.value);
        });
      }

      const template = `modules/${MODULE}/templates/keys_${type}.hbs`;
      const content = await renderTemplate(template, { types });
      const title = game.i18n.localize(`BABONUS.KEY.${type}_TITLE`);

      const semiList = await app.applyKeys(title, content, type);

      if (semiList === false || foundry.utils.isEmpty(semiList)) return;

      if (type !== "weaponProperties") {
        const selector = [
          `[name="filters.${type}"]`,
          `[name="${type}"]`,
          `[name="filters.${type}.types"]`, // for spellComponents
          `[name="aura.${type}"]` // for aura.blockers
        ].join(", ");
        const input = html[0].querySelector(selector);
        input.value = semiList;
        // refresh form for inputs that have values that reveal more fields.
        if (["itemTypes", "throwTypes"].includes(type)) this.refreshForm();
      } else {
        const needed = html[0].querySelector("[name='filters.weaponProperties.needed']");
        const unfit = html[0].querySelector("[name='filters.weaponProperties.unfit']");
        needed.value = semiList.needed;
        unfit.value = semiList.unfit;
      }
    });

    // TOGGLE/COPY/EDIT/DELETE anchors.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".functions a");
      if (!a) return;
      const { type } = a.dataset;
      const { id } = a.closest(".bonus").dataset; // this is actually "type.id"...

      if (type === "toggle") {
        await this.toggle_a_bonus(id);
        this.setPosition();
        this.render();
        return;
      } else if (type === "copy") {
        const bonus = this.object.getFlag(MODULE, `bonuses.${id}`);
        return this.pasteValues(html, bonus, id, false);
      } else if (type === "edit") {
        const bonus = this.object.getFlag(MODULE, `bonuses.${id}`);
        return this.pasteValues(html, bonus, id, true);
      } else if (type === "delete") {
        a.style.pointerEvents = "none";
        const prompt = await this.delete_a_bonus(id);
        if (a) a.style.pointerEvents = "";
        if (!prompt) return;
        this.setPosition();
        this.render();
      }
    });

    // Collapse description.
    html[0].addEventListener("click", (event) => {
      const label = event.target.closest(".bonus .header .label");
      if (!label) return;
      const bonus = label.closest(".bonus");
      bonus.classList.remove("instant");
      bonus.classList.toggle("collapsed");
    });

    // when you pick a TARGET.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".left-side .select-target .targets a");
      if (!a) return;
      const target = a.dataset.type;
      this._target = target;

      // hide:
      const hide = html[0].querySelectorAll(".left-side div.select-target, .right-side div.current-bonuses");
      for (const h of hide) h.style.display = "none";
      // show:
      const show = html[0].querySelectorAll(".left-side div.inputs, .right-side div.filter-picker");
      for (const s of show) s.style.display = "";

      await this._rerenderFilters();
      html[0].querySelector(".left-side .required-fields .required").innerHTML = await this.filterPicker.getHTMLRequired();
      html[0].querySelector(".left-side .bonuses-inputs .bonuses").innerHTML = await this.filterPicker.getHTMLBonuses();
    });

    // when you pick an item type, update this._itemTypes.
    html[0].addEventListener("click", () => this._updateItemTypes());

    // when you hit that delete filter button.
    html[0].addEventListener("click", (event) => {
      const a = event.target.closest(".filter-deletion");
      if (!a) return;
      a.closest(".form-group").remove();
      this._updateItemTypes();
      this._updateAddedFilters();
    });

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
    const types = this.element[0].querySelectorAll("input[name='filters.itemTypes']:checked");
    this._itemTypes = new Set(Array.from(types).map(t => t.value));
    for (const key of Object.keys(itemTypeRequirements)) {

      // if the item type is not present:
      if (!this._itemTypes.has(key) || this._itemTypes.size > 1) {
        for (const name of itemTypeRequirements[key]) {
          const el = this.element[0].querySelector(`.left-side .form-group[data-name="${name}"]`);
          if (el) {
            el.remove();
            this._addedFilters.delete(name);
          }
        }
      }
    }
  }

  // async dialog helper for the Keys dialogs.
  async applyKeys(title, content, type) {
    return;
    const app = this;
    const apply = {};
    const obj = {
      object: app.object,
      type, title, content,
      buttons: { apply }
    }

    return new Promise(resolve => {

      apply.icon = "<i class='fa-solid fa-check'></i>";
      apply.label = game.i18n.localize("BABONUS.KEY.APPLY");
      apply.callback = (html) => {
        const selector = "input[type='checkbox']:checked";
        const checked = [...html[0].querySelectorAll(selector)];
        if (obj.type !== "weaponProperties") {
          const keyString = checked.map(i => i.id).join(";") ?? "";
          resolve(keyString);
        } else {
          const res = checked.reduce((acc, e) => {
            acc[e.dataset.property].push(e.id);
            return acc;
          }, { needed: [], unfit: [] });
          for (const key in res) res[key] = res[key].join(";");
          resolve(res);
        }
      }
      obj.close = () => resolve(false);

      new BabonusKeysDialog(obj).render(true);
    });
  }

  // helper function to only use valid keys when setting flag.
  validateKeys(list, type) {
    return;
    if (!list) return [];
    const ids = list.split(";");
    const values = this[type].map(i => i.value);

    // effects are not filtered.
    if ([
      "statusEffects",
      "targetEffects",
      "blockers"
    ].includes(type)) return ids;

    return ids.filter(i => values.includes(i));
  }

  // method to take html, gather the inputs, and either update an existing bonus or create a new one.
  async build_a_bonus(formData) {
    return;
    // mutate the formData.
    validateData(formData);

    const editMode = this.element[0].querySelector("form.babonus").classList.contains("editMode");
    const { valid, error } = dataHasAllRequirements(formData, this.object, editMode);

    if (!valid) {
      this.displayWarning(`BABONUS.WARNINGS.${error}`);
      return false;
    }

    const { key, value, del } = finalizeData(formData);

    // remove the warning field.
    this.displayWarning(false);

    // replace the old bonus (does not matter if it existed before).
    await this.object.update({ [del]: null });
    await this.object.setFlag(MODULE, key, value);
    this.element[0].classList.remove("editMode");
    this.element[0].querySelector("[name=identifier]").removeAttribute("tabindex");
    this.element[0].querySelector("[name=target]").removeAttribute("tabindex");
    return true;
  }

  // method to delete a bonus when hitting the Trashcan button.
  async delete_a_bonus(id) {
    return;
    const { label } = this.object.getFlag(MODULE, `bonuses.${id}`);

    const prompt = await Dialog.confirm({
      title: game.i18n.format("BABONUS.DELETE.DELETE_BONUS", { label }),
      content: game.i18n.format("BABONUS.DELETE.ARE_YOU_SURE", { label }),
      defaultYes: false
    });
    if (!prompt) return false;

    const [target, identifier] = id.split(".");
    const path = `flags.${MODULE}.bonuses.${target}.-=${identifier}`
    return this.object.update({ [path]: null });
  }

  async toggle_a_bonus(id) {
    return;
    const key = `bonuses.${id}.enabled`;
    const state = this.object.getFlag(MODULE, key);
    return this.object.setFlag(MODULE, key, !state);
  }

  // helper method to place or remove a warning in the BAB.
  displayWarning(warn) {
    const field = this.element[0].querySelector("#babonus-warning");
    if (warn === false) {
      field.classList.remove("active");
      return true;
    }
    field.innerText = game.i18n.localize(warn);
    field.classList.add("active");
    this.setPosition();
    return false;
  }

  // TODO: A helper function to fill out the form with an existing bonus from the document.
  pasteValues(data) {
    return this.render();
  }

  _saveScrollPositions(html) {
    super._saveScrollPositions(html);
    return;
    const selector = ".current .bonuses .bonus.collapsed";
    const scrolls = html[0].querySelectorAll(selector);
    this._collapsedBonuses = [...scrolls].map(c => c.dataset.id);
  }

  _restoreScrollPositions(html) {
    super._restoreScrollPositions(html);
    return;
    this._collapsedBonuses?.map(c => {
      const selector = `.bonuses .bonus[data-id='${c}']`;
      html[0].querySelector(selector)?.classList.add("collapsed", "instant");
    });
  }

  render(...T) {
    super.render(...T);
    this._deleteTemporaryValues();
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
  }
}
