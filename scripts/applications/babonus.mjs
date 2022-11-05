import { AttackBabonus, DamageBabonus, HitDieBabonus, SaveBabonus, ThrowBabonus } from "./dataModel.mjs";
import { BabonusFilterPicker } from "./filterPicker.mjs";
import { itemTypeRequirements, MODULE, TYPES } from "../constants.mjs";
import { superSlugify, KeyGetter, _verifyID } from "../helpers/helpers.mjs";
import { _canAttuneToItem, _canEquipItem } from "../helpers/filterPickerHelpers.mjs";
import { BabonusKeysDialog } from "./keysDialog.mjs";

export class BabonusWorkshop extends FormApplication {
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
      template: `modules/${MODULE}/templates/babonus.hbs`,
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
      data.canEquip = _canEquipItem(this.object);
      data.canAttune = _canAttuneToItem(this.object);
      data.canConfigureTemplate = this.object.hasAreaTarget;
    }
    data.bonuses = await this.filterPicker.getHTMLCurrentBonuses();
    data.TYPES = TYPES;

    return data;
  }

  async _updateObject(event, formData) {
    /*for (const key of Object.keys(formData)) {
      if (!formData[key]) delete formData[key];
      else if (foundry.utils.isEmpty(formData[key])) delete formData[key];
    }*/
    formData.type = this._target;

    // replace id if it is invalid.
    const validId = _verifyID(this._id);
    if (validId === true) formData.id = this._id;
    else {
      this._id = validId;
      formData.id = validId;
    }
    console.log("FORMDATA:", formData);
    console.log("VALID ID:", validId);

    try {
      const BAB = new {
        attack: AttackBabonus,
        damage: DamageBabonus,
        save: SaveBabonus,
        throw: ThrowBabonus,
        hitdie: HitDieBabonus
      }[this._target](formData);
      console.log("BABONUS:", BAB);
      console.log("OBJECT:", BAB.toObject());
      this.displayWarning(false);
      await this.object.unsetFlag(MODULE, `bonuses.${formData.id}`);
      await this.object.setFlag(MODULE, `bonuses.${formData.id}`, BAB.toObject());
      console.log(this.object.flags.babonus.bonuses[formData.id]);
      ui.notifications.info(game.i18n.format("BABONUS.WARNINGS.SUCCESS", { name: formData.name, id: formData.id }));
      return this.render();
    } catch (err) {
      console.error(err);
      this.displayWarning(true);
      return;
    }
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
      const data = {
        description: `BABONUS.TOOLTIPS.${name}`,
        head1: `BABONUS.KEYS_DIALOG.VALUE`,
        head2: `BABONUS.KEYS_DIALOG.CHECK`,
        types
      };

      const template = `modules/babonus/templates/subapplications/keys${list2 ? "Double" : "Single"}.hbs`;
      const content = await renderTemplate(template, data);
      const title = game.i18n.format("BABONUS.KEYS_DIALOG.HEADER", {
        name: game.i18n.localize(`BABONUS.FILTER_PICKER.${name}.HEADER`)
      });
      const selected = await BabonusKeysDialog.prompt({
        title,
        content: await TextEditor.enrichHTML(content, {async: true}),
        rejectClose: false,
        callback: function(html){
          const selector = "td:nth-child(2) input[type='checkbox']:checked";
          const selector2 = "td:nth-child(3) input[type='checkbox']:checked";
          const checked = [...html[0].querySelectorAll(selector)];
          const checked2 = [...html[0].querySelectorAll(selector2)];
          return {
            first: checked.map(i => i.id).join(";") ?? "",
            second: checked2.map(i => i.id).join(";") ?? ""
          };
        }
      }, {name});

      if(!selected) return;
      if(Object.values(selected).every(a => foundry.utils.isEmpty(a))) return;

      list.value = selected.first;
      if(list2) list2.value = selected.second;
      return;
    });

    // TOGGLE/COPY/EDIT/DELETE anchors.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".functions a");
      if (!a) return;
      const { type } = a.dataset;
      const { id } = a.closest(".bonus").dataset;

      if (type === "toggle") return this._toggleBonus(id);
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
      bonus.classList.remove("instant");
      bonus.classList.toggle("collapsed");
    });

    // when you pick a TARGET.
    html[0].addEventListener("click", async (event) => {
      const a = event.target.closest(".left-side .select-target .targets a");
      if (!a) return;
      this._target = a.dataset.type;
      this._id = foundry.utils.randomID();

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

  /* Update the right-side bonuses. */
  async _updateCurrentBonuses() {
    this.element[0].querySelector(".right-side .current-bonuses .bonuses").innerHTML = await this.filterPicker.getHTMLCurrentBonuses();
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

  // method to delete a bonus when hitting the Trashcan button.
  async _deleteBonus(id) {
    const { name } = this.object.getFlag(MODULE, `bonuses.${id}`);
    const prompt = await Dialog.confirm({
      title: game.i18n.format("BABONUS.DELETE.DELETE_BONUS", { name }),
      content: game.i18n.format("BABONUS.DELETE.ARE_YOU_SURE", { name }),
      defaultYes: false
    });
    if (!prompt) return false;
    await this.object.unsetFlag(MODULE, `bonuses.${id}`);
    ui.notifications.info(game.i18n.format("BABONUS.WARNINGS.DELETED", {name,id}));
  }

  // toggle a bonus between enabled=true and enabled=false.
  _toggleBonus(id) {
    const key = `bonuses.${id}.enabled`;
    const state = this.object.getFlag(MODULE, key);
    if (state !== true && state !== false) return ui.notifications.error("The state of this babonus was invalid.");
    return this.object.setFlag(MODULE, key, !state);
  }

  // copy a bonus, with new id, and appended to its name
  async _copyBonus(id){
    const data = this.object.getFlag(MODULE, `bonuses.${id}`) ?? {};
    const bonusData = foundry.utils.duplicate(data);
    bonusData.name = `${bonusData.name} (Copy)`;
    bonusData.id = foundry.utils.randomID();
    bonusData.enabled = false;
    return this.object.setFlag(MODULE, `bonuses.${bonusData.id}`, bonusData);
  }

  // helper method to show/hide a warning in the BAB.
  displayWarning(active = true) {
    const field = this.element[0].querySelector("#babonus-warning");
    if (!active) return field.classList.remove("active");
    else return field.classList.add("active");
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
  }
}