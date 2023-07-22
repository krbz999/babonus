import {moduleHooks} from "./scripts/hooks.mjs";

// General setup.
Hooks.once("setup", moduleHooks.setupAPI);
Hooks.once("setup", moduleHooks.createSettings);
Hooks.once("setup", moduleHooks.handlebars);
Hooks.once("setup", moduleHooks.loadPartials);

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", moduleHooks.buttons.effect);
Hooks.on("getActorSheetHeaderButtons", moduleHooks.buttons.actor);
Hooks.on("getDialogHeaderButtons", moduleHooks.buttons.dialog);
Hooks.on("getItemSheetHeaderButtons", moduleHooks.buttons.item);
Hooks.on("renderDialog", moduleHooks.renderDialog);

// Roll hooks. Delay these to let other modules modify behaviour first.
Hooks.once("ready", function() {
  Hooks.on("dnd5e.preDisplayCard", moduleHooks.rolls.preDisplayCard);
  Hooks.on("dnd5e.preRollAbilitySave", moduleHooks.rolls.preRollAbilitySave);
  Hooks.on("dnd5e.preRollAbilityTest", moduleHooks.rolls.preRollAbilityTest);
  Hooks.on("dnd5e.preRollAttack", moduleHooks.rolls.preRollAttack);
  Hooks.on("dnd5e.preRollDamage", moduleHooks.rolls.preRollDamage);
  Hooks.on("dnd5e.preRollDeathSave", moduleHooks.rolls.preRollDeathSave);
  Hooks.on("dnd5e.preRollHitDie", moduleHooks.rolls.preRollHitDie);
  Hooks.on("dnd5e.preRollSkill", moduleHooks.rolls.preRollSkill);
  Hooks.on("dnd5e.preRollToolCheck", moduleHooks.rolls.preRollToolCheck);
  Hooks.on("preCreateMeasuredTemplate", moduleHooks.rolls.preCreateMeasuredTemplate);
});
