import { MODULE } from "../constants.mjs";
import { _constructScalingOptionalOptions } from "./helpers.mjs";

export async function _renderDialog(dialog, html) {
  // Array of optional babs, the level of the spell being rolled, and the uuid of the actor rolling.
  const { optionals, actorUuid } = dialog.options.babonus ?? {};
  if (!optionals?.length) return;

  // Inject template.
  const from = await fromUuid(actorUuid);
  const actor = from.actor ?? from;
  const data = optionals.map(bab => _constructTemplateData(bab, actor)).filter(i => i);
  if (!data.length) return;
  const last = html[0].querySelector(".dialog-content > form > .form-group:last-child");
  const DIV = document.createElement("DIV");
  const template = `modules/${MODULE}/templates/subapplications/optionalBonuses.hbs`;
  DIV.innerHTML = await renderTemplate(template, { data });
  last.after(DIV.firstElementChild);
  dialog.setPosition({ height: "auto" });

  // Append listeners.
  html[0].querySelectorAll(".babonus-optionals button.add").forEach(btn => {
    btn.addEventListener("click", _applyOptionalBonus.bind(dialog));
  });
}

/**
 * Find, scale, and apply a bonus, and optionally deduct a consumed attribute.
 * @param {Event} event     The originating click event.
 */
async function _applyOptionalBonus(event) {
  const opt = event.currentTarget.closest(".optional");
  const field = this.element[0].querySelector("[name='bonus']");
  opt.classList.add("active");
  const data = opt.dataset;
  this.setPosition({ height: "auto" });
  const spellLevel = this.options[MODULE].spellLevel;

  // Does the bonus have a cost?
  const consumes = opt.classList.contains("consumes");
  if (!consumes) {
    field.value += ` + ${data.bonus}`;
    return;
  }

  // Does the bonus scale?
  const scales = opt.classList.contains("scales");
  const select = opt.querySelector(".consumption select"); // the dropdown for scaling.
  const selectData = select?.options[select.selectedIndex].dataset ?? {}; // data of the option.

  // The target of consumption.
  const target = await fromUuid(data.uuid);

  // The attribute key to target on the actor or item.
  const attrKey = _determineAttribute({ scales, selectData, data, target });
  if (!attrKey) {
    ui.notifications.warn("BABONUS.NoRemainingSpellSlots", { localize: true });
    opt.classList.remove("active");
    this.setPosition({ height: "auto" });
    return;
  }

  // The value to consume off the actor or item.
  const cost = _determineCost({ scales, selectData, data });

  // Whether cost can be subtracted.
  const validCost = _determineConsumptionValidity(target, attrKey, cost);
  if (!validCost) {
    const str = {
      slots: "BABONUS.ConsumptionTypeSpellSlotUnavailable",
      uses: "DND5E.AbilityUseUnavailableHint",
      quantity: "DND5E.AbilityUseUnavailableHint"
    }[data.type];
    ui.notifications.warn(str, { localize: true });
    opt.classList.remove("active");
    this.setPosition({ height: "auto" });
    return;
  }

  // Determine the bonus to be added and append it to the bonus field.
  const bonus = _determineBonus({ scales, target, spellLevel, data, selectData });
  field.value += ` + ${bonus}`;

  // Deduct the consumed resource from the target.
  const val = foundry.utils.getProperty(target, attrKey);
  return target.update({ [attrKey]: val - cost });
}

/**
 * Determine the attribute that is deducted from.
 * @param {boolean} scales          Whether the bonus scales.
 * @param {object} selectData       Dataset of the scaling option selected.
 * @param {object} data             Dataset of the optional bonus.
 * @param {Actor5e|Item5e} target   The target of consumption.
 */
function _determineAttribute({ scales, selectData, data, target }) {
  if (scales) return selectData.property;
  if (data.type === "uses") return "system.uses.value";
  else if (data.type === "quantity") return "system.quantity";
  else if (data.type === "slots") return _getLowestValidSpellSlot(target.system.spells, Number(data.min));
}

/**
 * Determine the cost of the optional bonus depending on type and selections.
 * @param {boolean} scales      Whether the bonus scales.
 * @param {object} selectData   Dataset of the scaling option selected.
 * @param {object} data         Dataset of the optional bonus.
 * @returns {number}            The numeric cost of the bonus.
 */
function _determineCost({ scales, selectData, data }) {
  if (scales) return Number(selectData.value);
  if (data.type === "slots") return 1;
  else if ((data.type === "uses") || (data.type === "quantity")) return Number(data.min);
}

/**
 * Determine the bonus and optionally scale it.
 * @param {boolean} scales          Whether the bonus scales.
 * @param {Actor5e|Item5e} target   The target of consumption.
 * @param {number|null} spellLevel  The level of the spell, after upcasting.
 * @param {object} data             Dataset of the optional bonus.
 * @param {object} selectData       Dataset of the scaling option selected.
 * @returns {string}                The optionally upscaled bonus.
 */
function _determineBonus({ scales, target, spellLevel, data, selectData }) {
  if (!scales) return data.bonus;
  const rollData = target.getRollData();
  if (spellLevel) foundry.utils.setProperty(rollData, "item.level", spellLevel);
  return _getScaledSituationalBonus(data.bonus, Number(selectData.scale), rollData);
}

/**
 * Construct data for the template.
 * @param {Babonus} bab     A babonus to retrieve data from.
 * @param {Actor5e} actor   The actor doing the rolling.
 * @returns {object}        One object for the handlebars template.
 */
function _constructTemplateData(bab, actor) {
  const data = { uses: bab.item, quantity: bab.item, slots: actor }[bab.consume.type];
  const config = {
    name: bab.name,
    desc: bab.description,
    bonus: bab.bonuses.bonus,
    consumes: bab.isConsuming,
    origin: _determineOriginTooltip(bab),
    type: bab.consume.type,
    min: bab.consume.value.min,
    uuid: data?.uuid
  };
  // If the bonus scales, it must have at least one option to pick.
  if (bab.isScaling) {
    config.options = _constructScalingOptionalOptions(data, config.type, bab.consume.value);
    if (!config.options) return null;
    config.scales = true;
  }

  // If the bonus does not scale, the actor or item must have the minimum needed to apply it.
  else if (config.consumes) {
    const canSupply = _canSupplyMinimum(data, config.min, config.type);
    if (!canSupply) return null;
  }

  return config;
}

/**
 * Return whether an item or actor can consume the amount.
 * @param {Actor5e|Item5e} target   The actor or item who has the spell slots or uses/quantity.
 * @param {string} property         The data path of the attribute on the target.
 * @param {number} amount           The amount that is consumed.
 * @returns {boolean}               Whether the target has enough of the consumed property.
 */
function _determineConsumptionValidity(target, property, amount) {
  if (property === false) return false;
  return foundry.utils.getProperty(target, property) >= amount;
}

/**
 * Return an upscaled bonus given a base, number to multiply with, and a data of roll data.
 * @param {string} bonus      The base bonus.
 * @param {number} mult       The number to upscale by.
 * @param {object} rollData   The target's roll data.
 * @returns {string}          The upscaled bonus.
 */
function _getScaledSituationalBonus(bonus, mult, rollData) {
  return new CONFIG.Dice.DamageRoll(bonus, rollData).alter(1, mult).formula;
}

/**
 * Determine the label for the origin tooltip.
 * @param {Babonus} bab   A babonus.
 * @returns {string}      The label.
 */
function _determineOriginTooltip(bab) {
  if (bab.parent instanceof MeasuredTemplateDocument) return "Template";
  else if (bab.parent instanceof ActiveEffect) return bab.parent.label;
  else return bab.parent.name;
}

/**
 * For non-scaling spell slot consumption bonuses, get the attribute key for the lowest available
 * and valid spell slot. If the lowest level is both a pact and spell slot, the pact slot will be used.
 * @param {object} data   Spell slot data.
 * @param {number} min    The minimum level required.
 * @returns {string}      The attribute key.
 */
function _getLowestValidSpellSlot(data, min) {
  const pact = data.pact.level;
  let level = Infinity;
  const max = Object.keys(CONFIG.DND5E.spellLevels).length - 1; // disregard cantrip levels
  for (let i = min; i <= max; i++) {
    const value = data[`spell${i}`].value;
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
 * Whether a bonus has the minimum required uses, quantity, or spell slots for showing up
 * in the roll config. Intended as a way to ignore bonuses you cannot select.
 * @param {Actor5e|Item5e} data   The item or actor that must have the required value.
 * @param {number} min            The minimum value required.
 * @param {string} type           The type of consumption.
 * @returns {boolean}             Whether the target can consume the minimum value required.
 */
function _canSupplyMinimum(data, min, type) {
  if (type === "slots") return _getLowestValidSpellSlot(data.system.spells, min) !== false;
  else if (type === "uses") return data.system.uses.value >= min;
  else if (type === "quantity") return data.system.quantity >= min;
}
