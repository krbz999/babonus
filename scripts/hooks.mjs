import { FILTER } from "./filters.mjs";

export function _preDisplayCard(item, chatData) {
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
  const label = game.i18n.format("DND5E.SaveDC", { dc, ability });

  for (const btn of saveButtons) btn.innerText = `${savingThrow} ${label}`;
  chatData.content = temp.innerHTML;
}

export function _preRollAttack(item, rollConfig) {
  // get bonus:
  const bonuses = FILTER.itemCheck(item, "attack");
  if (!bonuses.length) return;

  // add to parts.
  const parts = rollConfig.parts.concat(bonuses.map(i => i.bonus));
  rollConfig.parts = parts;
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
