export const MODULE = "babonus";
export const MODULE_NAME = "Build-a-Bonus";
export const MODULE_ICON = "fa-solid fa-otter";
export const SETTINGS = {
  AURA: "showAuraRanges",
  LABEL: "headerLabel",
  PLAYERS: "allowPlayers",
  SCRIPT: "disableCustomScriptFilter"
};

// the kind of matching done for spell components (at least 1 vs matching all).
export const SPELL_COMPONENT_MATCHING = {ANY: "ANY", ALL: "ALL"};

// item types that can get a bonus when rolling attack, damage, or showing a save dc.
export const ITEM_ROLL_TYPES = ["consumable", "equipment", "feat", "spell", "weapon"];

// item types that can be equipped/attuned (as of 2.1.0).
export const EQUIPPABLE_TYPES = ["weapon", "equipment", "consumable", "tool", "backpack"];

// the disposition of an aura (targeting allies, enemies, or all).
export const AURA_TARGETS = {ALLY: 1, ENEMY: -1, ANY: 2};

// names of all filters.
export const FILTER_NAMES = [
  "abilities",
  "arbitraryComparison",
  "attackTypes",
  "baseArmors",
  "baseWeapons",
  "baseTools",
  "creatureTypes",
  "customScripts",
  "damageTypes",
  "healthPercentages",
  "itemRequirements",
  "itemTypes",
  "preparationModes",
  "remainingSpellSlots",
  "saveAbilities",
  "skillIds",
  "spellComponents",
  "spellLevels",
  "spellSchools",
  "statusEffects",
  "targetEffects",
  "throwTypes",
  "tokenSizes",
  "weaponProperties"
];

// arbitrary operators
export const ARBITRARY_OPERATORS = {EQ: "=", LT: "<", GT: ">", LE: "<=", GE: ">="};
