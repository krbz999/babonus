import { itemsValidForAttackDamageSave, MODULE, targetTypes } from "./constants.mjs";
import { superSlugify, getBonuses, getTargets, KeyGetter } from "./helpers.mjs";
import { dataHasAllRequirements, finalizeData, validateData } from "./validator.mjs";

export class Build_a_Bonus extends FormApplication {
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
      template: `/modules/${MODULE}/templates/build_a_bonus.html`,
      classes: [MODULE]
    });
  }

  get id() {
    return `${MODULE}-build-a-bonus-${this.object.id}`;
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
    }
    data.targets = getTargets();
    data.bonuses = getBonuses(this.object);

    return data;
  }

  async _updateObject(event, formData) {
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

  async _onChangeInput(event) {
    if (event) {
      await super._onChangeInput(event);
      // hide/unhide some elements.
      if (["target", "itemTypes"].includes(event.target.name)) {
        this.refreshForm();
      }
    }
    // enable/disable all shown/hidden elements.
    const inputs = ["INPUT", "SELECT"];
    for (const input of inputs) {
      const elements = this.element[0].getElementsByTagName(input);
      for (const element of elements) {
        element.disabled = element.offsetParent === null;
      }
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    const app = this;

    // KEYS buttons.
    html[0].addEventListener("click", async (event) => {
      const keyButton = event.target.closest("button.babonus-keys");
      if (!keyButton) return;
      const type = keyButton.dataset.type;

      const types = foundry.utils.duplicate(KeyGetter[type]);
      // find list.
      if (type !== "weaponProperties") {
        let input = html[0].querySelector(`[name="filters.${type}"]`);
        if (!input) input = html[0].querySelector(`[name="${type}"]`);
        if (!input) input = html[0].querySelector(`[name="filters.${type}.types"]`); // for spellComps.
        const values = input.value.split(";");
        for (const t of types) {
          t.checked = values.includes(t.value);
        }
      } else {
        const needed = html[0].querySelector(`[name="filters.weaponProperties.needed"]`).value.split(";");
        const unfit = html[0].querySelector(`[name="filters.weaponProperties.unfit"]`).value.split(";");
        // for checkboxes:
        for (const t of types) {
          t.needed = needed.includes(t.value);
          t.unfit = unfit.includes(t.value);
        }
      }

      const template = `/modules/${MODULE}/templates/keys_${type}.hbs`;
      const content = await renderTemplate(template, { types });
      const title = game.i18n.localize(`BABONUS.KEY.${type}_TITLE`);

      const semiList = await app.applyKeys(title, content, type);

      if (semiList === false || foundry.utils.isEmpty(semiList)) return;

      if (type !== "weaponProperties") {
        let input = html[0].querySelector(`[name="filters.${type}"]`);
        if (!input) input = html[0].querySelector(`[name="${type}"]`);
        if (!input) input = html[0].querySelector(`[name="filters.${type}.types"]`); // for spellComps.
        input.value = semiList;
        if (type === "itemTypes") this.refreshForm();
      }
      else {
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
      const { id } = a.closest(".bonus").dataset;

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


    // slugify identifier.
    const idInput = html[0].querySelector("[name='identifier']");
    idInput.addEventListener("change", () => {
      idInput.value = superSlugify(idInput.value);
    });
  }

  // async dialog helper for the Keys dialogs.
  async applyKeys(title, content, type) {
    const app = this;
    class KeysDialog extends Dialog {
      constructor(obj, options) {
        super(obj, options);
        this.object = obj.object;
        this.type = type;
      }
      get id() {
        return `${MODULE}-keys-dialog-${this.object.id}-${this.type}`;
      }
    }
    return new Promise(resolve => {
      new KeysDialog({
        object: app.object, title, content,
        buttons: {
          apply: {
            icon: `<i class="fas fa-check"></i>`,
            label: game.i18n.localize("BABONUS.KEY.APPLY"),
            callback: (html) => {
              const nodes = html[0].querySelectorAll("input[type='checkbox']:checked");
              const checked = Array.from(nodes);
              if (type !== "weaponProperties") {
                const keyString = checked.map(i => i.id).join(";") ?? "";
                resolve(keyString);
              }
              else {
                const needed = checked.filter(i => {
                  return i.dataset.property === "needed";
                }).map(i => i.id).join(";");
                const unfit = checked.filter(i => {
                  return i.dataset.property === "unfit";
                }).map(i => i.id).join(";");
                const res = { needed, unfit };

                resolve(res);
              }
            }
          }
        },
        close: () => resolve(false)
      }).render(true);
    });
  }

  // helper function to only use valid keys when setting flag.
  validateKeys(list, type) {
    if (!list) return [];
    const ids = list.split(";");
    const values = this[type].map(i => i.value);

    // effects are not filtered.
    if (["statusEffects", "targetEffects"].includes(type)) return ids;

    const validIds = ids.filter(i => values.includes(i));
    return validIds;
  }

  // method to take html, gather the inputs, and either update an existing bonus or create a new one.
  async build_a_bonus(formData) {
    // morph the formData.
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
    return true;
  }

  // method to delete a bonus when hitting the Trashcan button.
  async delete_a_bonus(id) {
    const { label } = this.object.getFlag(MODULE, `bonuses.${id}`);

    const prompt = await new Promise(resolve => {
      new Dialog({
        title: game.i18n.format("BABONUS.DELETE.DELETE_BONUS", { label }),
        content: game.i18n.format("BABONUS.DELETE.ARE_YOU_SURE", { label }),
        buttons: {
          yes: {
            icon: `<i class="fas fa-trash"></i>`,
            label: game.i18n.localize("Yes"),
            callback: () => resolve(true)
          },
          no: {
            icon: `<i class="fas fa-times"></i>`,
            label: game.i18n.localize("No"),
            callback: () => resolve(false)
          }
        },
        close: () => resolve(false)
      }).render(true);
    });
    if (!prompt) return false;

    const [target, identifier] = id.split(".");
    return this.object.update({ [`flags.${MODULE}.bonuses.${target}.-=${identifier}`]: null });
  }

  async toggle_a_bonus(id) {
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

  // A helper function to fill out the form with an existing bonus from the document.
  pasteValues(html, flagBonus, id, edit = true) {
    this.clearForm();
    const formData = foundry.utils.flattenObject(flagBonus);

    if (edit) {
      formData.identifier = id.split(".")[1];
    } else {
      formData.label = "";
      formData.identifier = "";
    }
    formData.target = id.split(".")[0];

    // turn arrays into strings.
    for (const key in formData) {
      if (formData[key] instanceof Array) {
        formData[key] = formData[key].join(";");
      }
      const inp = html[0].querySelector(`[name="${key}"]`);
      if (!inp) continue;
      inp.value = formData[key];
    }

    if (!edit) html[0].closest("form.babonus").classList.remove("editMode");
    else html[0].closest("form.babonus").classList.add("editMode");
    this.refreshForm();
  }

  // helper method to populate the BAB with new fields depending on values selected.
  refreshForm() {
    const html = this.element;
    const itemTypeInput = html[0].querySelector("[name='itemTypes']");
    const targetInput = html[0].querySelector("[name='target']");
    const values = itemTypeInput.value.split(";").map(i => i.trim());
    const form = itemTypeInput.closest("form.babonus");
    for (const type of itemsValidForAttackDamageSave) {
      if (itemTypeInput.disabled) form.classList.remove(type);
      else if (values.includes(type)) form.classList.add(type);
    }
    for (const type of targetTypes) {
      if (targetInput.value === type) form.classList.add(type);
      else form.classList.remove(type);
    }
    this.setPosition();
    this._onChangeInput();
  }

  // helper method to clear the form before pasting data.
  clearForm() {
    const elements = this.element[0].getElementsByTagName("INPUT");
    for (const element of elements) element.value = "";
  }

}
