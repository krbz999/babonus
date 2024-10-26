import {MODULE} from "../constants.mjs";
import {Babonus} from "../models/babonus-model.mjs";
import registry from "../registry.mjs";

export default class OptionalSelector {
  /**
   * @constructor
   * @param {string} id     Id for the registry.
   */
  constructor(id) {
    const registered = registry.get(id);
    this.#id = id;
    this.#registry = registered;

    /* -------------------------------------------------- */

    /**
     * The optional bonuses.
     * @type {Collection<Babonus>}
     */
    this.optionals = registered.bonuses.optionals;

    /* -------------------------------------------------- */

    /**
     * The bonuses that just serve as reminders
     * @type {Collection<Babonus>}
     */
    this.reminders = registered.bonuses.reminders;

    /* -------------------------------------------------- */

    /**
     * The actor performing the roll.
     * @type {Actor5e}
     */
    this.actor = registered.actor;

    /* -------------------------------------------------- */

    /**
     * The item being used.
     * @type {Item5e|void}
     */
    this.item = registered.item;

    /* -------------------------------------------------- */

    /**
     * The activity being used.
     * @type {Activity|void}
     */
    this.activity = registered.activity;

    /* -------------------------------------------------- */

    /**
     * The spell level of any item being rolled.
     * @type {number}
     */
    this.level = registered.spellLevel;

    /* -------------------------------------------------- */

    /**
     * Placeholder variable for the appended content.
     * @type {HTMLElement}
     */
    this.form = null;

    /* -------------------------------------------------- */

    /**
     * The dialog being appended to.
     * @type {Dialog}
     */
    this.dialog = registered.dialog;
  }

  /* -------------------------------------------------- */

  /**
     * The retrieved registry.
     * @type {object}
     */
  #registry = null;

  /* -------------------------------------------------- */

  /**
   * The id used to register data for this optional selector.
   * @type {string}
   */
  #id = null;

  /* -------------------------------------------------- */

  /** @override */
  get template() {
    return `modules/${MODULE.ID}/templates/subapplications/optional-selector.hbs`;
  }

  /* -------------------------------------------------- */

  /**
   * The situational bonus field to append bonuses to.
   * @type {HTMLElement}
   */
  get field() {
    return this.dialog.element[0]?.querySelector?.("[name=bonus]") ?? null;
  }

  /* -------------------------------------------------- */

  /**
   * Custom helper method for retrieving all the data for the template.
   * @returns {Promise<object>}
   */
  async getData() {
    const bonuses = [];
    for (const bonus of this.optionals) {

      // For bonuses that consume, skip them if they are invalid.
      if (bonus.consume.enabled) {
        const valid = this.testMinimumConsumption(bonus);
        if (!valid) continue;
      }

      const data = {
        tooltip: this._getTooltip(bonus),
        babonus: bonus,
        name: bonus.name.replaceAll("'", "\\'"),
        label: `BABONUS.OptionalSelector.Label${bonus.consume.enabled ? "Consume" : "Apply"}`,
        description: await TextEditor.enrichHTML(bonus.description, {
          rollData: bonus.getRollData(), relativeTo: bonus.origin
        })
      };
      if (bonus.consume.enabled) {
        const type = ["uses", "quantity"].includes(bonus.consume.type) ? "item" : bonus.consume.type;
        data.scales = this.doesBonusScale(bonus);
        data.action = data.scales ? `consume-${type}-scale` : `consume-${type}`;
        data.options = data.scales ? this._constructScalingOptions(bonus) : null;

        data.scaleValue = new foundry.data.fields.StringField({required: true, choices: data.options});
        data.scaleDataset = {select: "scaleValue"};
      } else {
        data.action = "consume-none";
      }

      // Has multiple damage types
      if (bonus.bonuses.damageType?.size > 1) {
        const choices = {};
        for (const type of bonus.bonuses.damageType) {
          const label = CONFIG.DND5E.damageTypes[type].label;
          if (label) choices[type] = label;
        }
        data.damageTypes = new foundry.data.fields.StringField({required: true, choices: choices});
        data.damageTypeDataset = {select: "damageType"};
      }

      bonuses.push(data);
    }

    const reminders = [];
    for (const reminder of this.reminders) {
      reminders.push({
        uuid: reminder.uuid,
        name: reminder.name.replaceAll("'", "\\'"),
        description: await TextEditor.enrichHTML(reminder.description, {
          rollData: reminder.getRollData(), relativeTo: reminder.origin
        })
      });
    }

    return {bonuses, reminders};
  }

  /* -------------------------------------------------- */

  /**
   * Does the bonus scale?
   * @param {Babonus} bonus     A bonus to test.
   * @returns {boolean}         Whether it is set up to scale.
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

  /* -------------------------------------------------- */

  /**
   * Helper method to activate listeners on the optional bonuses' buttons.
   * @param {HTMLElement} html     The entire list of html injected onto the dialog.
   */
  activateListeners(html) {
    html.querySelectorAll("[data-action^='consume']").forEach(n => {
      n.addEventListener("click", this._onApplyOption.bind(this));
    });
  }

  /* -------------------------------------------------- */

  /**
   * Custom rendering method.
   * @returns {Promise}
   */
  async render() {
    const isV2 = !!this.dialog.element?.classList?.contains("dnd5e2");
    this.form = document.createElement(isV2 ? "FIELDSET" : "DIV");

    if (isV2) this.form.insertAdjacentHTML("beforeend", "<legend>Build-a-Bonus</legend>");
    this.form.classList.add("babonus", "optionals");

    const data = await this.getData();
    if (!data.bonuses.length && !data.reminders.length) return;
    data.isV2 = isV2;
    this.form.insertAdjacentHTML("beforeend", await renderTemplate(this.template, data));
    this.activateListeners(this.form);

    if (isV2) {
      const group = this.dialog.element.querySelector("fieldset[data-application-part=configuration]");
      group.insertAdjacentElement("afterend", this.form);
    } else {
      const group = this.dialog.element[0].querySelector(".dialog-content > form");
      group.append(this.form);
      this.dialog.setPosition({height: "auto"});
    }

    registry.delete(this.#id);
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * Display a warning about lack of limited uses, quantity, spell slots, or missing effect.
   * @param {string} type     The consumption type of the babonus.
   */
  _displayConsumptionWarning(type) {
    ui.notifications.warn(`BABONUS.Warning.Consuming.${type.capitalize()}Unavailable`, {localize: true});
  }

  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * Is consumption valid and allowed?
   * @param {Babonus} bonus
   * @returns {boolean}
   */
  testMinimumConsumption(bonus) {
    const target = ["uses", "quantity", "effect"].includes(bonus.consume.type) ? bonus.parent : this.actor;
    return bonus.consume.canActorConsume(this.actor) && bonus.consume.canBeConsumed(target);
  }

  /* -------------------------------------------------- */

  /**
   * Apply an optional bonus. Depending on the bonus, consume a document or property and scale the applied value.
   * @param {Event} event     The initiating click event.
   */
  async _onApplyOption(event) {
    const target = event.currentTarget;
    target.disabled = true;
    const bonus = this.optionals.get(target.closest(".optional").dataset.bonusUuid);
    const type = (target.dataset.action === "consume-none") ? null : bonus.consume.type;
    const scales = target.dataset.action.endsWith("-scale");
    const {actor, item, effect} = bonus;
    const consumeMin = parseInt(bonus.consume.value.min || 1);
    const consumeMax = bonus.consume.value.max || Infinity;
    const scaleValue = target.closest(".optional").querySelector("[data-select=scaleValue]")?.value;

    // Set the damage type.
    let damageType;
    if (bonus.type === "damage") {
      damageType = target.closest(".optional").querySelector("[data-select=damageType]")?.value;
      if (!damageType && bonus.bonuses.damageType.size) damageType = bonus.bonuses.damageType.first();
    }

    switch (type) {
      case "uses":
      case "quantity": {
        const value = parseInt(scales ? scaleValue : consumeMin);

        let property;
        let newValue;
        if (type === "uses") {
          property = "system.uses.spent";
          newValue = item.system.uses.spent + value;
        } else {
          property = "system.quantity";
          newValue = item.system.quantity - value;
        }
        if ((newValue === 0) && (type === "uses") && item.system.uses.autoDestroy) {
          const confirm = await item.deleteDialog();
          if (!confirm) {
            target.disabled = false;
            return null;
          }
        } else {
          await item.update({[property]: newValue});
        }
        const scale = scales ? (value - consumeMin) : 0;
        const config = {bonus: this._scaleOptionalBonus(bonus, scale)};
        const apply = this.callHook(bonus, item, config);
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale});
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
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale});
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
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale});
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
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale: 0});
        break;
      }
      case "inspiration": {
        await this.actor.update({"system.attributes.inspiration": false});
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, this.actor, config);
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale: 0});
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
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale});
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
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale});
        break;
      }
      default: {
        // Optional bonus that does not consume.
        const config = {bonus: this._scaleOptionalBonus(bonus, 0)};
        const apply = this.callHook(bonus, null, config);
        this._appendToField({babonus: bonus, target, bonus: config.bonus, apply, damageType, scale: 0});
        break;
      }
    }
  }

  /* -------------------------------------------------- */

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
    const data = this._getRollData(bonus, scale);
    const roll = new CONFIG.Dice.DamageRoll(bonusFormula, data);
    if (!scale) return roll.formula;
    const formula = roll.alter(scale, 0, {multiplyNumeric: true}).formula;
    const base = Roll.replaceFormulaData(bonus.bonuses.bonus, data);
    return dnd5e.dice.simplifyRollFormula(`${base} + ${formula}`, {preserveFlavor: true});
  }

  /* -------------------------------------------------- */

  /**
   * Appends a bonus to the situational bonus field. If the field is empty, don't add a leading sign.
   * On the new roll configuration dialog, simply append to a roll's parts rather than paste into the field.
   * @param {object} config                   Appending configuration data.
   * @param {Babonus} config.babonus          The Babonus.
   * @param {HTMLElement} config.target       The target of the initiating click event.
   * @param {string} [config.bonus]           The bonus to add (not required if the type supports modifiers).
   * @param {boolean} [config.apply]          Whether the bonus should be applied.
   * @param {string} [config.damageType]      A selected damage type (required if a damage bonus).
   * @param {number} [scale]                  Upscaling property.
   */
  _appendToField({babonus, target, bonus, apply = true, damageType, scale = 0}) {
    if (!apply) return;
    this.#applyPropertyModifications(babonus, scale);
    this.#applyAdditiveBonus(babonus, bonus, damageType, scale);
    this.#applyDiceModifications(babonus, scale);
    this.dialog.rebuild?.(); // TODO: no optional chaining needed in 4.1 when all dialogs are the same.
    target.closest(".optional").classList.toggle("active", true);
  }

  /* -------------------------------------------------- */

  /**
   * Apply property modifications such as critical threshold.
   * @param {Babonus} bonus       The bonus being applied.
   * @param {number} [scale]      Upscaling property.
   */
  #applyPropertyModifications(bonus, scale) {
    const config = this.dialog.config;
    const rollData = this._getRollData(bonus, scale);

    switch (bonus.type) {
      case "damage":
        if (!config.critical) config.critical = {};
        if (bonus.bonuses.criticalBonusDamage) {
          const addition = Roll.replaceFormulaData(bonus.bonuses.criticalBonusDamage, rollData);
          config.critical.bonusDamage = config.critical.bonusDamage ?
            `${config.critical.bonusDamage} + ${addition}` :
            addition;
        }
        if (bonus.bonuses.criticalBonusDice) {
          const addition = Roll.create(bonus.bonuses.criticalBonusDice, rollData).evaluateSync({strict: false}).total;
          config.critical.bonusDice = config.critical.bonusDice ? config.critical.bonusDice + addition : addition;
        }
    }
  }

  /* -------------------------------------------------- */

  /**
   * Apply the additive bonus of a babonus when it is toggled active.
   * @param {Babonus} babonus         The bonus being toggled active.
   * @param {string} bonus            The additive bonus.
   * @param {string} [damageType]     A selected damage type (required if damage bonus).
   * @param {number} [scale]          Upscaling property.
   */
  #applyAdditiveBonus(babonus, bonus, damageType, scale) {
    if (!babonus.hasAdditiveBonus) return;

    // TODO: get rid of using this old field from the old roll config dialog in 4.1
    const field = this.field;

    if (field) {
      if (!field.value.trim()) field.value = bonus;
      else field.value = `${field.value.trim()} + ${bonus}`;
      return;
    }

    const roll = this.dialog.config.rolls.find(config => {
      if (!damageType) return true;
      const types = config.options.types;
      return (types.length === 1) && (types[0] === damageType);
    });

    if (roll) roll.parts.push(bonus);
    else {
      this.dialog.config.rolls.push({
        data: this._getRollData(babonus, scale),
        parts: [bonus],
        options: {
          properties: [...this.dialog.config.rolls[0].options.properties ?? []],
          type: damageType,
          types: [damageType]
        }
      });
    }
  }

  /* -------------------------------------------------- */

  /**
   * Apply dice modifiers to all parts in the roll config.
   * @param {Babonus} babonus     A new bonus being toggled active.
   * @param {number} [scale]      Upscaling property.
   */
  #applyDiceModifications(babonus, scale) {
    // Store for later if other additive bonuses get added.
    if (babonus.hasDiceModifiers) this.#registry.modifiers.set(babonus.uuid, babonus);

    for (const bonus of this.#registry.modifiers) {
      const rollData = this._getRollData(bonus, scale);
      for (const {parts, data, options} of this.dialog.config.rolls) {
        if (bonus._halted) break;
        const halted = bonus.bonuses.modifiers.modifyParts(parts, data ?? rollData);
        if (halted) bonus._halted = true;

        // Modify critical bonus damage.
        if ((babonus.type === "damage") && !bonus._halted && options.critical?.bonusDamage) {
          const parts = [options.critical.bonusDamage];
          const halted = bonus.bonuses.modifiers.modifyParts(parts, rollData);
          if (halted) bonus._halted = true;
          options.critical.bonusDamage = parts[0];
        }
      }

      // Modify critical bonus damage.
      if ((babonus.type === "damage") && !bonus._halted && this.dialog.config.critical?.bonusDamage) {
        const parts = [this.dialog.config.critical.bonusDamage];
        const halted = bonus.bonuses.modifiers.modifyParts(parts, rollData);
        if (halted) bonus._halted = true;
        this.dialog.config.critical.bonusDamage = parts[0];
      }

      if (bonus._halted) this.#registry.modifiers.delete(bonus.uuid);
    }
  }

  /* -------------------------------------------------- */

  /**
   * Get the attribute key for the lowest available and valid spell slot. If the
   * lowest level is both a spell slot and a different kind of slot, prefer the
   * alternative. At this stage, an appropriate key is guaranteed to exist.
   * @param {Babonus} bonus     The bonus used to determine the minimum spell level required.
   * @returns {string}          The attribute key.
   */
  _getLowestValidSpellSlotProperty(bonus) {
    const spells = this.actor.system.spells;
    const min = bonus.consume.value.min || 1;

    let lowest = Infinity;
    const pairs = Object.entries(spells).reduce((acc, [k, v]) => {
      if (!v.value || !v.max || !v.level || (v.level < min)) return acc;
      let set = acc.get(v.level);
      if (!set) {
        acc.set(v.level, new Set());
        set = acc.get(v.level);
      }
      set.add(k);

      lowest = Math.min(lowest, v.level);

      return acc;
    }, new Map());

    const keys = pairs.get(lowest);

    if (keys.size === 1) return keys.first();
    for (const k of keys) if (k.startsWith("spell")) keys.delete(k);
    return keys.first();
  }

  /* -------------------------------------------------- */

  /**
   * Construct the roll data for upscaling a bonus to ensure we use the roll data from the correct source.
   * This is because it may be an outside source, such as from an aura, or a granted effect, or it may be
   * a previously placed measured template aura using a different item level.
   * @param {Babonus} bonus       The babonus.
   * @param {number} [scale]      Upscaling property.
   * @returns {object}            The roll data.
   */
  _getRollData(bonus, scale = 0) {
    const src = bonus.origin;
    if (!bonus.template && this.activity && (src.uuid === this.activity.item.uuid)) return this.activity.getRollData();
    const rollData = src.getRollData();
    rollData.scaling = new dnd5e.documents.Scaling(scale);
    return rollData;
  }

  /* -------------------------------------------------- */

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
