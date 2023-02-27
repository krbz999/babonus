import {
  _addHeaderButtonActor,
  _addHeaderButtonEffect,
  _addHeaderButtonItem,
  _createSettings,
  _preCreateMeasuredTemplate,
  _preDisplayCard,
  _preRollAbilitySave,
  _preRollAttack,
  _preRollDamage,
  _preRollDeathSave,
  _preRollHitDie,
  _renderDialog
} from "./scripts/hooks.mjs";
import {_createAPI} from "./scripts/public_api.mjs";
import {_updateMigrationVersion} from "./scripts/migration.mjs";

Hooks.once("init", () => {
  console.log("ZHELL | Initializing Build-a-Bonus");
});

// Header buttons and special traits.
Hooks.on("getActorSheetHeaderButtons", _addHeaderButtonActor);
Hooks.on("getActiveEffectConfigHeaderButtons", _addHeaderButtonEffect);
Hooks.on("getItemSheetHeaderButtons", _addHeaderButtonItem);
Hooks.once("setup", _createSettings);

// Roll hooks, dialog injection, etc.
Hooks.on("preCreateMeasuredTemplate", _preCreateMeasuredTemplate);
Hooks.on("dnd5e.preDisplayCard", _preDisplayCard);
Hooks.on("dnd5e.preRollAbilitySave", _preRollAbilitySave);
Hooks.on("dnd5e.preRollAttack", _preRollAttack);
Hooks.on("dnd5e.preRollDamage", _preRollDamage);
Hooks.on("dnd5e.preRollDeathSave", _preRollDeathSave);
Hooks.on("dnd5e.preRollHitDie", _preRollHitDie);
Hooks.on("renderDialog", _renderDialog);

// Set up api and backend stuff.
Hooks.once("setup", _createAPI);
Hooks.once("ready", _updateMigrationVersion);
