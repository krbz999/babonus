import { MODULE } from "../constants.mjs";
import { _constructSpellSlotOptions, _getHighestSpellSlot } from "./helpers.mjs";

export async function _renderDialog(dialog, html) {
  // Array of optional babs, the level of the spell being rolled, and the uuid of the actor rolling.
  const { optionals, spellLevel, actorUuid } = foundry.utils.getProperty(dialog, `options.${MODULE}`) ?? {};
  if (!optionals) return;

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

  // Declare situational bonus field and append listeners.
  const sitBonusField = html[0].querySelector("[name=bonus]");
  html[0].querySelectorAll(".babonus-optionals a.add").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.closest(".optional").classList.add("active");
      dialog.setPosition({ height: "auto" });

      const opt = btn.closest(".optional");

      // The base bonus.
      const bonus = btn.dataset.bonus;

      // Does the bonus have a cost?
      const hasCost = opt.dataset.uuid;
      if (!hasCost) {
        sitBonusField.value += ` + ${bonus}`;
        return;
      }

      // Does the bonus scale?
      const scales = opt.querySelector(".consumption select");

      // Subtract cost from the item.
      const { uuid, type, min } = opt.dataset;
      const target = await fromUuid(uuid);
      const value = type !== "slots" ? (!scales ? Number(min) : Number(scales.value || min)) : scales.value;

      // Can the cost be subtracted?
      if (!_determineConsumptionValidity(target, value, type)) {
        ui.notifications.warn(type !== "slots" ? "DND5E.AbilityUseUnavailableHint" : "BABONUS.ConsumptionTypeSpellSlotUnavailable", {
          localize: true
        });
        btn.closest(".optional").classList.remove("active");
        dialog.setPosition({ height: "auto" });
        return;
      }

      // If the bonus scales, scale it with the item's or actor's roll data.
      if (scales) {
        const data = target.getRollData();
        if (spellLevel) foundry.utils.setProperty(data, "item.level", spellLevel);
        const scaledBonus = _getScaledSituationalBonus(bonus, value, data);
        sitBonusField.value += ` + ${scaledBonus}`;
      } else sitBonusField.value += ` + ${bonus}`;

      // Update the item's uses or quantity, or the actor's spell slots.
      return _updateTargetFromConsumption(target, value, type);
    });
  });
}

// Construct data for the template.
function _constructTemplateData(bab, actor) {
  const config = {
    name: bab.name,
    desc: bab.description,
    bonus: bab.bonuses.bonus,
    consumes: bab.isConsuming
  };

  if (config.consumes) {
    const type = bab.consume.type;

    const max = {
      uses: bab.item?.system.uses.max,
      quantity: bab.item?.system.quantity,
      slots: _getHighestSpellSlot(actor.system)
    }[type];

    const cons = bab.getConsumptionOptions(actor.system);
    if (!cons.length) return null;
    const options = (type === "slots") ? _constructSpellSlotOptions(actor.system, {
      maxLevel: Math.min(max, Math.max(...cons))
    }) : cons.reduce((acc, n) => {
      return acc + `<option value="${n}">${n} / ${max}</option>`;
    }, "");
    const uuid = type === "slots" ? actor.uuid : bab.item.uuid;
    const scales = bab.consume.scales;
    const min = bab.consume.value.min;
    const origin = _determineOriginTooltip(bab);
    foundry.utils.mergeObject(config, {
      type, max, options, uuid, scales, min, origin
    });
  }

  return config;
}

/**
 * Return whether an item or actor can consume the amount.
 * Target: The item or actor being consumed off of.
 * Amount: The number of uses, quantities, or the key of the spell slot (eg "pact" or "spell3").
 * Type: "uses", "quantity" or "slots".
 */
function _determineConsumptionValidity(target, amount, type) {
  const value = target.system.uses?.value;
  const quantity = target.system.quantity;
  if (type === "uses") return amount <= value;
  else if (type === "quantity") return amount <= quantity;
  else if (type === "slots") return target.system.spells[amount]?.value > 0;
  else return false;
}

// Updates an item's uses/quantity or an actor's spell slots.
async function _updateTargetFromConsumption(target, amount, type) {
  const prop = type === "uses" ? "system.uses.value" : type === "quantity" ? "system.quantity" : `system.spells.${amount}.value`;
  const value = foundry.utils.getProperty(target, prop);
  return (target instanceof Item) ? target.update({ [prop]: value - amount }) : target.update({ [prop]: value - 1 });
}

// append an upscaled bonus to the situational bonus field.
function _getScaledSituationalBonus(base, value, data) {
  const mult = Number.isNumeric(value) ? value : value === "pact" ? data.spells.pact.level : value.startsWith("spell") ? Number(value.at(-1)) : value;
  const roll = new CONFIG.Dice.DamageRoll(base, data).alter(mult, 0, { multiplyNumeric: true });
  return roll.formula;
}

// Determine label for origin tooltip.
function _determineOriginTooltip(bab) {
  if (bab.parent instanceof MeasuredTemplateDocument) return "Template";
  else if (bab.parent instanceof ActiveEffect) return bab.parent.label;
  else return bab.parent.name;
}
