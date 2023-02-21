import {MODULE} from "../constants.mjs";

export class OptionalSelector {
  constructor(options) {
    // The bonuses.
    this.bonuses = new foundry.utils.Collection(options.optionals.map(o => [o.uuid, o]));

    // The actor doing the roll.
    this.actor = options.actor;

    // The item being rolled.
    this.item = options.item;

    // The spell level of any item being rolled.
    this.level = options.spellLevel;

    // Placeholder variable for the appended content.
    this.form = null;

    // The dialog being appended to.
    this.dialog = options.dialog;

    // The situational bonus field to append bonuses to.
    this.field = this.dialog.element[0].querySelector("[name='bonus']");
  }

  get template() {
    return `modules/${MODULE}/templates/subapplications/optionalBonuses.hbs`;
  }

  /**
   **************************************************
   *
   *                 GET DATA METHODS
   *
   **************************************************
   */

  /** Custom helper method for retrieving all the data for the template. */
  async getData() {
    const bonuses = this.bonuses.reduce((acc, bonus) => {
      let data = null;
      if (bonus.isConsuming) {
        if (["uses", "quantity"].includes(bonus.consume.type)) {
          data = this._getDataConsumeItem(bonus);
        } else if (bonus.consume.type === "slots") {
          data = this._getDataConsumeSlots(bonus);
        } else if (bonus.consume.type === "effect") {
          data = this._getDataConsumeEffects(bonus);
        }
        if (!this._canSupplyMinimum(bonus)) return acc;
      } else {
        data = this._getDataNoConsume(bonus);
      }
      if (data) acc.push(data);
      return acc;
    }, []);

    return {bonuses};
  }

  /**
   * Get the template data for bonuses that consume Limited Uses or Quantity.
   * @param {Babonus} bonus   The bonus that is consuming.
   * @returns {object}        The data for the template.
   */
  _getDataConsumeItem(bonus) {
    const data = {
      action: "consume-item",
      tooltip: this._getTooltip(bonus),
      babonus: bonus
    };
    if (bonus.isScaling) {
      // Must have at least 1 option available.
      data.action += "-scale";
      data.options = this._constructScalingItemOptions(bonus);
      if (!data.options) return null;
    }
    return data;
  }

  /**
   * Get the template data for bonuses that consume Spell Slots.
   * @param {Babonus} bonus   The bonus that is consuming.
   * @returns {object}        The data for the template.
   */
  _getDataConsumeSlots(bonus) {
    const data = {
      action: "consume-slots",
      tooltip: this._getTooltip(bonus),
      babonus: bonus
    };
    if (bonus.isScaling) {
      // Must have at least 1 option available.
      data.action += "-scale";
      data.options = this._constructScalingSlotsOptions(bonus);
      if (!data.options) return null;
    }
    return data;
  }

  /**
   * Get the template data for bonuses that consume Effects.
   * @param {Babonus} bonus   The bonus that is consuming.
   * @returns {object}        The data for the template.
   */
  _getDataConsumeEffects(bonus) {
    const data = {
      action: "consume-effects",
      tooltip: this._getTooltip(bonus),
      babonus: bonus,
    };
    return data;
  }

  /**
   * Get the template data for bonuses that do not consume.
   * @param {Babonus} bonus   The optional bonus.
   * @returns {object}        The data for the template.
   */
  _getDataNoConsume(bonus) {
    const data = {
      action: "no-consume",
      tooltip: this._getTooltip(bonus),
      babonus: bonus
    };
    return data;
  }

  /**
   * Helper method to activate listeners on the optional bonuses' buttons.
   * @param {html} html   The entire list of html injected onto the dialog.
   */
  activateListeners(html) {
    this.form.querySelectorAll("[data-action='consume-item']").forEach(n => n.addEventListener("click", this._onApplyItemOption.bind(this)));
    this.form.querySelectorAll("[data-action='consume-item-scale']").forEach(n => n.addEventListener("click", this._onApplyScalingItemOption.bind(this)));
    this.form.querySelectorAll("[data-action='consume-slots']").forEach(n => n.addEventListener("click", this._onApplySlotsOption.bind(this)));
    this.form.querySelectorAll("[data-action='consume-slots-scale']").forEach(n => n.addEventListener("click", this._onApplyScalingSlotsOption.bind(this)));
    this.form.querySelectorAll("[data-action='consume-effects']").forEach(n => n.addEventListener("click", this._onApplyEffectsOption.bind(this)));
    this.form.querySelectorAll("[data-action='no-consume']").forEach(n => n.addEventListener("click", this._onApplyNoConsumeOption.bind(this)));
  }

  /** Custom rendering method */
  async render() {
    this.form = document.createElement("DIV");
    const data = await this.getData();
    if (!data.bonuses.length) return;
    this.form.innerHTML = await renderTemplate(this.template, data);
    this.activateListeners(this.form);
    const group = this.dialog.element[0].querySelector(".dialog-content > form > .form-group:last-child");
    group.after(this.form.firstElementChild);
    this.dialog.setPosition({height: "auto"});
  }

  /**
   * ************************************************
   *
   *                 HELPER METHODS
   *
   **************************************************
   */

  /**
   * Get a tooltip for an optional bonus' origin.
   * @param {Babonus} bonus    The babonus.
   * @returns {string}         A localized string.
   */
  _getTooltip(bonus) {
    let name;
    if (bonus.parent instanceof MeasuredTemplateDocument) {
      name = game.i18n.localize("DOCUMENT.MeasuredTemplate");
    } else if (bonus.parent instanceof ActiveEffect) {
      name = `${bonus.parent.label} (${game.i18n.localize("DOCUMENT.ActiveEffect")})`;
    } else if (bonus.parent instanceof Actor) {
      name = `${bonus.parent.name} (${game.i18n.localize("DOCUMENT.Actor")})`;
    } else if (bonus.parent instanceof Item) {
      name = `${bonus.parent.name} (${game.i18n.localize("DOCUMENT.Item")})`;
    }
    return game.i18n.format("BABONUS.OriginName", {name});
  }

  /**
   * Return whether you can consume the minimum requirement to add a bonus.
   * @param {Babonus} bonus     The babonus involved.
   * @returns {boolean}         Whether you have the minimum requirements.
   */
  _canSupplyMinimum(bonus) {
    if (bonus.consume.type === "uses") {
      return bonus.item.system.uses.value >= bonus.consume.value.min;
    } else if (bonus.consume.type === "quantity") {
      return bonus.item.system.quantity >= bonus.consume.value.min;
    } else if (bonus.consume.type === "slots") {
      return !!this._getLowestValidSpellSlotProperty(bonus.consume.value.min);
    } else if (bonus.consume.type === "effect") {
      const effect = bonus.effect;
      return effect.collection.has(effect.id);
    }
  }

  /**
   * Display a warning about lack of limited uses, quantity, spell slots, or missing effect.
   * @param {string} type   The consumption type of the babonus.
   */
  _displayConsumptionWarning(type) {
    ui.notifications.warn(`BABONUS.ConsumptionType${type.capitalize()}Unavailable`, {localize: true});
  }

  /**
   * Return whether you can consume the selected requirement to add a bonus.
   * @param {PointerEvent} event    The initiating click event.
   * @returns {boolean}             Whether you can add the bonus.
   */
  _canSupplySelected(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const value = event.currentTarget.closest(".optional").querySelector(".consumption select").value;
    if (bonus.consume.type === "uses") {
      return bonus.item.system.uses.value >= Number(value);
    } else if (bonus.consume.type === "quantity") {
      return bonus.item.system.quantity >= Number(value);
    } else if (bonus.consume.type === "slots") {
      return this.actor.system.spells[value].value > 0;
    }
  }

  /**
   * Construct the scaling options for an optional bonus that scales with limited uses or item quantity.
   * The 'value' of the option is the amount to subtract.
   * @param {Babonus} bonus   The babonus.
   * @returns {string}        The string of select options.
   */
  _constructScalingItemOptions(bonus) {
    const item = bonus.item;
    const bounds = {
      min: bonus.consume.type === "uses" ? item.system.uses.value : item.system.quantity,
      max: bonus.consume.type === "uses" ? item.system.uses.max : item.system.quantity
    };
    if (bounds.min <= 0) return "";
    const min = bonus.consume.value.min || 1;
    const max = bonus.consume.value.max || Infinity;
    return Array.fromRange(bounds.min, 1).reduce((acc, n) => {
      if (!n.between(min, max)) return acc;
      const label = `${n}/${bounds.max}`;
      return acc + `<option value="${n}">${label}</option>`;
    }, "");
  }

  /**
   * When applying a scaling bonus that consumes limited uses or quantity, get the value from the select,
   * get the minimum possible value, and calculate how much it should scale up.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplyScalingItemOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const value = event.currentTarget.closest(".optional").querySelector(".consumption select").value;
    const scale = Number(value) - (bonus.consume.value.min || 1);
    const sitBonus = this._scaleOptionalBonus(bonus, scale);
    const item = bonus.item;
    if (this._canSupplySelected(event)) {
      const property = bonus.consume.type === "uses" ? "system.uses.value" : "system.quantity";
      item.update({[property]: foundry.utils.getProperty(item, property) - Number(value)});
    } else {
      this._displayConsumptionWarning(bonus.consume.type);
      return null;
    }
    this._appendToField(event, sitBonus);
  }

  /**
   * When applying a non-scaling bonus that consumes limited uses or quantity, get the minimum value and consume it.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplyItemOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const value = Number(bonus.consume.value.min || 1);
    const item = bonus.item;
    if (this._canSupplyMinimum(bonus)) {
      const property = bonus.consume.type === "uses" ? "system.uses.value" : "system.quantity";
      item.update({[property]: foundry.utils.getProperty(item, property) - value});
    } else {
      this._displayConsumptionWarning(bonus.consume.type);
      return null;
    }
    const sitBonus = this._scaleOptionalBonus(bonus, 0);
    this._appendToField(event, sitBonus);
  }

  /**
   * Construct the scaling options for an optional bonus that scales with spell slots.
   * The 'value' of the option is the spell property key, like "spell3" or "pact".
   * @param {Babonus} bonus   The babonus.
   * @returns {string}        The string of select options.
   */
  _constructScalingSlotsOptions(bonus) {
    return Object.entries(this.actor.system.spells).reduce((acc, [key, val]) => {
      if (!val.value || !val.max) return acc;
      const level = key === "pact" ? val.level : Number(key.at(-1));
      if (level < (bonus.consume.value.min || 1)) return acc;
      const label = game.i18n.format(`DND5E.SpellLevel${key === "pact" ? "Pact" : "Slot"}`, {
        level: key === "pact" ? val.level : game.i18n.localize(`DND5E.SpellLevel${level}`),
        n: `${val.value}/${val.max}`,
      });
      return acc + `<option value="${key}">${label}</option>`;
    }, "");
  }

  /**
   * When applying a scaling bonus that consumes a spell slot, get the property from the select,
   * and calculate how much it should scale up. The consumed amount is always 1.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplyScalingSlotsOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const key = event.currentTarget.closest(".optional").querySelector(".consumption select").value;
    const level = key === "pact" ? this.actor.system.spells.pact.level : Number(key.at(-1));
    const scale = Math.min(level - (bonus.consume.value.min || 1), (bonus.consume.value.max || Infinity) - 1);
    const sitBonus = this._scaleOptionalBonus(bonus, scale);
    if (this._canSupplySelected(event)) {
      this.actor.update({[`system.spells.${key}.value`]: this.actor.system.spells[key].value - 1});
    } else {
      this._displayConsumptionWarning(bonus.consume.type);
      return null;
    }
    this._appendToField(event, sitBonus);
  }

  /**
   * When applying a non-scaling bonus that consumes a spell slot, get the smallest available
   * spell slot, preferring pact slots if equal levels, then consume 1 slot.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplySlotsOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const key = this._getLowestValidSpellSlotProperty(bonus.consume.value.min || 1);
    if (this._canSupplyMinimum(bonus)) {
      this.actor.update({[`system.spells.${key}.value`]: this.actor.system.spells[key].value - 1});
    } else {
      this._displayConsumptionWarning(bonus.consume.type);
      return null;
    }
    const sitBonus = this._scaleOptionalBonus(bonus, 0);
    this._appendToField(event, sitBonus);
  }

  /**
   * When applying a bonus that consumes an effect, get its id, apply the bonus, and delete it.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplyEffectsOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    if (this._canSupplyMinimum(bonus)) {
      bonus.effect.delete();
    } else {
      this._displayConsumptionWarning(bonus.consume.type);
      return null;
    }
    const sitBonus = this._scaleOptionalBonus(bonus, 0);
    this._appendToField(event, sitBonus);
  }

  /**
   * When applying a bonus that does not consume.
   * @param {PointerEvent} event    The initiating click event.
   */
  _onApplyNoConsumeOption(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const sitBonus = this._scaleOptionalBonus(bonus, 0);
    this._appendToField(event, sitBonus);
  }

  /**
   * Return an upscaled bonus given a base and a number to multiply with.
   * If 'scale' is 0, the default bonus is returned and no scaling is performed.
   * Evaluating roll data properties is necessary here, otherwise scaling will not work.
   * @param {Babonus} bonus     The babonus.
   * @param {number} scale      The number to upscale by multiplicatively.
   * @returns {string}          The upscaled bonus, simplified, and with the base attached.
   */
  _scaleOptionalBonus(bonus, scale) {
    const data = this._getRollData(bonus);
    if (!scale) return new CONFIG.Dice.DamageRoll(bonus.bonuses.bonus, data).formula;
    const roll = new CONFIG.Dice.DamageRoll(bonus.consume.formula || bonus.bonuses.bonus, data);
    const formula = roll.alter(scale, 0, {multiplyNumeric: true}).formula;
    return dnd5e.dice.simplifyRollFormula(`${bonus.bonuses.bonus} + ${formula}`, {preserveFlavor: true});
  }

  /**
   * Appends a bonus to the situational bonus field. If the field is empty, don't add a leading sign.
   * @param {PointerEvent} event    The initiating click event.
   * @param {string} bonus          The bonus to add.
   */
  _appendToField(event, bonus) {
    if (!this.field.value.trim()) this.field.value = bonus;
    else this.field.value = `${this.field.value.trim()} + ${bonus}`;
    event.currentTarget.closest(".optional").classList.toggle("active", true);
    this.dialog.setPosition({height: "auto"});
  }

  /**
   * Get the attribute key for the lowest available and valid spell slot.
   * If the lowest level is both a pact and spell slot, prefer pact slot.
   * @param {number} min    The minimum spell level required.
   * @returns {string}      The attribute key.
   */
  _getLowestValidSpellSlotProperty(min) {
    const spells = this.actor.system.spells;
    const pact = spells.pact.level;
    let level = Infinity;
    const max = Object.keys(CONFIG.DND5E.spellLevels).length - 1; // disregard cantrip levels
    for (let i = min; i <= max; i++) {
      const value = spells[`spell${i}`].value;
      if ((value > 0) && (i < level)) {
        level = i;
        break;
      }
    }
    if (level === Infinity) return false;
    if ((pact > 0) && (pact <= level)) return "system.spells.pact.value";
    return `system.spells.spell${level}.value`;
  }

  /**
   * Construct the roll data for upscaling a bonus. The priority goes origin, then rolling item,
   * then rolling actor. If the bonus originates from the rolling item, the upcast level of the item
   * should be taken into account.
   * @param {Babonus} bonus     The babonus.
   * @returns {object}          The roll data.
   */
  _getRollData(bonus) {
    let data = bonus.origin?.getRollData();
    if (!data && this.item) {
      data = this.item.getRollData();
    } else if (!data) {
      data = this.actor.getRollData();
    }

    if (bonus.parent.uuid === this.item?.uuid) {
      foundry.utils.setProperty(data, "item.level", this.level);
    }

    return data;
  }
}
