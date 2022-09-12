import {
    _preDisplayCard,
    _preRollDamage,
    _preRollAttack,
    _renderActorSheetFlags,
    _setup,
    _getItemSheetHeaderButtons,
    _getActiveEffectConfigHeaderButtons
} from "./scripts/hooks.mjs";

Hooks.on("setup", _setup);
Hooks.on("renderActorSheetFlags", _renderActorSheetFlags);
Hooks.on("dnd5e.preDisplayCard", _preDisplayCard);
Hooks.on("dnd5e.preRollAttack", _preRollAttack);
Hooks.on("dnd5e.preRollDamage", _preRollDamage);
Hooks.on("getItemSheetHeaderButtons", _getItemSheetHeaderButtons);
Hooks.on("getActiveEffectConfigHeaderButtons", _getActiveEffectConfigHeaderButtons);
