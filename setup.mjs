import {moduleHooks} from "./scripts/hooks.mjs";
import {_createAPI} from "./scripts/public_api.mjs";

// General setup.
Hooks.once("setup", _createAPI);
Hooks.once("setup", moduleHooks.createSettings);
Hooks.once("setup", moduleHooks.handlebars);
Hooks.once("setup", moduleHooks.loadPartials);

// Any application injections.
Hooks.on("getActiveEffectConfigHeaderButtons", moduleHooks.headerButtonEffect);
Hooks.on("getActorSheetHeaderButtons", moduleHooks.headerButtonActor);
Hooks.on("getDialogHeaderButtons", moduleHooks.getDialogHeaderButtons);
Hooks.on("getItemSheetHeaderButtons", moduleHooks.headerButtonItem);
Hooks.on("renderDialog", moduleHooks.renderDialog);

// Roll hooks.
Hooks.on("dnd5e.preDisplayCard", moduleHooks.preDisplayCard);
Hooks.on("dnd5e.preRollAbilitySave", moduleHooks.preRollAbilitySave);
Hooks.on("dnd5e.preRollAbilityTest", moduleHooks.preRollAbilityTest);
Hooks.on("dnd5e.preRollAttack", moduleHooks.preRollAttack);
Hooks.on("dnd5e.preRollDamage", moduleHooks.preRollDamage);
Hooks.on("dnd5e.preRollDeathSave", moduleHooks.preRollDeathSave);
Hooks.on("dnd5e.preRollHitDie", moduleHooks.preRollHitDie);
Hooks.on("dnd5e.preRollSkill", moduleHooks.preRollSkill);
Hooks.on("dnd5e.preRollToolCheck", moduleHooks.preRollToolCheck);
Hooks.on("preCreateMeasuredTemplate", moduleHooks.preCreateMeasuredTemplate);
