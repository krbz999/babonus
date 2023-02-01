import { MODULE } from "../constants.mjs";

export async function _renderDialog(dialog, html) {
  const { optionals, spellLevel } = foundry.utils.getProperty(dialog, `options.${MODULE}`) ?? {};
  if (!optionals) return;

  // Inject template.
  const data = optionals.map(bab => _constructTemplateData(bab)).filter(i => i);
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
      const item = await fromUuid(uuid);
      const value = !scales ? Number(min) : Number(scales.value || min);

      // Can the cost be subtracted?
      if (!_determineConsumptionValidity(item, value, type)) {
        ui.notifications.warn("DND5E.AbilityUseUnavailableHint", { localize: true });
        btn.closest(".optional").classList.remove("active");
        dialog.setPosition({ height: "auto" });
        return;
      }

      // If the bonus scales, scale it with the item's roll data.
      if (scales) {
        const data = item.getRollData();
        if (spellLevel) data.item.level = spellLevel;
        const scaledBonus = _getScaledSituationalBonus(bonus, value, data);
        sitBonusField.value += ` + ${scaledBonus}`;
      } else sitBonusField.value += ` + ${bonus}`;

      // Update the item's uses or quantity.
      return _updateItemFromConsumption(item, value, type);
    });
  });
}

// Construct data for the template.
function _constructTemplateData(bab) {
  const config = {
    name: bab.name,
    desc: bab.description,
    bonus: bab.bonuses.bonus,
    consumes: bab.isConsuming
  };

  if (config.consumes) {
    const type = bab.consume.type;
    const max = type === "uses" ? bab.item.system.uses.max : bab.item.system.quantity;
    const cons = bab.getConsumptionOptions();
    if (!cons.length) return null;
    const options = cons.reduce((acc, n) => {
      return acc + `<option value="${n}">${n} / ${max}</option>`;
    }, "");
    const uuid = bab.item.uuid;
    const scales = bab.consume.scales;
    const min = bab.consume.value.min;
    const origin = _determineOriginTooltip(bab);
    foundry.utils.mergeObject(config, {
      type, max, options, uuid, scales, min, origin
    });
  }

  return config;
}

// return whether an item can consume the amount.
function _determineConsumptionValidity(item, amount, type) {
  const value = item.system.uses.value;
  const quantity = item.system.quantity;
  if (type === "uses") return amount <= value;
  else if (type === "quantity") return amount <= quantity;
  else return false;
}

// updates an item's uses/quantity.
async function _updateItemFromConsumption(item, amount, type) {
  const prop = type === "uses" ? "system.uses.value" : "system.quantity";
  const value = foundry.utils.getProperty(item, prop);
  return item.update({ [prop]: value - amount });
}

// append an upscaled bonus to the situational bonus field.
function _getScaledSituationalBonus(base, mult, data) {
  const roll = new Roll(base, data).alter(mult, 0, { multiplyNumeric: true });
  return roll.formula;
}

// Determine label for origin tooltip.
function _determineOriginTooltip(bab) {
  if (bab.parent instanceof MeasuredTemplateDocument) return "Template";
  else if (bab.parent instanceof ActiveEffect) return bab.parent.label;
  else return bab.parent.name;
}
