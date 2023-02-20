import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

function _bonusToInt(bonus, data) {
  const f = new Roll(bonus, data).formula;
  if (!Roll.validate(f)) return 0;
  return Roll.safeEval(f);
}

export function _preDisplayCard(item, chatData) {
  if (!item.hasSave) return;

  // Get bonuses:
  const bonuses = FILTER.itemCheck(item, "save", { spellLevel: item.system.level });
  if (!bonuses.length) return;
  const data = item.getRollData();
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();
  const totalBonus = bonuses.reduce((acc, bab) => {
    return acc + _bonusToInt(bab.bonuses.bonus, data);
  }, 0);

  // Get all buttons:
  const DIV = document.createElement("DIV");
  DIV.innerHTML = chatData.content;
  const saveButtons = DIV.querySelectorAll("button[data-action='save']");

  // Create label (innertext)
  const save = item.system.save;
  const ability = CONFIG.DND5E.abilities[save.ability] ?? ""; // TODO: fix in 2.2.x.
  const savingThrow = game.i18n.localize("DND5E.ActionSave");
  const dc = Math.max(1, save.dc + totalBonus) || "";
  chatData.flags[MODULE] = { saveDC: dc };
  const label = game.i18n.format("DND5E.SaveDC", { dc, ability });
  saveButtons.forEach(b => b.innerText = `${savingThrow} ${label}`);
  chatData.content = DIV.innerHTML;
}

export function _preRollAttack(item, rollConfig) {
  // get bonuses:
  const spellLevel = rollConfig.data.item.level;
  const bonuses = FILTER.itemCheck(item, "attack", { spellLevel });
  if (!bonuses.length) return;
  const data = rollConfig.data;
  const target = game.user.targets.first();
  if (target?.actor) data.target = target.actor.getRollData();

  // Gather up all bonuses.
  const parts = [];
  const optionals = [];
  const mods = { critical: 0, fumble: 0 };
  for (const bab of bonuses) {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (valid) {
      if (bab.isOptional) optionals.push(bab);
      else parts.push(bonus);
    }
    mods.critical += _bonusToInt(bab.bonuses.criticalRange, data);
    mods.fumble += _bonusToInt(bab.bonuses.fumbleRange, data);
  }

  // Add parts.
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals,
      actorUuid: item.actor.uuid,
      spellLevel
    });
  }

  // Add modifiers to raise/lower the criticial and fumble.
  rollConfig.critical = (rollConfig.critical ?? 20) - mods.critical;
  rollConfig.fumble = (rollConfig.fumble ?? 1) + mods.fumble;

  // Don't set crit to below 1, and don't set fumble to below 1 unless explicitly -Infinity.
  if (rollConfig.critical < 1) rollConfig.critical = 1;
  if ((rollConfig.fumble < 1) && (rollConfig.fumble !== -Infinity)) rollConfig.fumble = 1;
}

export function _preRollDamage(item, rollConfig) {
  // get bonus:
  const spellLevel = rollConfig.data.item.level;
  const bonuses = FILTER.itemCheck(item, "damage", { spellLevel });
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
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals,
      actorUuid: item.actor.uuid,
      spellLevel
    });
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

  // Gather up all bonuses.
  const death = { bonus: 0 };
  const parts = [];
  const optionals = [];
  for (const bab of bonuses) {
    const bonus = bab.bonuses.bonus;
    const valid = !!bonus && Roll.validate(bonus);
    if (valid) {
      if (bab.isOptional) optionals.push(bab);
      else parts.push(bonus);
    }
    death.bonus += _bonusToInt(bab.bonuses.deathSaveTargetValue, data);
  }

  // Add parts.
  if (parts.length) rollConfig.parts.push(...parts);
  if (optionals.length) {
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals,
      actorUuid: actor.uuid
    });
  }

  // Add modifiers to raise/lower the target value.
  rollConfig.targetValue = (rollConfig.targetValue ?? 10) - death.bonus;
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
    foundry.utils.setProperty(rollConfig, `dialogOptions.${MODULE}`, {
      optionals,
      actorUuid: actor.uuid
    });
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
