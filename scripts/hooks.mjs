import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";
import {
  _determineConsumptionValidity,
  _getScaledSituationalBonus,
  _updateItemFromConsumption
} from "./helpers/helpers.mjs";

function _bonusToInt(bonus, data) {
  const f = new Roll(bonus, data).formula;
  if (!Roll.validate(f)) return 0;
  return Roll.safeEval(f);
}

export function _preDisplayCard(item, chatData) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "save");
  if (!bonuses.length) return;
  const data = item.getRollData();
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();
  const totalBonus = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.bonus, data);
  }, 0);

  // get all buttons.
  const html = chatData.content;
  const temp = document.createElement("DIV");
  temp.innerHTML = html;
  const selector = "button[data-action='save']";
  const saveButtons = temp.querySelectorAll(selector);

  // create label (innertext)
  const save = item.system.save;
  const ability = CONFIG.DND5E.abilities[save.ability] ?? "";
  const savingThrow = game.i18n.localize("DND5E.ActionSave");
  const dc = Math.max(1, save.dc + totalBonus) || "";
  chatData.flags[MODULE] = { saveDC: dc };
  const label = game.i18n.format("DND5E.SaveDC", { dc, ability });

  for (const btn of saveButtons) {
    btn.innerText = `${savingThrow} ${label}`;
  }
  chatData.content = temp.innerHTML;
}

export function _preRollAttack(item, rollConfig) {
  // get bonuses:
  const bonuses = FILTER.itemCheck(item, "attack");
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const { parts, optionals } = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, { parts: [], optionals: [] });
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}.optionals`, optionals);
  }

  // subtract from crit range.
  rollConfig.critical = bonuses.reduce((acc, bab) => {
    return acc - _bonusToInt(bab.bonuses.criticalRange, data);
  }, rollConfig.critical ?? 20);
  if (rollConfig.critical < 1) rollConfig.critical = 1;

  // add to fumble range.
  rollConfig.fumble = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.fumbleRange, data);
  }, rollConfig.fumble ?? 1);
}

export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "damage", { spellLevel: rollConfig.data.item.level });
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const { parts, optionals } = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, { parts: [], optionals: [] });
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}.optionals`, optionals);
  }

  // add to crit bonus dice:
  rollConfig.criticalBonusDice = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.criticalBonusDice, data);
  }, rollConfig.criticalBonusDice ?? 0);
  if (rollConfig.criticalBonusDice < 0) rollConfig.criticalBonusDice = 0;

  // add to crit damage:
  rollConfig.criticalBonusDamage = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.criticalBonusDamage;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    return `${acc} + ${bonus}`;
  }, rollConfig.criticalBonusDamage ?? "");
}

export function _preRollDeathSave(actor, rollConfig) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, "death", {});
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const { parts, optionals } = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, { parts: [], optionals: [] });
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}.optionals`, optionals);
  }

  // modify targetValue:
  rollConfig.targetValue = bonuses.reduce((acc, bab) => {
    return acc - _bonusToInt(bab.bonuses.deathSaveTargetValue, data);
  }, rollConfig.targetValue ?? 10);
}

export function _preRollAbilitySave(actor, rollConfig, abilityId) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, abilityId, {
    isConcSave: rollConfig.isConcSave
  });
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();

  // add to parts:
  const { parts, optionals } = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    if (bab.isOptional) acc.optionals.push(bab);
    else acc.parts.push(bonus);
    return acc;
  }, { parts: [], optionals: [] });
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}.optionals`, optionals);
  }
}

export function _preRollHitDie(actor, rollConfig, denomination) {
  const bonuses = FILTER.hitDieCheck(actor);
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();

  const denom = bonuses.reduce((acc, bab) => {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (!valid) return acc;
    return `${acc} + ${bonus}`;
  }, denomination);
  rollConfig.formula = rollConfig.formula.replace(denomination, denom);
}

Hooks.on("renderDialog", async function(dialog, html) {
  const { optionals, spellLevel } = foundry.utils.getProperty(dialog, `options.${MODULE}`) ?? {};
  if (!optionals) return;

  const data = optionals.map(bab => {
    const type = bab.consume.type;
    const max = type === "uses" ? bab.item.system.uses.max : bab.item.system.quantity;
    const options = bab.getConsumptionOptions().reduce((acc, n) => {
      return acc + `<option value="${n}">${n} / ${max}</option>`;
    }, "");
    const name = bab.name;
    const desc = bab.description;
    const bonus = bab.bonuses.bonus;
    const consumes = bab.isConsuming;
    const uuid = bab.item.uuid;
    const scales = bab.consume.scales;
    const min = bab.consume.value.min;
    return { name, desc, bonus, consumes, options, type, uuid, scales, min };
  });

  const last = html[0].querySelector(".dialog-content > form > .form-group:last-child");
  const DIV = document.createElement("DIV");
  const template = `modules/${MODULE}/templates/subapplications/optionalBonuses.hbs`;
  DIV.innerHTML = await renderTemplate(template, { data });
  last.after(DIV.firstElementChild);
  dialog.setPosition({ height: "auto" });

  const sitBonusField = html[0].querySelector("[name=bonus]");
  html[0].querySelectorAll(".babonus-optionals a.add").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.closest(".optional").classList.add("active");
      dialog.setPosition({ height: "auto" });
      const bonus = btn.dataset.bonus;
      const costs = btn.closest(".optional").querySelector(".consumption");
      if (!costs) {
        sitBonusField.value += ` + ${bonus}`;
        return;
      }
      const scales = costs.querySelector("select");
      const { uuid, type, min } = costs.dataset;
      const item = await fromUuid(uuid);
      const value = !scales ? Number(min) : Number(scales.value || min);
      if (!_determineConsumptionValidity(item, value, type)) {
        ui.notifications.warn("DND5E.AbilityUseUnavailableHint", { localize: true });
        btn.closest(".optional").classList.remove("active");
        dialog.setPosition({ height: "auto" });
        return;
      }

      if (scales) {
        const data = item.getRollData();
        if (spellLevel) data.item.level = spellLevel;
        const scaledBonus = _getScaledSituationalBonus(bonus, value, data);
        sitBonusField.value += ` + ${scaledBonus}`;
      } else {
        sitBonusField.value += ` + ${bonus}`;
      }
      return _updateItemFromConsumption(item, value, type);
    });
  });
});
