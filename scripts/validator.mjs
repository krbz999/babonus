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
  const levels = Array.fromRange(10).map(n => n.toString());

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
    [levels, "filters.spellLevels"],
    [Object.keys(spellSchools), "filters.spellSchools"],
    [statusIds, "filters.statusEffects", false],
    [statusIds, "filters.targetEffects", false],
    [Object.keys(weaponProperties),"filters.weaponProperties.needed"],
    [Object.keys(weaponProperties), "filters.weaponProperties.unfit"],
    [attackTypes, "filters.attackTypes"],
    [Object.keys(abilities), "filters.saveAbilities"],
    [Object.keys(abilities).concat(["death"]), "throwTypes"],
    [statusIds, "aura.blockers", false]
  ];
  for (const [values, property, validate] of scsv) {
    validateValues(formData, values, property, validate);
  }

  // values that just get deleted if they are falsy:
  const dels = [
    "values.criticalBonusDamage",
    "values.criticalBonusDice",
    "values.criticalBonusDice",
    "values.bonus",
    "values.criticalRange",
    "values.fumbleRange",
    "values.deathSaveTargetValue"
  ];
  for (const value of dels) {
    deleteEmptyValue(formData, value);
  }



  // special cases:

  // aura:
  const e = "aura.enabled";
  const r = "aura.range";
  if (!formData[e] || !formData[r]) {
    delete formData[e];
    delete formData[r];
    delete formData["aura.disposition"];
    delete formData["aura.self"];
    delete formData["aura.blockers"];
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

// delete values that do not exist.
function deleteEmptyValue(formData, value) {
  if (!formData[value]) delete formData[value];
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

// returns true or false if the data passes the minimum requirements
// this function is called after deleting empty fields and before expansion.
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
    const t = dupe.target;
    const i = dupe.identifier;
    const flag = object.getFlag(MODULE, `bonuses.${t}.${i}`);
    if (flag) {
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
