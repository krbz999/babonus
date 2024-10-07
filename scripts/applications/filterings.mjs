import {MODULE, SETTINGS} from "../constants.mjs";
import BonusCollection from "./bonus-collection.mjs";
import BonusCollector from "./bonus-collector.mjs";

/**
 * @typedef {object} SubjectConfig
 * @property {Activity} [activity]      The activity that was used.
 * @property {Item5e} [item]            The item whose activity was used.
 * @property {Actor5e} actor            The actor performing a roll or using an item.
 */

/* -------------------------------------------------- */

/**
 * @typedef {object} DetailsConfig
 * @property {string} [ability]               If a saving throw, the ability used.
 * @property {boolean} [isConcentration]      If a saving throw, whether this is for concentration.
 * @property {boolean} [isDeath]              If a saving throw, whether this is a death save.
 *
 * @property {string} [abilityId]             If an ability check, the ability used.
 * @property {string} [skillId]               If a skill check, the id of the skill.
 * @property {string} [toolId]                If a tool check, the id of the tool type.
 *
 * @property {number} [spellLevel]            The level of the spell, when available.
 * @property {string} [attackMode]            If a damage roll, the attack mode.
 */

/* -------------------------------------------------- */

/**
 * @param {SubjectConfig} subjects      Subject config.
 * @param {string} type                 The type of roll.
 * @param {DetailsConfig} details       Details config.
 * @returns {BonusCollection}           The filtered Collection.
 */
function _check(subjects, type, details) {
  const collector = new BonusCollector({...subjects, type: type});
  const bonuses = collector.returnBonuses();
  const filtered = _finalFilterBonuses(type, bonuses, subjects, details);
  setTimeout(() => collector.destroyAuras(), 2000);
  return new BonusCollection(filtered);
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to hit die rolls.
 * @param {SubjectConfig} subjects      Subject config.
 * @returns {BonusCollection}           The filtered Collection.
 */
export function hitDieCheck(subjects) {
  return _check(subjects, "hitdie", {});
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to saving throws.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {DetailsConfig} details       Details config.
 * @returns {BonusCollection}           The filtered Collection.
 */
export function throwCheck(subjects, details) {
  return _check(subjects, "throw", details);
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to ability checks.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {DetailsConfig} details       Details config.
 * @returns {BonusCollection}           The filtered Collection.
 */
export function testCheck(subjects, details) {
  return _check(subjects, "test", details);
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to attack rolls, damage rolls, and save DCs.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {string} hookType             The type of hook ('attack', 'damage', or 'save').
 * @param {DetailsConfig} details       Details config.
 * @returns {BonusCollection}           The filtered Collection.
 */
export function itemCheck(subjects, hookType, details) {
  return _check(subjects, hookType, details);
}

/* -------------------------------------------------- */

/**
 * Filters the Collection of bonuses using the filters of Babonus.
 * @param {string} hookType                        The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
 * @param {Collection<Babonus>} bonuses     The babonuses to filter. **will be mutated**
 * @param {SubjectConfig} subjects          Subject config.
 * @param {DetailsConfig} details           Details config.
 * @returns {Collection<Babonus>}           The filtered Collection.
 */
function _finalFilterBonuses(hookType, bonuses, subjects, details) {
  /**
   * A hook that is called before the collection of bonuses has been filtered.
   * @param {Collection<Babonus>} bonuses     The collection of bonuses, before filtering.
   * @param {SubjectConfig} subjects          Subject config.
   * @param {DetailsConfig} details           Details config.
   * @param {string} hookType                 The type of hook being executed ('attack', 'damage',
   *                                          'save', 'throw', 'test', 'hitdie').
   */
  Hooks.callAll("babonus.preFilterBonuses", bonuses, subjects, details, hookType);

  for (const [key, bonus] of bonuses.entries()) {
    for (const [k, v] of Object.entries(bonus.filters)) {
      const filter = filters[k].call(bonus, subjects, v, details);
      if (!filter) {
        bonuses.delete(key);
        continue;
      }
    }
  }

  _replaceRollDataOfBonuses(bonuses, subjects);

  /**
   * A hook that is called after the collection of bonuses has been filtered.
   * @param {Collection<Babonus>} bonuses     The array of bonuses, after filtering.
   * @param {SubjectConfig} subjects          Subject config.
   * @param {DetailsConfig} details           Details config.
   * @param {string} hookType                 The type of hook being executed ('attack', 'damage',
   *                                          'save', 'throw', 'test', 'hitdie').
   */
  Hooks.callAll("babonus.filterBonuses", bonuses, subjects, details, hookType);

  return bonuses;
}

/* -------------------------------------------------- */

/**
 * Replace roll data of bonuses that originate from foreign sources, including transferred effects.
 * @param {Collection<Babonus>} bonuses     A collection of babonuses whose bonuses to replace.
 * @param {SubjectConfig} subjects          Subject config.
 */
function _replaceRollDataOfBonuses(bonuses, {activity, item, actor}) {
  for (const bonus of bonuses) {
    const src = bonus.origin;

    // Don't bother if the origin could not be found.
    if (!src) continue;

    // Don't bother with different roll data if the origin is the current actor rolling.
    if (src === actor) continue;

    // Don't bother with different roll data if the origin is the item being rolled.
    if (src.uuid === item?.uuid) continue;

    const data = src.getRollData(); // TODO: when adding rolls, we might be able to just use the bonus' roll data entirely.

    // If the bonus was retrieved from the template of a spell, modify the roll data.
    if (bonus.parent instanceof MeasuredTemplateDocument) {
      const spellLevel = parseInt(bonus.parent.flags.dnd5e?.spellLevel);
      if (Number.isInteger(spellLevel)) foundry.utils.setProperty(data, "item.level", spellLevel);
    }

    const update = Object.entries(bonus.bonuses).reduce((acc, [key, val]) => {
      if (!val || (typeof val !== "string")) return acc;
      acc[key] = Roll.replaceFormulaData(val, data, {missing: 0});
      return acc;
    }, {});
    try {
      bonus.updateSource({bonuses: update});
    } catch (err) {
      console.warn("Babonus | Issue updating bonus data:", err);
    }
  }
}

/* -------------------------------------------------- */

/**
 * Split a set into 'included' and 'exluded'.
 * @param {Set<string>} filter      The set of strings, some with '!' prefixed.
 * @returns {object}                An object with two sets of strings.
 */
function _splitExlusion(filter) {
  const rgx = /([!]+)?(.+)/;
  const data = filter.reduce((acc, str) => {
    const [, bangs, string] = str.match(rgx) ?? [];
    if (!string) return acc;
    if (bangs) acc.excluded.add(string);
    else acc.included.add(string);
    return acc;
  }, {included: new Set(), excluded: new Set()});
  return data;
}

/* -------------------------------------------------- */

/**
 * Utility function to split a string by '/'.
 * @param {string} str        The string to split.
 * @returns {Set<string>}     The set of strings.
 */
function _split(str) {
  str ||= "";
  return str.split("/").reduce((acc, e) => {
    const trim = e.trim().toLowerCase();
    if (trim.length) acc.add(trim);
    return acc;
  }, new Set());
}

/* -------------------------------------------------- */

/**
 * Utility function to split racial values.
 * @param {Actor5e} actor     The actor.
 * @returns {Set<string>}     The different 'races' to compare against.
 */
function _splitRaces(actor) {
  let races = new Set();

  /**
   * Find the type object on the actor to read from. We prefer the actor data,
   * since that is subject to effects and later changes, while the race item is not.
   */
  const type = actor.system.details?.type;

  if (type) {
    races = _split(type.subtype);
    if (type.value === "custom") _split(type.custom).forEach(k => races.add(k));
    else races.add(type.value);
  }
  return races;
}

/* -------------------------------------------------- */

/**
 * Return whether a set of values overlaps a non-empty set of required values,
 * while also not overlapping a non-empty set of excluded values.
 * @param {Set<*>} values       The current values.
 * @param {Set<*>} included     Required values.
 * @param {Set<*>} excluded     Excluded values.
 * @returns {boolean}           Result of the test.
 */
function _testInclusion(values, included, excluded) {
  if (included.size && !included.intersects(values)) return false;
  if (excluded.size && excluded.intersects(values)) return false;
  return true;
}

/* -------------------------------------------------- */
/*   Filtering functions                              */
/* -------------------------------------------------- */

export const filters = {
  abilities,
  actorCreatureSizes,
  actorCreatureTypes,
  actorLanguages,
  arbitraryComparisons,
  attackModes,
  baseArmors,
  baseTools,
  baseWeapons,
  creatureTypes,
  customScripts,
  damageTypes,
  featureTypes,
  healthPercentages,
  identifiers,
  itemTypes,
  markers,
  preparationModes,
  proficiencyLevels,
  remainingSpellSlots,
  saveAbilities,
  skillIds,
  sourceClasses,
  spellComponents,
  spellLevels,
  spellSchools,
  statusEffects,
  targetArmors,
  targetEffects,
  throwTypes,
  tokenSizes,
  weaponProperties
};

/* -------------------------------------------------- */

/**
 * Find out if the item is using one of the abilities in the filter. Consideration is made
 * by the system itself for items set to 'Default' to look for finesse weapons and spellcasting
 * abilities. Note that this is the ability set at the top level of the item's action, and
 * is NOT the ability used to determine the dc of the saving throw.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of abilities.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the actor or item is using one of the abilities.
 */
function abilities(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  let abi;

  // Case 1: Tool Checks.
  if (details.toolId) abi = details.abilityId;

  // Case 2: Attack/Damage rolls.
  else if (subjects.activity) abi = subjects.activity.ability;

  // Case 3: AbilityTest or Skill.
  else if (subjects.actor) abi = details.abilityId;

  if (!abi) return false;

  // Test the filters.
  return _testInclusion(new Set([abi]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is one of the correct creature sizes.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of valid creature sizes.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the actor is a correct creature size.
 */
function actorCreatureSizes(subjects, filter, details) {
  if (!filter.size) return true;
  const size = subjects.actor.system.traits?.size;
  return !!size && filter.has(size);
}

/* -------------------------------------------------- */

/**
 * Find out if the rolling actor is one of the included creature etypes and none of the excluded types.
 * In the case of no values, refer to whether any specific creature type was included.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of creature types the rolling actor must or must not be.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the rolling actor is of a valid creature type.
 */
function actorCreatureTypes(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  const ad = subjects.actor.system.details;
  if (!ad) return !included.size;

  // All the races the rolling actor is a member of.
  const races = _splitRaces(subjects.actor);

  return _testInclusion(races, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor speaks one of the included languages while not any of the excluded languages.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of languages the actor must speak or not speak.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}
 */
function actorLanguages(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);

  const values = subjects.actor.system.traits?.languages?.value;
  if (!values) return false;

  const speaksAny = included.some(lang => babonus.speaksLanguage(subjects.actor, lang));
  if (included.size && !speaksAny) return false;

  if (!excluded.size) return true;

  // If e.g. "standard" is excluded, the actor must not be able to speak "dwarvish".
  for (const k of values) {
    const nodes = new Set(babonus.proficiencyTree(k, "languages"));
    if (nodes.intersects(excluded)) return false;
  }
  return true;
}

/* -------------------------------------------------- */

/**
 * Find out if 'one' and 'other have the correct relationship for each of the comparisons.
 * If 'one' and 'other' do not both evaluate to numbers, string comparison is instead used.
 * For string comparison, inequality operators are taken to mean substrings. The comparisons
 * are done after replacing any roll data.
 * @this {Babonus}
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object[]} filter               An array of objects with 'one', 'other', and 'operator'.
 * @param {string} filter[].one           One value to compare against another.
 * @param {string} filter[].other         One value to compare against another.
 * @param {string} filter[].operator      The kind of comparison to make between the two values.
 * @param {DetailsConfig} details         Details config.
 * @returns {boolean}                     Whether every comparison were in the correct relationship.
 */
function arbitraryComparisons(subjects, filter, details) {
  if (!filter.length) return true;

  const rollData = (subjects.activity ?? subjects.item ?? subjects.actor).getRollData();
  const target = game.user.targets.first();
  if (target?.actor) rollData.target = target.actor.getRollData();

  for (const {one, other, operator} of filter) {
    // This method immediately returns false if invalid data somehow.
    if (!one || !other) return false;

    const left = Roll.replaceFormulaData(one, rollData);
    const right = Roll.replaceFormulaData(other, rollData);

    try {
      // try comparing numbers.
      const nLeft = Roll.create(left).evaluateSync().total;
      const nRight = Roll.create(right).evaluateSync().total;
      if ((operator === "EQ") && !(nLeft === nRight)) return false;
      else if ((operator === "LT") && !(nLeft < nRight)) return false;
      else if ((operator === "GT") && !(nLeft > nRight)) return false;
      else if ((operator === "LE") && !(nLeft <= nRight)) return false;
      else if ((operator === "GE") && !(nLeft >= nRight)) return false;
    } catch {
      // try comparing strings.
      if ((operator === "EQ") && !(left == right)) return false;
      else if (["LT", "LE"].includes(operator) && !(right.includes(left))) return false;
      else if (["GT", "GE"].includes(operator) && !(left.includes(right))) return false;
    }
  }
  return true;
}

/* -------------------------------------------------- */

/**
 * For damage rolls only, filter by the attack classification and mode.
 * @this {Babonus}
 * @param {SubjectConfig} subjects                Subject config.
 * @param {object} filter                         The array of attack types.
 * @param {Set<string>} filter.value              The attack type (melee, ranged).
 * @param {Set<string>} filter.classification     The attack classification (weapon, spell, unarmed).
 * @param {Set<string>} filter.mode               The attack mode (offhand, one-handed, etc.).
 * @param {DetailsConfig} details                 Details config.
 * @returns {boolean}                             Whether the item has any of the required attack types.
 */
function attackModes(subjects, filter, details) {
  if (subjects.activity.type !== "attack") return true;
  const {value, classification} = subjects.activity.attack.type;
  if (filter.value.size && !filter.value.has(value)) return false;
  if (filter.classification.size && !filter.classification.has(classification)) return false;
  if (filter.mode.size && !filter.mode.has(details.attackMode)) return false;

  return true;
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is wearing one of the included armor types
 * in the filter and none of the excluded types. Note that this includes shields as well.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of base armor keys.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the rolling actor is wearing appropriate armor.
 */
function baseArmors(subjects, filter, details) {
  const {included, excluded} = _splitExlusion(filter);

  const ac = subjects.actor.system.attributes?.ac ?? {};
  const shield = ac?.equippedShield ?? null;
  const armor = ac?.equippedArmor ?? null;
  const types = new Set();
  if (shield) types.add(shield.system.type.baseItem).add(shield.system.type.value);
  if (armor) types.add(armor.system.type.baseItem).add(armor.system.type.value);
  if (ac.calc === "natural") types.add("natural");

  // If no armor worn.
  if (!types.size) return !(included.size > 0);

  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the tool being rolled for a check is one of the correct types.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of tool types.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the tool type matches the filter.
 */
function baseTools(sujects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (!details.toolId) return !included.size;

  const types = new Set(babonus.proficiencyTree(details.toolId, "tool"));
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the item's base weapon type is one of the valid ones in the filter.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of weapon baseItem keys.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item's baseItem was in the filter.
 */
function baseWeapons(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (subjects.item.type !== "weapon") return !included.size;
  const types = new Set([subjects.item.system.type.value, subjects.item.system.type.baseItem]);
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the target is one of the included creature types and none of the excluded types.
 * In the case of no targets, refer to whether any specific creature type was included.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of creature types the target must or must not be.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the target is of a valid creature type.
 */
function creatureTypes(subjects, filter, details) {
  if (!filter.size) return true;
  const target = game.user.targets.first();
  const {included, excluded} = _splitExlusion(filter);
  const ad = target?.actor?.system.details;
  if (!ad) return !included.size;

  // All the races the target is a member of.
  const races = _splitRaces(target.actor);

  return _testInclusion(races, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the embedded script returns true.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {string} script               The script saved in the filter.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   True if the script returns true, otherwise false.
 */
function customScripts(subjects, script, details) {
  if (!script?.length) return true;
  if (game.settings.get(MODULE.ID, SETTINGS.SCRIPT)) return true;
  try {
    const {actor, item, activity} = subjects;
    const func = Function("actor", "item", "token", "bonus", "activity", "details", script);
    const token = (actor.isToken ? actor.token.object : actor.getActiveTokens()[0]) ?? null;
    const valid = func.call(func, actor, item, token, this, activity, details) === true;
    return valid;
  } catch (err) {
    console.error(err);
    return false;
  }
}

/* -------------------------------------------------- */

/**
 * Find out if the item has any of the included damage types in its damage parts and none of the excluded types.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of damage types.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item's damage types overlap with the filter.
 */
function damageTypes(subjects, filter, details) {
  if (!filter.size) return true;
  let parts;
  switch (subjects.activity.type) {
    case "heal":
      parts = [subjects.activity.healing];
      break;
    case "attack":
    case "damage":
      parts = subjects.activity.damage.parts;
      break;
    default:
      return false;
  }
  const types = parts.reduce((acc, part) => acc.union(part.types), new Set());
  const {included, excluded} = _splitExlusion(filter);
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the item that made the roll was the correct feature type and feature subtype.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filter object.
 * @param {string} [filter.type]        The feature type.
 * @param {string} [filter.subtype]     The feature subtype.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the feature is the correct type.
 */
function featureTypes(subjects, {type, subtype}, details) {
  const config = CONFIG.DND5E.featureTypes;
  if (!type || !(type in config)) return true;
  if (subjects.item.type !== "feat") return false;
  if (type !== subjects.item.system.type.value) return false;

  const subtypes = config[type]?.subtypes ?? {};
  const hasSubtype = !foundry.utils.isEmpty(subtypes);
  if (!hasSubtype || !subtype) return true;

  return subjects.item.system.type.subtype === subtype;
}

/* -------------------------------------------------- */

/**
 * Find out if the health of the actor is at or above/below the threshold.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The object used for the filtering.
 * @param {number} filter.value         The hit point percentage threshold.
 * @param {number} filter.type          The type of threshold (0 for 'x or lower' and 1 for 'x and higher').
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the threshold is obeyed.
 */
function healthPercentages(subjects, filter, details) {
  if (!Number.isNumeric(filter.value) || ![0, 1].includes(filter.type)) return true;
  if (!subjects.actor.system.attributes?.hp) return false;
  const hp = subjects.actor.system.attributes.hp.pct; // this takes tempmax into account, but not temphp.
  return ((filter.type === 0) && (hp <= filter.value)) || ((filter.type === 1) && (hp >= filter.value));
}

/* -------------------------------------------------- */

/**
 * Find out if the item being used has the right identifier.
 * @this {Babonus}
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of identifiers.
 * @param {DetailsConfig} details         Details config.
 * @returns {boolean}                     Whether the identifier of the item is valid.
 */
function identifiers(subjects, filter, details) {
  return !filter.values.size || filter.values.has(subjects.item.identifier);
}

/* -------------------------------------------------- */

/**
 * Find out if the item's type is one of the valid ones in the filter.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of item type keys.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item's type was in the filter.
 */
function itemTypes(subjects, filter, details) {
  return !filter.size || filter.has(subjects.item.type);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor or item has any of the valid markers, as well as the target.
 * @this {Babonus}
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of valid markers on the one performing the roll.
 * @param {Set<string>} filter.target     The set of valid markers on the target.
 * @param {DetailsConfig} details         Details config.
 * @returns {boolean}                     Whether the actor or item has any of the valid markers.
 */
function markers(subjects, filter, details) {

  const _hasMarker = (document, markers) => {
    const stored = document.getFlag("babonus", "markers") ?? [];
    return stored.some(marker => markers.has(marker));
  };

  const hasMarker = (document, markers) => {
    if (_hasMarker(document, markers)) return true;

    for (const effect of document.allApplicableEffects?.() ?? []) {
      if (effect.active && _hasMarker(effect, markers)) return true;
    }

    return false;
  };

  if (filter.values.size) {
    const itemMarked = !subjects.item || hasMarker(subjects.item, filter.values);
    if (!itemMarked && !hasMarker(subjects.actor, filter.values)) return false;
  }

  if (filter.target.size) {
    const targetActor = game.user.targets.first()?.actor;
    if (!targetActor || !hasMarker(targetActor, filter.target)) return false;
  }

  return true;
}

/* -------------------------------------------------- */

/**
 * Find out if the spell that is cast is one able to consume a spell slot.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of preparation modes allowed.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the spell matches the preparation mode.
 */
function preparationModes(subjects, filter, details) {
  return !filter.size || ((subjects.item.type === "spell") && filter.has(subjects.item.system.preparation.mode));
}

/* -------------------------------------------------- */

/**
 * Find out if the roll was proficient, and if at a valid level.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<number>} filter          The levels of valid proficiencies.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the roll was one of the proficiency levels.
 */
function proficiencyLevels(subjects, filter, details) {
  if (!filter.size) return true;

  // Case 1: Skill.
  if (details.skillId) {
    return filter.has(subjects.actor.system.skills[details.skillId]?.prof.multiplier || 0);
  }

  // Case 2: Ability Check.
  else if (details.abilityId && !details.toolId) {
    return filter.has(subjects.actor.system.abilities[details.abilityId]?.checkProf.multiplier || 0);
  }

  // Case 3: Death Saving Throw.
  else if (details.isDeath) {
    return filter.has(Number(subjects.actor.flags.dnd5e?.diamondSoul || false));
  }

  // Case 4: Saving Throw.
  else if (details.ability) {
    return filter.has(subjects.actor.system.abilities[details.ability]?.saveProf.multiplier || 0);
  }

  // Case 5: Weapon, equipment, spell, tool item.
  else if (subjects.item) {
    return filter.has(subjects.item.system.prof.multiplier);
  }

  // Case 6: Tool check without an item.
  else if (details.toolId) {
    return filter.has(subjects.actor.system.tools[details.toolId]?.prof.multiplier || 0);
  }

  // Else somehow return false.
  else return false;
}

/* -------------------------------------------------- */

/**
 * Find out if the actor has a number of spell slots remaining between the min and max.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filtering for the bonus.
 * @param {number} filter.min           The minimum value available required for the bonus to apply.
 * @param {number} filter.max           The maximum value available required for the bonus to apply.
 * @param {boolean} [filter.size]       Whether to take the size of the spell slot into account.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the number of spell slots remaining falls within the bounds.
 */
function remainingSpellSlots(subjects, {min, max, size = false}, details) {
  if (![min, max].some(m => Number.isInteger(m))) return true;
  const spells = Object.values(subjects.actor.system.spells ?? {}).reduce((acc, val) => {
    if (!val.level || !val.value || !val.max) return acc;
    return acc + Math.clamp(val.value, 0, val.max) * (size ? val.level : 1);
  }, 0);
  return spells.between(min || 0, max || Infinity);
}

/* -------------------------------------------------- */

/**
 * Find out if the saving throw in the activity is set using an ability in the filter.
 * This filter is only available for bonuses applying specifically to saving throw DCs.
 * Special consideration is made for activities with save DC set using spellcasting ability.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The ability that is used to set the DC of the item's saving throw.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item's saving throw is set using an ability in the filter.
 */
function saveAbilities(subjects, filter, details) {
  if (!filter.size) return true;
  if (subjects.activity.type !== "save") return false;
  if (!subjects.activity.save.dc.calculation) return false;

  const {included, excluded} = _splitExlusion(filter);
  let abl;
  if (subjects.activity.save.dc.calculation === "spellcasting") {
    abl = subjects.activity.spellcastingAbility;
  } else {
    abl = subjects.activity.save.dc.calculation;
  }

  return _testInclusion(new Set([abl]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the skill being rolled is one of the correct types.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of skill ids.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the skill matches the filter.
 */
function skillIds(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (!details.skillId) return !included.size;
  return _testInclusion(new Set([details.skillId]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Does this spell belong to a specific class?
 * @this {Babonus}
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of class identifiers.
 * @param {DetailsConfig} details         Details config.
 * @returns {boolean}                     Whether the source class of the spell is valid.
 */
function sourceClasses(subjects, filter, details) {
  if (subjects.item.type !== "spell") return true;
  return !filter.values.size || filter.values.has(subjects.item.system.sourceClass);
}

/* -------------------------------------------------- */

/**
 * Find out if the item is a spell and has any, or all, of the required spell components.
 * The item must match either all or at least one, depending on what is set.
 * @this {Babonus}
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filtering object.
 * @param {Set<string>} filter.types      The array of spell components in the filter.
 * @param {string} filter.match           The type of matching, either 'ALL' or 'ANY'.
 * @param {DetailsConfig} details         Details config.
 * @returns {boolean}                     Whether the item matched correctly with the components.
 */
function spellComponents(subjects, filter, details) {
  if (!filter.types.size) return true;
  if (subjects.item.type !== "spell") return false;
  const comps = subjects.item.system.properties;

  switch (filter.match) {
    case "ALL":
      return filter.types.isSubset(comps);
    case "ANY":
      return filter.types.intersects(comps);
    default:
      return false;
  }
}

/* -------------------------------------------------- */

/**
 * Find out if the item was cast at any of the required spell levels. When a spell is upcast,
 * the item here is the cloned spell only in the case of save dc bonuses, meaning we need to
 * pass on the correct spell level for attack and damage roll bonuses.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<number>} filter          The set of spell levels in the filter.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item is at one of the appropriate levels.
 */
function spellLevels(subjects, filter, details) {
  if (!filter.size) return true;
  if (subjects.item.type !== "spell") return false;
  return filter.has(details.spellLevel ?? subjects.item.system.level);
}

/* -------------------------------------------------- */

/**
 * Find out if the item is a spell and belongs to one of the filter's spell schools.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of spell schools.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item is a spell and is of one of these schools.
 */
function spellSchools(subjects, filter, details) {
  return !filter.size || ((subjects.item.type === "spell") && filter.has(subjects.item.system.school));
}

/* -------------------------------------------------- */

/**
 * Find out if the actor has any of the included effects and none of the excluded effects.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of effect statuses you must have or must not have.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the actor has any included effects and no excluded effects.
 */
function statusEffects(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);

  // Discard any conditions the actor is immune to.
  const ci = subjects.actor.system.traits?.ci?.value ?? new Set();
  for (const k of ci) {
    included.delete(k);
    excluded.delete(k);
  }

  return _testInclusion(subjects.actor.statuses, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is wearing one of the included armor types
 * in the filter and none of the excluded types. Note that this includes shields as well.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of base armor keys.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the rolling actor is wearing appropriate armor.
 */
function targetArmors(subjects, filter, details) {
  const target = game.user.targets.first()?.actor;
  if (!target) return !_splitExlusion(filter).included.size;
  return baseArmors({actor: target}, filter, details);
}

/* -------------------------------------------------- */

/**
 * Find out if the target actor has any of the status conditions required.
 * The bonus will apply if the target actor exists and has at least one.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of effect statuses the target must have or must not have.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the target actor has any of the status effects.
 */
function targetEffects(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  const actor = game.user.targets.first()?.actor;
  if (!actor) return !included.size;

  // Discard any conditions the actor is immune to.
  const ci = actor.system.traits?.ci?.value ?? new Set();
  for (const k of ci) {
    included.delete(k);
    excluded.delete(k);
  }

  return _testInclusion(actor.statuses, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the bonus should apply to this type of saving throw.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of saving throw types to check for.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the throw type is in the filter.
 */
function throwTypes(subjects, filter, details) {
  if (!filter.size) return true;
  return (!!details.ability && filter.has(details.ability))
    || (filter.has("concentration") && details.isConcentration)
    || (filter.has("death") && details.isDeath);
}

/* -------------------------------------------------- */

/**
 * Find out if the targeted token is at least x-by-x or larger, or at most x-by-x or smaller,
 * while optionally also at most as big or small as the roller's token.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filtering for the bonus.
 * @param {number} filter.size          The minimum/maximum size of the targeted token.
 * @param {number} filter.type          Whether it is 'at least' (0) or 'at most' (1).
 * @param {boolean} filter.self         Whether to clamp using the rolling token's size.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the targeted token matches the filter.
 */
function tokenSizes(subjects, filter, details) {
  if (!(filter.size > 0)) return true;
  const target = game.user.targets.first()?.document;
  if (!target) return false;
  const enemySize = Math.max(target.width, target.height);

  let se;
  if (filter.self) {
    const token = subjects.actor.token ?? subjects.actor.getActiveTokens(false, true)[0];
    if (!token) return false;
    se = Math.max(token.width, token.height);
  } else {
    se = filter.size;
  }

  switch (filter.type) {
    case 0:
      return enemySize >= Math.max(se, filter.size);
    case 1:
      return enemySize <= Math.min(se, filter.size);
    default:
      return false;
  }
}

/* -------------------------------------------------- */

/**
 * Find out if the item has any of the included weapon properties and none of the excluded properties.
 * @this {Babonus}
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of properties you must have one of or none of.
 * @param {DetailsConfig} details       Details config.
 * @returns {boolean}                   Whether the item has any of the included and none of the excluded properties.
 */
function weaponProperties(subjects, filter, details) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (subjects.item.type !== "weapon") return !included.size;
  const props = subjects.item.system.properties;
  return _testInclusion(props, included, excluded);
}
