import {MODULE} from "../constants.mjs";

export class OptionalSelector {
  constructor(options) {
    /**
     * The optional bonuses.
     * @type {Collection<Babonus>}
     */
    this.bonuses = new foundry.utils.Collection(options.optionals.map(o => [o.uuid, o]));

    /**
     * All bonuses.
     * @type {Collection<Babonus>}
     */
    this.allBonuses = new foundry.utils.Collection(options.bonuses.map(o => [o.uuid, o]));

    /**
     * The actor performing the roll.
     * @type {Actor5e}
     */
    this.actor = options.actor;

    /**
     * The item being rolled.
     * @type {Item5e}
     */
    this.item = options.item;

    /**
     * The spell level of any item being rolled.
     * @type {number}
     */
    this.level = options.spellLevel;

    /**
     * Placeholder variable for the appended content.
     */
    this.form = null;

    /**
     * The dialog being appended to.
     * @type {Dialog}
     */
    this.dialog = options.dialog;

    /**
     * The situtional bonus field to append bonuses to.
     * @type {HTMLElement}
     */
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

      // For bonuses that consume, skip them if they are invalid.
      if (bonus.consume.enabled) {
        const valid = this.testMinimumConsumption(bonus);
        if (!valid) continue;
      }

      const data = {
        tooltip: this._getTooltip(bonus),
        babonus: bonus,
        description: await TextEditor.enrichHTML(bonus.description, {
          async: true, rollData: bonus.getRollData(), relativeTo: bonus.origin
        })
      };
      if (bonus.consume.enabled) {
        const type = ["uses", "quantity"].includes(bonus.consume.type) ? "item" : bonus.consume.type;
        data.scales = this.doesBonusScale(bonus);
        data.action = data.scales ? `consume-${type}-scale` : `consume-${type}`;
        data.options = data.scales ? this._constructScalingOptions(bonus) : null;
      } else {
        data.action = "consume-none";
      }
      bonuses.push(data);
    }

    return {bonuses};
  }

  /**
   * Does the bonus scale?
   * @param {Babonus} bonus
   * @returns {boolean}
   */
  doesBonusScale(bonus) {
    if (!bonus.consume.scales || !bonus.consume.isValidConsumption) return false;

    // Cannot scale.
    if (["effect", "inspiration"].includes(bonus.consume.type)) return false;

    // Requires step.
    if (["health", "currency"].includes(bonus.consume.type)) return bonus.consume.value.step > 0;

    // The rest scale easily.
    return true;
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
        const entries = Object.entries(this.actor.system.spells).reduce((acc, [k, v]) => {
          if (!v.value || !v.max || !v.level || (v.level < (bonus.consume.value.min || 1))) return acc;
          const isLeveled = /spell[0-9]+/.test(k);
          const label = game.i18n.format(`DND5E.SpellLevel${isLeveled ? "Slot" : k.capitalize()}`, {
            level: isLeveled ? game.i18n.localize(`DND5E.SpellLevel${v.level}`) : v.level,
            n: `${v.value}/${v.max}`
          });
          acc[k] = label;
          return acc;
        }, {});
        return dnd5e.utils.sortObjectEntries(entries);
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
      case "hitdice": {
        const value = bonus.consume.value;
        const subtype = bonus.consume.subtype;
        const hd = this.actor.system.attributes.hd;
        if (["largest", "smallest"].includes(subtype)) {
          return Array.fromRange(Math.min(value.max || Infinity, hd.value) + 1 - value.min, value.min).reduce((acc, n) => {
            acc[n] = game.i18n.format("BABONUS.ConsumptionOption", {
              value: n,
              label: game.i18n.localize(`DND5E.ConsumeHitDice${subtype.capitalize()}`),
              max: `${hd.value}/${hd.max}`
            });
            return acc;
          }, {});
        }
        const max = Math.min(hd.bySize[subtype], value.max ?? Infinity);
        return Array.fromRange(max - value.min + 1, value.min).reduce((acc, n) => {
          acc[n] = game.i18n.format("BABONUS.ConsumptionOption", {
            value: n,
            label: `${game.i18n.localize("DND5E.HitDice")} (${subtype})`,
            max: hd.bySize[subtype]
          });
          return acc;
        }, {});
      }
      default: {
        return null;
      }
    }
  }

  /**
   * Is consumption valid and allowed?
   * @param {Babonus} bonus
   * @returns {boolean}
   */
  testMinimumConsumption(bonus) {
    const target = ["uses", "quantity", "effect"].includes(bonus.consume.type) ? bonus.parent : this.actor;
    return bonus.consume.canActorConsume(this.actor) && bonus.consume.canBeConsumed(target);
  }

  /**
   * Apply an optional bonus. Depending on the bonus, consume a document or property and scale the applied value.
   * @param {Event} event     The initiating click event.
   */
  async _onApplyOption(event) {
    const target = event.currentTarget;
    target.disabled = true;
    const bonus = this.bonuses.get(target.closest(".optional").dataset.bonusUuid);
    const type = (target.dataset.action === "consume-none") ? null : bonus.consume.type;
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
        this._appendToField(bonus, target, config.bonus, apply);
        break;
      }
      case "slots": {
        let key;
        let scale;
        if (scales) {
          key = scaleValue;
          const s = this.actor.system.spells[key];
          scale = Math.min(s.level - consumeMin, consumeMax - 1);
        } else {
          key = this._getLowestValidSpellSlotProperty(bonus);
          scale = 0;
        }
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        await this.actor.update({[`system.spells.${key}.value`]: this.actor.system.spells[key].value - 1});
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(bonus, target, config.bonus, apply);
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
        this._appendToField(bonus, target, config.bonus, apply);
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
        this._appendToField(bonus, target, config.bonus, apply);
        break;
      }
      case "inspiration": {
        await this.actor.update({"system.attributes.inspiration": false});
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(bonus, target, config.bonus, apply);
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
        this._appendToField(bonus, target, config.bonus, apply);
        break;
      }
      case "hitdice": {
        const t = bonus.consume.subtype;
        const denom = !["smallest", "largest"].includes(t) ? t : false;
        let classes = Object.values(this.actor.classes).filter(cls => !denom || (cls.system.hitDice === denom));

        if (["smallest", "largest"].includes(t)) {
          classes = classes.sort((lhs, rhs) => {
            let sort = lhs.system.hitDice.localeCompare(rhs.system.hitDice, "en", {numeric: true});
            if (t === "largest") sort *= -1;
            return sort;
          });
        }

        const updates = [];
        let toConsume = scales ? scaleValue : consumeMin;
        const value = toConsume;
        for (const cls of classes) {
          const available = ((toConsume > 0) ? cls.system.levels : 0) - cls.system.hitDiceUsed;
          const delta = (toConsume > 0) ? Math.min(toConsume, available) : Math.max(toConsume, available);
          if (delta !== 0) {
            updates.push({_id: cls.id, "system.hitDiceUsed": cls.system.hitDiceUsed + delta});
            toConsume -= delta;
            if (toConsume === 0) break;
          }
        }

        await this.actor.updateEmbeddedDocuments("Item", updates);

        const scale = scales ? (parseInt(value) - consumeMin) : 0;
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField(bonus, target, config.bonus, apply);
        break;
      }
      default: {
        // Optional bonus that does not consume.
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, null, config);
        this._appendToField(bonus, target, config.bonus, apply);
        break;
      }
    }
  }

  /**
   * Return an upscaled bonus given a base and a number to multiply with. If 'scale' is 0, the default bonus is returned
   * and no scaling is performed. Evaluating roll data properties is necessary here, otherwise scaling will not work. It is
   * also needed for bonuses that do not scale, since they may be affected by dice modifiers.
   * @param {Babonus} bonus     The babonus.
   * @param {number} scale      The number to upscale by multiplicatively.
   * @returns {string}          The upscaled bonus, simplified, and with the base attached.
   */
  _scaleOptionalBonus(bonus, scale) {
    const bonusFormula = scale ? (bonus.consume.formula || bonus.bonuses.bonus) : bonus.bonuses.bonus;
    const data = this._getRollData(bonus);
    const roll = new CONFIG.Dice.DamageRoll(bonusFormula, data);
    if (!scale) return roll.formula;
    const formula = roll.alter(scale, 0, {multiplyNumeric: true}).formula;
    const base = Roll.replaceFormulaData(bonus.bonuses.bonus, data);
    return dnd5e.dice.simplifyRollFormula(`${base} + ${formula}`, {preserveFlavor: true});
  }

  /**
   * Appends a bonus to the situational bonus field. If the field is empty, don't add a leading sign.
   * @param {Babonus} bab             The Babonus.
   * @param {HTMLElement} target      The target of the initiating click event.
   * @param {string} bonus            The bonus to add.
   * @param {boolean} [apply]         Whether the bonus should be applied.
   */
  _appendToField(bab, target, bonus, apply = true) {
    if (apply) {
      const rollData = this._getRollData(bab);

      // TODO: replace this in 3.2 with new form submission method.
      if (bab.hasDamageType) {
        // Need 'DamageRoll' in case of dice with no '.number', and need
        // to replace roll data to be able to properly append the damage type.
        const roll = new CONFIG.Dice.DamageRoll(bonus, rollData, {type: bab.bonuses.damageType});
        for (const term of roll.terms) if ("flavor" in term.options) {
          if (!term.options.flavor) term.options.flavor = bab.bonuses.damageType;
        }
        bonus = roll.formula;
      }

      const parts = [bonus];
      for (const b of this.allBonuses) {
        const modifiers = b.bonuses.modifiers;
        if (modifiers && !b._halted) modifiers.modifyParts(parts, rollData, {ignoreFirst: true});
      }

      if (!this.field.value.trim()) this.field.value = parts[0];
      else this.field.value = `${this.field.value.trim()} + ${parts[0]}`;
    }
    target.closest(".optional").classList.toggle("active", true);
    this.dialog.setPosition({height: "auto"});
  }

  /**
   * Get the attribute key for the lowest available and valid spell slot. If the lowest level
   * is both a spell slot and a different kind of slot, prefer the alternative.
   * @param {Babonus} bonus         The bonus used to determine the minimum spell level required.
   * @returns {string|boolean}      The attribute key, or false if no valid level found.
   */
  _getLowestValidSpellSlotProperty(bonus) {
    const spells = this.actor.system.spells;
    if (!spells) return false; // Vehicle actors do not have spell slots.
    const min = bonus.consume.value.min || 1;

    const pairs = Object.entries(spells).reduce((acc, [k, v]) => {
      if (!v.value || !v.max || !v.level || (v.level < min)) return acc;
      acc.push([k, v.level]);
      return acc;
    }, []);

    const minData = pairs.reduce((acc, [k, level]) => {
      if (level > acc.level) return acc;
      if (level < acc.level) acc = {level: level};
      acc.keys ??= new Set();
      acc.keys.add(k);
      return acc;
    }, {level: Infinity, keys: new Set()});

    if (!Number.isInteger(minData.level)) return false;

    if (minData.keys.size === 1) return minData.keys.first();

    for (const k of minData.keys) if (k.startsWith("spell")) minData.keys.delete(k);
    return minData.keys.first();
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

    if (bonus.item && (bonus.item.uuid === this.item?.uuid)) {
      foundry.utils.setProperty(data, "item.level", this.level);
    }

    return data;
  }

  /**
   * A hook that is called after an actor, item, or effect is updated or deleted, but before any bonuses are applied.
   * @param {Babonus} babonus                             The babonus that holds the optional bonus to apply.
   * @param {Actor5e|Item5e} roller                       The actor or item performing a roll or usage.
   * @param {Actor5e|Item5e|ActiveEffect5e} [target]      The actor or item that was updated or deleted, if any.
   * @param {object} config
   * @param {string} config.bonus                         The bonus that will be applied.
   * @returns {boolean}                                   Explicitly return false to cancel the application of the bonus.
   */
  callHook(babonus, target, config) {
    const roller = this.item ?? this.actor;
    const apply = Hooks.call("babonus.applyOptionalBonus", babonus, roller, target, config);
    return apply !== false;
  }
}
