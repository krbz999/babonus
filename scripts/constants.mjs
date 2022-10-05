export const MODULE = "babonus";
export const MATCH = { ANY: "ANY", ALL: "ALL" }
export const targetTypes = [
  "attack", // bonuses to attack rolls
  "damage", // bonuses to damage rolls, critical damage, critical bonus dice
  "save", // bonuses to the save DC
  "throw", // bonuses to a saving throw
  "check", // bonuses to an ability check (or skill/tool check)
  "hitdie", // bonuses to hit die rolls
  "init", // bonses to initiative rolls
];
export const attackTypes = ["mwak", "rwak", "msak", "rsak"];
export const handlingRegular = [
  "baseWeapons",
  "damageTypes",
  "spellSchools",
  "abilities",
  "attackTypes",
  "spellLevels",
  "saveAbilities",
  "statusEffects",
  "targetEffects"
];
export const handlingSpecial = [
  "spellComponents",
  "weaponProperties",
  "arbitraryComparison"
];

// item types that cannot GRANT a bonus.
export const itemsWithoutBonuses = [
  "background",
  "class",
  "subclass",
  "spell"
];

// item types that a bonus can apply to.
export const itemsWithBonusesApplying = [
  "consumable",
  "equipment",
  "feat",
  "spell",
  "weapon"
];
