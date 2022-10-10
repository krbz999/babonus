import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

export function _preDisplayCard(item, chatData, config) {
  // get bonus:
  const data = item.getRollData();
  const bonuses = FILTER.itemCheck(item, "save");
  if (!bonuses.length) return;
  const totalBonus = bonuses.reduce((acc, { bonus }) => {
    try {
      const formula = Roll.replaceFormulaData(bonus, data);
      const total = Roll.safeEval(formula);
      return acc + total;
    }
    catch {
      return acc;
    }
  }, 0);

  // get all buttons.
  const html = chatData.content;
  const temp = document.createElement("DIV");
  temp.innerHTML = html;
  const saveButtons = temp.querySelectorAll("button[data-action='save']");

  // create label (innertext)
  const save = item.system.save;
  const ability = CONFIG.DND5E.abilities[save.ability] ?? "";
  const savingThrow = game.i18n.localize("DND5E.ActionSave");
  const dc = save.dc + totalBonus || "";
  chatData.flags[MODULE] = { saveDC: dc };
  const label = game.i18n.format("DND5E.SaveDC", { dc, ability });

  for (const btn of saveButtons) btn.innerText = `${savingThrow} ${label}`;
  chatData.content = temp.innerHTML;
}

export function _preRollAttack(item, rollConfig) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "attack");
  if (!bonuses.length) return;

  // add to parts.
  const attacks = bonuses.map(i => i.bonus).filter(i => i);
  if (attacks.length) {
    rollConfig.parts = rollConfig.parts.concat(attacks);
  }

  // subtract from crit range.
  const ranges = bonuses.map(i => i.criticalRange);
  const range = ranges.reduce((acc, e) => {
    if (!e) return acc;
    try {
      let r = Roll.replaceFormulaData(e, rollConfig.data);
      r = Roll.safeEval(r);
      acc = acc - Number(r);
    } catch {
      return acc;
    }
    return acc;
  }, rollConfig.critical);
  if (range > 20) rollConfig.critical = null;
  else rollConfig.critical = Math.clamped(range, 1, 20);

  // add to fumble range.
  const fumbles = bonuses.map(i => i.fumbleRange);
  const fumble = fumbles.reduce((acc, e) => {
    if (!e) return acc;
    try {
      let r = Roll.replaceFormulaData(e, rollConfig.data);
      r = Roll.safeEval(r);
      acc = acc + Number(r);
    } catch {
      return acc;
    }
    return acc;
  }, rollConfig.fumble ?? 1);
  if (fumble < 1) rollConfig.fumble = null;
  else rollConfig.fumble = Math.clamped(fumble, 1, 20);
}

export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const values = FILTER.itemCheck(item, "damage");

  // add to rollConfig.
  for (const { bonus, criticalBonusDice, criticalBonusDamage } of values) {
    if (bonus?.length) {
      const parts = rollConfig.parts.concat(bonus);
      rollConfig.parts = parts;
    }
    if (criticalBonusDice?.length) {
      let totalCBD;
      try {
        const formula = Roll.replaceFormulaData(criticalBonusDice, rollConfig.data);
        totalCBD = Roll.safeEval(formula);
      } catch {
        totalCBD = 0;
      }
      const oldValue = rollConfig.criticalBonusDice ?? 0;
      rollConfig.criticalBonusDice = oldValue + totalCBD;
    }
    if (criticalBonusDamage?.length) {
      const oldValue = rollConfig.criticalBonusDamage;
      let totalCBD;
      if (oldValue) totalCBD = `${oldValue} + ${criticalBonusDamage}`;
      else totalCBD = criticalBonusDamage;
      rollConfig.criticalBonusDamage = totalCBD;
    }
  }
}

export function _preRollDeathSave(actor, rollConfig) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, "death");
  if (!bonuses.length) return;

  // add to parts:
  const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
  rollConfig.parts = parts;
}

export function _preRollAbilitySave(actor, rollConfig, abilityId) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, abilityId);
  if (!bonuses.length) return;

  // add to parts:
  const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
  rollConfig.parts = parts;
}

export function _preRollHitDie(actor, rollConfig, denomination) {
  const bonuses = FILTER.hitDieCheck(actor);
  if (!bonuses.length) return;
  const denom = bonuses.reduce((acc, { bonus }) => {
    return `${acc} + ${bonus}`;
  }, denomination);
  rollConfig.formula = rollConfig.formula.replace(denomination, denom);
}
