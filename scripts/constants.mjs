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

// item types that cannot GRANT a bonus.
export const itemsWithoutBonuses = [
  "background",
  "class",
  "subclass",
  "spell"
];

// item types that can get a bonus when rolling attack, damage, or showing a save dc.
export const itemsValidForAttackDamageSave = [
  "consumable",
  "equipment",
  "feat",
  "spell",
  "weapon"
];
