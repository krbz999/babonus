export const MODULE = "babonus";
export const SETTING_HEADERLABEL = "headerLabel";
export const MATCH = { ANY: "ANY", ALL: "ALL" }
export const targetTypes = [
  "attack", // bonuses to attack rolls, crit range, fumble range
  "damage", // bonuses to damage rolls, critical damage, critical bonus dice
  "save", // bonuses to the save DC
  "throw", // bonuses to a saving throw, and death save target value
  "hitdie", // bonuses to hit die rolls
];
export const attackTypes = ["mwak", "rwak", "msak", "rsak"];

// item types that cannot GRANT a bonus.
export const itemsWithoutBonuses = [
  "background",
  "class",
  "subclass",
  "race"
];

// item types that can get a bonus when rolling attack, damage, or showing a save dc.
export const itemsValidForAttackDamageSave = [
  "consumable",
  "equipment",
  "feat",
  "spell",
  "weapon"
];

// the disposition of an aura (allies, enemies, or all).
export const auraTargets = {
  ALLY: 1,
  ENEMY: -1,
  ANY: 2
}

export const FILTER_NAMES = [
  "itemTypes",
  "throwTypes",
  "itemRequirements",
  "arbitraryComparison",
  "statusEffects",
  "targetEffects",
  "attackTypes",
  "damageTypes",
  "abilities",
  "saveAbilities",
  "spellComponents",
  "spellLevels",
  "spellSchools",
  "baseWeapons",
  "weaponProperties"
];

export const arbitraryOperators = [
  { value: "EQ", label: "=" },
  { value: "LT", label: "&lt;" },
  { value: "GT", label: "&gt;" },
  { value: "LE", label: "&le;" },
  { value: "GE", label: "&ge;" }
];
