import {
  _getActiveEffectConfigHeaderButtons,
  _getItemSheetHeaderButtons,
  _renderActorSheetFlags,
  _setup
} from "./scripts/setup.mjs";
import {
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
Hooks.on("getActiveEffectConfigHeaderButtons", _getActiveEffectConfigHeaderButtons);
Hooks.on("getItemSheetHeaderButtons", _getItemSheetHeaderButtons);
Hooks.on("renderActorSheetFlags", _renderActorSheetFlags);
Hooks.once("setup", _setup);

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
