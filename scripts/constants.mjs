export const MODULE = "babonus";
export const SETTING_HEADERLABEL = "headerLabel";
export const MATCH = { ANY: "ANY", ALL: "ALL" }
export const targetTypes = [
  "attack", // bonuses to attack rolls
  "damage", // bonuses to damage rolls, critical damage, critical bonus dice
  "save", // bonuses to the save DC
  "throw", // bonuses to a saving throw
  "hitdie", // bonuses to hit die rolls
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
export const auraTargets = {
  FRIENDLY: 1,
  HOSTILE: -1,
  ALL: 2
}
