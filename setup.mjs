import {
  _addHeaderButtonActor,
  _addHeaderButtonEffect,
  _addHeaderButtonItem,
  _createSettings,
  _dialogHeaderButtons,
  _preCreateMeasuredTemplate,
  _preDisplayCard,
  _preRollAbilitySave,
  _preRollAbilityTest,
  _preRollAttack,
  _preRollDamage,
  _preRollDeathSave,
  _preRollHitDie,
  _preRollSkill,
  _preRollToolCheck,
  _renderDialog
} from "./scripts/hooks.mjs";
import {_createAPI} from "./scripts/public_api.mjs";

Hooks.once("init", () => {
  console.log("ZHELL | Initializing Build-a-Bonus");
});

// Header buttons and special traits.
Hooks.on("getActorSheetHeaderButtons", _addHeaderButtonActor);
Hooks.on("getActiveEffectConfigHeaderButtons", _addHeaderButtonEffect);
Hooks.on("getItemSheetHeaderButtons", _addHeaderButtonItem);
Hooks.once("setup", _createSettings);

// Roll hooks, dialog injection, etc.
Hooks.on("dnd5e.preDisplayCard", _preDisplayCard);
Hooks.on("dnd5e.preRollAbilitySave", _preRollAbilitySave);
Hooks.on("dnd5e.preRollAbilityTest", _preRollAbilityTest);
Hooks.on("dnd5e.preRollAttack", _preRollAttack);
Hooks.on("dnd5e.preRollDamage", _preRollDamage);
Hooks.on("dnd5e.preRollDeathSave", _preRollDeathSave);
Hooks.on("dnd5e.preRollHitDie", _preRollHitDie);
Hooks.on("dnd5e.preRollSkill", _preRollSkill);
Hooks.on("dnd5e.preRollToolCheck", _preRollToolCheck);
Hooks.on("getDialogHeaderButtons", _dialogHeaderButtons);
Hooks.on("preCreateMeasuredTemplate", _preCreateMeasuredTemplate);
Hooks.on("renderDialog", _renderDialog);

// Set up api and backend stuff.
Hooks.once("setup", _createAPI);
