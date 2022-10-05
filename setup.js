import {
  _preDisplayCard,
  _preRollDamage,
  _preRollAttack,
  _renderActorSheetFlags,
  _setup,
  _getItemSheetHeaderButtons,
  _getActiveEffectConfigHeaderButtons,
  _preRollDeathSave,
  _preRollAbilitySave,
  _preRollHitDie
} from "./scripts/hooks.mjs";

Hooks.once("setup", _setup);
Hooks.on("renderActorSheetFlags", _renderActorSheetFlags);
Hooks.on("getItemSheetHeaderButtons", _getItemSheetHeaderButtons);
Hooks.on("getActiveEffectConfigHeaderButtons", _getActiveEffectConfigHeaderButtons);
Hooks.on("dnd5e.preDisplayCard", _preDisplayCard);
Hooks.on("dnd5e.preRollAttack", _preRollAttack);
Hooks.on("dnd5e.preRollDamage", _preRollDamage);
Hooks.on("dnd5e.preRollDeathSave", _preRollDeathSave);
Hooks.on("dnd5e.preRollAbilitySave", _preRollAbilitySave);
Hooks.on("dnd5e.preRollHitDie", _preRollHitDie);
