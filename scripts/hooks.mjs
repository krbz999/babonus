import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

export function _preDisplayCard(item, chatData) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "save");
  if (!bonuses.length) return;
  const data = item.getRollData();
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
  const attacks = bonuses.map(i => i.bonus).filter(i => {
    return Roll.validate(i);
  });
  if (attacks.length) rollConfig.parts.push(...attacks);

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
      return acc + Number(r);
    } catch {
      return acc;
    }
  }, rollConfig.fumble ?? 1);
  if (fumble < 1) rollConfig.fumble = null;
  else rollConfig.fumble = Math.clamped(fumble, 1, 20);
}

export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "damage");

  // add to parts:
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);

  // add to crit bonus dice:
  const critDice = bonuses.map(i => i.criticalBonusDice);
  if (critDice.length) {
    const criticalBonusDice = critDice.reduce((acc, e) => {
      if (!e) return acc;
      try {
        let b = Roll.replaceFormulaData(e, rollConfig.data);
        b = Roll.safeEval(b);
        return acc + Number(b);
      } catch {
        return acc;
      }
    }, rollConfig.criticalBonusDice ?? 0);
    rollConfig.criticalBonusDice = Math.max(criticalBonusDice, 0);
  }

  // add to crit damage:
  const critDamage = bonuses.map(i => i.criticalBonusDamage);
  if (critDamage.length) {
    const criticalBonusDamage = critDamage.reduce((acc, e) => {
      if (!e) return acc;
      try {
        let f = Roll.replaceFormulaData(e, rollConfig.data);
        if (!Roll.validate(f)) return acc;
        return `${acc} + ${f}`;
      } catch {
        return acc;
      }
    }, rollConfig.criticalBonusDamage);
    rollConfig.criticalBonusDamage = criticalBonusDamage;
  }
}

export function _preRollDeathSave(actor, rollConfig) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, "death");
  if (!bonuses.length) return;

  // add to parts:
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);

  // modify targetValue:
  const targetValue = bonuses.reduce((acc, { deathSaveTargetValue }) => {
    if (!deathSaveTargetValue) return acc;
    try {
      let d = Roll.replaceFormulaData(deathSaveTargetValue, rollConfig.data);
      d = Roll.safeEval(d);
      return acc - Number(d);
    } catch {
      return acc;
    }
  }, rollConfig.targetValue ?? 10);
  rollConfig.targetValue = Math.clamped(targetValue, 2, 19);
}

export function _preRollAbilitySave(actor, rollConfig, abilityId) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, abilityId);
  if (!bonuses.length) return;

  // add to parts:
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);
}

export function _preRollHitDie(actor, rollConfig, denomination) {
  const bonuses = FILTER.hitDieCheck(actor);
  if (!bonuses.length) return;
  const denom = bonuses.reduce((acc, { bonus }) => {
    if (!Roll.validate(bonus)) return acc;
    return `${acc} + ${bonus}`;
  }, denomination);
  rollConfig.formula = rollConfig.formula.replace(denomination, denom);
}
