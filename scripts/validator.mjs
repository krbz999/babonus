import { attackTypes, itemsValidForAttackDamageSave, MODULE } from "./constants.mjs";

/**
 * The big functon to remove empty values and turn semicolon-
 * separated lists into an array. This does NOT check if all
 * required fields are present.
 */
export function validateData(formData) {
  // semicolon-sep lists to array:
  const {
    abilities,
    weaponIds,
    damageTypes, healingTypes,
    spellComponents,
    spellTags,
    spellSchools,
    weaponProperties
  } = CONFIG.DND5E;
  const statusIds = CONFIG.statusEffects.map(i => i.id);

  const throwTypes = Object.keys(abilities).concat("death");
  if (game.modules.get("concentrationnotifier")?.active) {
    throwTypes.push("concentration");
  }

  const scsv = [
    [itemsValidForAttackDamageSave, "itemTypes"],
    [Object.keys(abilities), "filters.abilities"],
    [Object.keys(weaponIds), "filters.baseWeapons"],
    [
      Object.keys(damageTypes).concat(Object.keys(healingTypes)),
      "filters.damageTypes"
    ],
    [
      Object.keys(spellComponents).concat(Object.keys(spellTags)),
      "filters.spellComponents.types"
    ],
    [Object.keys(spellSchools), "filters.spellSchools"],
    [statusIds, "filters.statusEffects", false],
    [statusIds, "filters.targetEffects", false],
    [Object.keys(weaponProperties), "filters.weaponProperties.needed"],
    [Object.keys(weaponProperties), "filters.weaponProperties.unfit"],
    [attackTypes, "filters.attackTypes"],
    [Object.keys(abilities), "filters.saveAbilities"],
    [throwTypes, "throwTypes"],
    [statusIds, "aura.blockers", false]
  ];
  for (const [values, property, validate] of scsv) {
    validateValues(formData, values, property, validate);
  }

  // values that just get deleted if they are falsy:
  const dels = [
    "values.criticalBonusDamage",
    "values.criticalBonusDice",
    "values.bonus",
    "values.criticalRange",
    "values.fumbleRange",
    "values.deathSaveTargetValue"
  ];
  for (const value of dels) {
    deleteEmptyValue(formData, value);
  }

  const toFilter = [
    ["filters.spellLevels", Array.fromRange(10)]
  ];
  for (const [arr, values] of toFilter) {
    filterArray(formData, arr, values);
  }

  // SPECIAL CASES:

  // AURA: if not aura, or lacks both range and template, delete all aura stuff
  const deleteAura = !formData["aura.enabled"] || (!formData["aura.range"] && !formData["aura.isTemplate"]);
  if (deleteAura) {
    delete formData["aura.enabled"];
    delete formData["aura.range"];
    delete formData["aura.isTemplate"];
    delete formData["aura.disposition"];
    delete formData["aura.self"];
    delete formData["aura.blockers"];
  }
  // if affects template, delete range and blockers.
  else if (formData["aura.isTemplate"]) {
    delete formData["aura.range"];
    delete formData["aura.blockers"];
  }
  // if has range, delete template
  else if (formData["aura.range"]) {
    delete formData["aura.isTemplate"];
  }

  // spellcomponents:
  if (!formData["filters.spellComponents.types"]) {
    delete formData["filters.spellComponents.match"];
  }

  // comparison:
  const a = "filters.arbitraryComparison.one";
  const b = "filters.arbitraryComparison.other";
  const c = "filters.arbitraryComparison.operator";
  if (!formData[a] || !formData[b] || !formData[c]) {
    delete formData[a];
    delete formData[b];
    delete formData[c];
  }

  // itemRequirements:
  // ... no attention needed.
}

// delete values that are falsy.
function deleteEmptyValue(formData, value) {
  const k = formData[value]?.trim();
  if (!k) delete formData[value];
}

// filter arrays, removing falsy values.
function filterArray(formData, property, values) {
  formData[property] = formData[property]?.filter(v => values.includes(v)) ?? [];
  if (!formData[property]?.length) delete formData[property];
}

// mutate formData by turning semicolon-sep'd lists into arrays.
function validateValues(formData, values, property, validate = true) {
  const ids = formData[property]?.split(";").map(i => {
    return i.trim();
  }).filter(i => {
    if (validate) return values.includes(i);
    return !!i;
  });
  if (!ids?.length) delete formData[property];
  else formData[property] = ids;
}

// returns key and value ready to use 'setFlag'.
export function finalizeData(formData) {
  // finally:
  const id = formData.identifier;
  const target = formData.target;
  delete formData.identifier;
  delete formData.target;
  formData.enabled = true;
  return {
    key: `bonuses.${target}.${id}`,
    value: formData,
    del: `flags.${MODULE}.bonuses.${target}.-=${id}`
  };

}

/**
 * Returns true or false if the data passes the minimum requirements.
 * This function is called after deleting empty fields and before expansion.
 */
export function dataHasAllRequirements(formData, object, editMode = false) {
  const dupe = foundry.utils.expandObject(formData);

  // does data have a label?
  if (!dupe.label) {
    return { valid: false, error: "MISSING_LABEL" };
  }

  // does data have an identifier?
  if (!dupe.identifier) {
    return { valid: false, error: "MISSING_ID" };
  }

  // does data have a target?
  if (!dupe.target) {
    return { valid: false, error: "MISSING_TARGET" };
  }

  // is the id unique?
  if (!editMode) {
    const api = game.modules.get(MODULE).api;
    const hasBonus = !!api.findBonus(object, dupe.identifier);
    if (hasBonus) {
      return { valid: false, error: "DUPLICATE_ID" };
    }
  }

  // does data have any bonus?
  if (!dupe.values) {
    return { valid: false, error: "MISSING_BONUS" };
  }

  // does data have description?
  if (!dupe.description) {
    return { valid: false, error: "MISSING_DESC" };
  }

  // if attack/damage/save, does bonus have itemTypes?
  if (["attack", "damage", "save"].includes(dupe.target)) {
    if (!dupe.itemTypes) {
      return { valid: false, error: "MISSING_ITEM_TYPES" };
    }
  }

  // if throw, does bonus have throwTypes?
  if (["throw"].includes(dupe.target)) {
    if (!dupe.throwTypes) {
      return { valid: false, error: "MISSING_THROW_TYPES" };
    }
  }

  // does data have at least one filter?
  if (!dupe.filters) {
    return { valid: false, error: "MISSING_FILTER" };
  }

  return { valid: true };
}
