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

  /** @override */
  get template() {
    return `modules/${MODULE.ID}/templates/subapplications/optional-selector.hbs`;
  }

  /*************************************/
  /*                                   */
  /*            DATA METHODS           */
  /*                                   */
  /*************************************/

  /**
   * Custom helper method for retrieving all the data for the template.
   * @returns {Promise<object>}
   */
  async getData() {
    const bonuses = [];
    for (const bonus of this.bonuses) {
      const isScaling = bonus.consume.isScaling;
      const isConsuming = bonus.consume.isConsuming;

      const data = {
        tooltip: this._getTooltip(bonus),
        babonus: bonus,
        description: await TextEditor.enrichHTML(bonus.description, {async: true, rollData: bonus.getRollData()})
      };
      if (isConsuming) {
        if (!this._canSupplyMinimum(bonus)) continue;
        const type = ["uses", "quantity"].includes(bonus.consume.type) ? "item" : bonus.consume.type;
        data.action = isScaling ? `consume-${type}-scale` : `consume-${type}`;
        data.options = isScaling ? this._constructScalingOptions(bonus) : null;
      } else {
        data.action = "consume-none";
      }
      bonuses.push(data);
    }

    return {bonuses};
  }

  /**
   * Helper method to activate listeners on the optional bonuses' buttons.
   * @param {HTMLElement} html     The entire list of html injected onto the dialog.
   */
  activateListeners(html) {
    html.querySelectorAll("[data-action^='consume']").forEach(n => {
      n.addEventListener("click", this._onApplyOption.bind(this));
    });
  }

  /**
   * Custom rendering method.
   * @returns {Promise<void>}
   */
  async render() {
    this.form = document.createElement("DIV");
    const data = await this.getData();
    if (!data.bonuses.length) return;
    this.form.innerHTML = await renderTemplate(this.template, data);
    this.activateListeners(this.form);
    const group = this.dialog.element[0].querySelector(".dialog-content > form");
    group.append(this.form.firstElementChild);
    this.dialog.setPosition({height: "auto"});
  }

  /*************************************/
  /*                                   */
  /*          HELPER METHODS           */
  /*                                   */
  /*************************************/

  /**
   * Get a tooltip for an optional bonus' origin.
   * @param {Babonus} bonus     The babonus.
   * @returns {string}          A localized string.
   */
  _getTooltip(bonus) {
    let name;
    const docName = bonus.parent.constructor.documentName;
    if (bonus.parent instanceof MeasuredTemplateDocument) {
      name = game.i18n.localize(`DOCUMENT.${docName}`);
    } else {
      name = `${bonus.parent.name} (${game.i18n.localize(`DOCUMENT.${docName}`)})`;
    }
    return game.i18n.format("BABONUS.OriginName", {name});
  }

  /**
   * Return whether you can consume the minimum requirement to add a bonus.
   * @param {Babonus} bonus     The babonus involved.
   * @returns {boolean}         Whether you have the minimum requirements.
   */
  _canSupplyMinimum(bonus) {
    const min = bonus.consume.value.min || 1;

    if (bonus.consume.type === "uses") {
      return bonus.item.system.uses.value >= min;
    } else if (bonus.consume.type === "quantity") {
      return bonus.item.system.quantity >= min;
    } else if (bonus.consume.type === "slots") {
      return !!this._getLowestValidSpellSlotProperty(bonus);
    } else if (bonus.consume.type === "effect") {
      const effect = bonus.effect;
      return effect.collection.has(effect.id);
    } else if (bonus.consume.type === "health") {
      const hp = this.actor.system.attributes.hp;
      return (hp.value + (hp.temp || 0)) >= min;
    } else if (bonus.consume.type === "currency") {
      const subtype = bonus.consume.subtype;
      const currency = this.actor.system.currency;
      return (currency[subtype] || 0) >= min;
    } else if (bonus.consume.type === "inspiration") {
      return (this.actor.type === "character") && this.actor.system.attributes.inspiration;
    } else if (bonus.consume.type === "resource") {
      // Here we compare for the actor owning the bonus.
      const actor = bonus.actor;
      if ((actor.type !== "character") || !actor.isOwner) return false;
      const subtype = bonus.consume.subtype;
      const resource = actor.system.resources[subtype];
      return (resource.value || 0) >= min;
    }
  }

  /**
   * Return whether you can consume the selected/minimum requirement to add a bonus
   * when attempting to add the bonus and consume the property or document.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {boolean}               Whether the requirement is met.
   */
  _canSupply(event) {
    const bonus = this.bonuses.get(event.currentTarget.closest(".optional").dataset.bonusUuid);
    const scales = event.currentTarget.dataset.action.endsWith("-scale");
    if (!scales) return this._canSupplyMinimum(bonus);
    const type = bonus.consume.type;
    const subtype = bonus.consume.subtype;
    const value = event.currentTarget.closest(".optional").querySelector(".consumption select").value;

    if (type === "uses") {
      return bonus.item.system.uses.value >= Number(value);
    } else if (type === "quantity") {
      return bonus.item.system.quantity >= Number(value);
    } else if (type === "slots") {
      return this.actor.system.spells[value].value > 0;
    } else if (type === "health") {
      const hp = this.actor.system.attributes.hp;
      return (hp.value + (hp.temp || 0)) >= Number(value);
    } else if (type === "currency") {
      const currency = this.actor.system.currency;
      return (currency[subtype] || 0) >= Number(value);
    } else if (type === "inspiration") {
      return (this.actor.type === "character") && this.actor.system.attributes.inspiration;
    } else if (type === "resource") {
      const actor = bonus.actor;
      const subtype = bonus.consume.subtype;
      const resource = actor.system.resources[subtype];
      return (resource.value || 0) >= Number(value);
    }
  }

  /**
   * Display a warning about lack of limited uses, quantity, spell slots, or missing effect.
   * @param {string} type     The consumption type of the babonus.
   */
  _displayConsumptionWarning(type) {
    ui.notifications.warn(`BABONUS.ConsumptionType${type.capitalize()}Unavailable`, {localize: true});
  }

  /**
   * Construct options for a scaling bonus.
   * @param {Babonus} bonus     The bonus.
   * @returns {string}          The string of select options.
   */
  _constructScalingOptions(bonus) {
    switch (bonus.consume.type) {
      case "uses":
      case "quantity": {
        const isUses = bonus.consume.type === "uses";
        const item = bonus.item;
        const bounds = {
          min: isUses ? item.system.uses.value : item.system.quantity,
          max: isUses ? item.system.uses.max : item.system.quantity
        };
        if (bounds.min <= 0) return {};
        const min = bonus.consume.value.min || 1;
        const max = bonus.consume.value.max || Infinity;
        return Array.fromRange(bounds.min, 1).reduce((acc, n) => {
          if (!n.between(min, max)) return acc;
          acc[n] = game.i18n.format("BABONUS.ConsumptionOption", {
            value: n,
            label: game.i18n.format(isUses ? "DND5E.Uses" : "DND5E.Quantity"),
            max: isUses ? `${bounds.min}/${bounds.max}` : bounds.min
          });
          return acc;
        }, {});
      }
      case "slots": {
        // The 'value' of the option is the spell property key, like "spell3" or "pact".
        return Object.entries(this.actor.system.spells).reduce((acc, [key, val]) => {
          if (!val.value || !val.max) return acc;
          const level = (key === "pact") ? val.level : Number(key.at(-1));
          if (level < (bonus.consume.value.min || 1)) return acc;
          const label = game.i18n.format(`DND5E.SpellLevel${(key === "pact") ? "Pact" : "Slot"}`, {
            level: (key === "pact") ? val.level : game.i18n.localize(`DND5E.SpellLevel${level}`),
            n: `${val.value}/${val.max}`,
          });
          acc[key] = label;
          return acc;
        }, {});
      }
      case "health": {
        // The 'value' of the option is the amount of hp to subtract.
        const value = bonus.consume.value;
        const hp = this.actor.system.attributes.hp;
        const min = Math.max(0, hp.value) + Math.max(0, hp.temp);
        const max = Math.max(0, hp.max) + Math.max(0, hp.tempmax);
        if ((min < value.min) || !(value.step > 0)) return {};
        const options = {};
        for (let i = (value.min || 1); i <= Math.min(min, value.max || max); i += value.step) {
          options[i] = game.i18n.format("BABONUS.ConsumptionOption", {
            value: i,
            label: game.i18n.localize("DND5E.HitPoints"),
            max: `${min}/${max}`
          });
        }
        return options;
      }
      case "currency": {
        const value = bonus.consume.value;
        const subtype = bonus.consume.subtype;
        const label = CONFIG.DND5E.currencies[subtype].label;
        const currency = this.actor.system.currency[subtype];
        if ((currency < value.min) || !(value.step > 0)) return {};
        const options = {};
        for (let i = (value.min || 1); i <= Math.min(currency, value.max || Infinity); i += value.step) {
          options[i] = game.i18n.format("BABONUS.ConsumptionOption", {
            value: i,
            label: label,
            max: currency
          });
        }
        return options;
      }
      case "resource": {
        const value = bonus.consume.value;
        const subtype = bonus.consume.subtype;
        const res = bonus.actor.system.resources[subtype];
        if ((res.value < value.min) || !(value.step > 0)) return {};
        const options = {};
        for (let i = (value.min || 1); i <= Math.min(res.value, value.max || Infinity); i += value.step) {
          options[i] = game.i18n.format("BABONUS.ConsumptionOption", {
            value: i,
            label: res.label,
            max: `${res.value}/${res.max}`
          });
        }
        return options;
      }
      default: {
        return null;
      }
    }
  }

  /**
   * Apply an optional bonus. Depending on the bonus, consume a document or property and scale the applied value.
   * @param {PointerEvent} event      The initiating click event.
   */
  async _onApplyOption(event) {
    const target = event.currentTarget;
    target.disabled = true;
    const canSupply = this._canSupply(event);
    const bonus = this.bonuses.get(target.closest(".optional").dataset.bonusUuid);
    const type = bonus.consume.type;
    if (bonus.consume.isConsuming && !canSupply) {
      this._displayConsumptionWarning(type);
      return null;
    }
    const scales = target.dataset.action.endsWith("-scale");
    const {actor, item, effect} = bonus;
    const consumeMin = parseInt(bonus.consume.value.min || 1);
    const consumeMax = bonus.consume.value.max || Infinity;
    const scaleValue = target.closest(".optional").querySelector(".consumption select")?.value;

    switch (type) {
      case "uses":
      case "quantity": {
        const value = scales ? scaleValue : consumeMin;
        const property = {uses: "system.uses.value", quantity: "system.quantity"}[type];
        const newValue = foundry.utils.getProperty(item, property) - parseInt(value);
        if ((newValue === 0) && (type === "uses") && item.system.uses.autoDestroy) {
          const confirm = await item.deleteDialog();
          if (!confirm) {
            target.disabled = false;
            return null;
          }
        } else {
          await item.update({[property]: newValue});
        }
        const scale = scales ? (parseInt(value) - consumeMin) : 0;
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        const apply = this.callHook(bonus, item, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "slots": {
        let key;
        let scale;
        if (scales) {
          key = scaleValue;
          const level = (key === "pact") ? this.actor.system.spells.pact.level : parseInt(key.replace("spell", ""));
          scale = Math.min(level - consumeMin, consumeMax - 1);
        } else {
          key = this._getLowestValidSpellSlotProperty(bonus);
          scale = 0;
        }
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        await this.actor.update({[`system.spells.${key}.value`]: this.actor.system.spells[key].value - 1});
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "health": {
        let value;
        let scale;
        if (scales) {
          value = scaleValue;
          scale = Math.floor((parseInt(value) - consumeMin) / bonus.consume.value.step);
        } else {
          value = consumeMin;
          scale = 0;
        }
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        await this.actor.applyDamage(value);
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "effect": {
        const confirm = await effect.deleteDialog();
        if (!confirm) {
          target.disabled = false;
          return null;
        }
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, effect, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "inspiration": {
        await this.actor.update({"system.attributes.inspiration": false});
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "currency": {
        let value;
        let scale;
        if (scales) {
          value = scaleValue;
          scale = Math.floor((parseInt(value) - consumeMin) / bonus.consume.value.step);
        } else {
          value = consumeMin;
          scale = 0;
        }
        const currency = this.actor.system.currency[bonus.consume.subtype];
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        await this.actor.update({[`system.currency.${bonus.consume.subtype}`]: currency - value});
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      case "resource": {
        let value;
        let scale;
        if (scales) {
          value = scaleValue;
          scale = Math.floor((parseInt(value) - consumeMin) / bonus.consume.value.step);
        } else {
          value = consumeMin;
          scale = 0;
        }
        const resource = actor.system.resources[bonus.consume.subtype];
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        await actor.update({[`system.resources.${bonus.consume.subtype}.value`]: resource.value - value});
        const apply = this.callHook(bonus, actor, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
      default: {
        // Optional bonus that does not consume.
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, null, config);
        this._appendToField(target, config.bonus, apply);
        break;
      }
    }
  }

  /**
   * Return an upscaled bonus given a base and a number to multiply with. If 'scale' is 0, the default bonus is returned
   * and no scaling is performed. Evaluating roll data properties is necessary here, otherwise scaling will not work. But
   * it is not needed for bonuses that do not scale, since their roll data (if necessary) has already been replaced.
   * @param {Babonus} bonus     The babonus.
   * @param {number} scale      The number to upscale by multiplicatively.
   * @returns {string}          The upscaled bonus, simplified, and with the base attached.
   */
  _scaleOptionalBonus(bonus, scale) {
    if (!scale) return bonus.bonuses.bonus;
    const data = this._getRollData(bonus);
    const roll = new CONFIG.Dice.DamageRoll(bonus.consume.formula || bonus.bonuses.bonus, data);
    const formula = roll.alter(scale, 0, {multiplyNumeric: true}).formula;
    const base = Roll.replaceFormulaData(bonus.bonuses.bonus, data);
    return dnd5e.dice.simplifyRollFormula(`${base} + ${formula}`, {preserveFlavor: true});
  }

  /**
   * Appends a bonus to the situational bonus field. If the field is empty, don't add a leading sign.
   * @param {HTMLElement} target        The target of the initiating click event.
   * @param {string} bonus              The bonus to add.
   * @param {boolean} [apply=true]      Whether the bonus should be applied.
   */
  _appendToField(target, bonus, apply = true) {
    if (apply) {
      if (!this.field.value.trim()) this.field.value = bonus;
      else this.field.value = `${this.field.value.trim()} + ${bonus}`;
    }
    target.closest(".optional").classList.toggle("active", true);
    this.dialog.setPosition({height: "auto"});
  }

  /**
   * Get the attribute key for the lowest available and valid spell slot.
   * If the lowest level is both a pact and spell slot, prefer pact slot.
   * @param {Babonus} bonus         The bonus used to determine the minimum spell level required.
   * @returns {string|boolean}      The attribute key, or false if no valid level found.
   */
  _getLowestValidSpellSlotProperty(bonus) {
    const spells = this.actor.system.spells;
    if (!spells) return false; // Vehicle actors do not have spell slots.
    const min = bonus.consume.value.min || 1;
    const pact = spells.pact;
    const max = Object.keys(CONFIG.DND5E.spellLevels).length - 1; // disregard cantrip levels
    for (let i = min; i <= max; i++) {
      if (pact.value && (pact.level === i)) return "pact";
      const spell = spells[`spell${i}`] || {};
      if (spell.value) return `spell${i}`;
    }
    return false;
  }

  /**
   * Construct the roll data for upscaling a bonus. The priority goes origin, then rolling item,
   * then rolling actor. If the bonus originates from the rolling item, the upcast level of the item
   * should be taken into account.
   * @param {Babonus} bonus     The babonus.
   * @returns {object}          The roll data.
   */
  _getRollData(bonus) {
    const src = bonus.origin ?? this.item ?? this.actor;
    const data = src.getRollData();

    if (bonus.parent.uuid === this.item?.uuid) {
      foundry.utils.setProperty(data, "item.level", this.level);
    }

    return data;
  }

  /**
   * A hook that is called after an actor, item, or effect is updated or deleted, but before any bonuses are applied.
   * @param {Babonus} babonus                         The babonus that holds the optional bonus to apply.
   * @param {Actor|Item} roller                       The actor or item performing a roll or usage.
   * @param {Actor|Item|ActiveEffect|null} target     The actor or item that was updated or deleted, if any.
   * @param {object} config
   * @param {string} config.bonus                     The bonus that will be applied.
   * @returns {boolean}                               Explicitly return false to cancel the application of the bonus.
   */
  callHook(babonus, target, config) {
    const roller = this.item ?? this.actor;
    const apply = Hooks.call("babonus.applyOptionalBonus", babonus, roller, target, config);
    return apply !== false;
  }
}
