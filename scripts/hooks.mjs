import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

export function _preDisplayCard(item, chatData) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "save");
  if (!bonuses.length) return;
  const data = item.getRollData();
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();
  const totalBonus = bonuses.reduce((acc, { bonus }) => {
    try {
      const r = Roll.replaceFormulaData(bonus, data);
      const s = Roll.safeEval(r);
      acc = acc + s;
    } catch {}
    return acc;
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

  // add to parts.
  bonuses.reduce((acc, i) => {
    if (!i.bonus) return acc;
    if (Roll.validate(i.bonus)) acc.push(i.bonus);
    return acc;
  }, rollConfig.parts);

  // subtract from crit range.
  rollConfig.critical = bonuses.reduce((acc, i) => {
    if (!i.criticalRange) return acc;
    try {
      const r = Roll.replaceFormulaData(i.criticalRange, data);
      const s = Roll.safeEval(r);
      acc = acc - Number(s);
    } catch {}
    return acc;
  }, rollConfig.critical ?? 20);
  if (rollConfig.critical > 20) rollConfig.critical = null;
  else rollConfig.critical = Math.clamped(rollConfig.critical, 1, 20);

  // add to fumble range.
  rollConfig.fumble = bonuses.reduce((acc, i) => {
    if (!i.fumbleRange) return acc;
    try {
      const r = Roll.replaceFormulaData(i.fumbleRange, data);
      const s = Roll.safeEval(r);
      acc = acc + Number(s);
    } catch {}
    return acc;
  }, rollConfig.fumble ?? 1);
  if (rollConfig.fumble < 1) rollConfig.fumble = null;
  else rollConfig.fumble = Math.clamped(rollConfig.fumble, 1, 20);
}

export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "damage");
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return !!i && Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);

  // add to crit bonus dice:
  const critDice = bonuses.map(i => i.criticalBonusDice);
  if (critDice.length) {
    const criticalBonusDice = critDice.reduce((acc, i) => {
      if (!i) return acc;
      try {
        const r = Roll.replaceFormulaData(i, data);
        const s = Roll.safeEval(r);
        acc = acc + Number(s);
      } catch {}
      return acc;
    }, rollConfig.criticalBonusDice ?? 0);
    rollConfig.criticalBonusDice = Math.max(criticalBonusDice, 0);
  }

  // add to crit damage:
  const critDamage = bonuses.map(i => i.criticalBonusDamage);
  if (critDamage.length) {
    const criticalBonusDamage = critDamage.reduce((acc, i) => {
      if (!i) return acc;
      try {
        const r = Roll.replaceFormulaData(i, data);
        if (!Roll.validate(r)) return acc;
        return `${acc} + ${r}`;
      } catch {
        return acc;
      }
    }, rollConfig.criticalBonusDamage ?? "");
    rollConfig.criticalBonusDamage = criticalBonusDamage;
  }
}

export function _preRollDeathSave(actor, rollConfig) {
  // get bonus:
  const bonuses = FILTER.throwCheck(actor, "death", {});
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // add to parts:
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return !!i && Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);

  // modify targetValue:
  const targetValue = bonuses.reduce((acc, { deathSaveTargetValue }) => {
    if (!deathSaveTargetValue) return acc;
    try {
      const r = Roll.replaceFormulaData(deathSaveTargetValue, data);
      const s = Roll.safeEval(r);
      acc = acc - Number(s);
    } catch {}
    return acc;
  }, rollConfig.targetValue ?? 10);
  rollConfig.targetValue = targetValue;
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
  const parts = bonuses.map(i => i.bonus).filter(i => {
    return !!i && Roll.validate(i);
  });
  if (parts.length) rollConfig.parts.push(...parts);
}

export function _preRollHitDie(actor, rollConfig, denomination) {
  const bonuses = FILTER.hitDieCheck(actor);
  if (!bonuses.length) return;
  const target = game.user.targets.first();
  if (target?.actor) rollConfig.data.target = target.actor.getRollData();
  const denom = bonuses.reduce((acc, { bonus }) => {
    if (!Roll.validate(bonus)) return acc;
    return `${acc} + ${bonus}`;
  }, denomination);
  rollConfig.formula = rollConfig.formula.replace(denomination, denom);
}
