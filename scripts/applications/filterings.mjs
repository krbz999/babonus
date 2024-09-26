import {MODULE, SETTINGS} from "../constants.mjs";
import BonusCollector from "./bonus-collector.mjs";

/**
 * @typedef {object} SubjectConfig
 * @property {Activity} [activity]      The activity that was used.
 * @property {Item5e} [item]            The item whose activity was used.
 * @property {Actor5e} actor            The actor performing a roll or using an item.
 */

/* -------------------------------------------------- */

/**
 * @param {SubjectConfig} subjects      Subject config.
 * @param {string} type                 The type of roll.
 * @param {object} [details]            Details for filtering.
 * @returns {Collection<Babonus>}       The filtered Collection.
 */
function _check(subjects, type, details = {}) {
  const collector = new BonusCollector({...subjects, type: type});
  const bonuses = collector.returnBonuses();
  const filtered = _finalFilterBonuses(type, bonuses, subjects, details);
  setTimeout(() => collector.destroyAuras(), 2000);
  return filtered;
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to hit die rolls.
 * @param {SubjectConfig} subjects      Subject config.
 * @returns {Collection<Babonus>}       The filtered Collection.
 */
export function hitDieCheck(subjects) {
  return _check(subjects, "hitdie");
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to saving throws.
 * @param {SubjectConfig} subjects                Subject config.
 * @param {object} details                        Additional context for the filtering and checks.
 * @param {string} [details.ability]              The ability used for the saving throw.
 * @param {boolean} [details.isConcentration]     Is this a concentration saving throw?
 * @param {boolean} [details.isDeath]             Is this a death saving throw?
 * @returns {Collection<Babonus>}                 The filtered Collection.
 */
export function throwCheck(subjects, {ability, isConcentration, isDeath}) {
  return _check(subjects, "throw", {ability, isConcentration, isDeath});
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to ability checks.
 * @param {SubjectConfig} subjects        Subject config.
 * @param {string} abilityId              The ability used for the test.
 * @param {object} [details]              Additional context for the filtering and checks.
 * @param {string} [details.skillId]      The id of the skill, in case of skill checks.
 * @param {string} [details.toolId]       The id of the tool type, in case of tool checks.
 * @param {Item5e} [details.item]         The tool being used if rolled from an item instead.
 * @returns {Collection<Babonus>}         The filtered Collection.
 */
export function testCheck(subjects, abilityId, {skillId, toolId} = {}) {
  return _check(subjects, "test", {abilityId, skillId, toolId});
}

/* -------------------------------------------------- */

/**
 * Initiate the collection and filtering of bonuses applying to attack rolls, damage rolls, and save DCs.
 * @param {SubjectConfig} subjects                Subject config.
 * @param {string} hookType                       The type of hook ('attack', 'damage', or 'save').
 * @param {object} [details]                      Additional context for the filtering and checks.
 * @param {number} [details.spellLevel]           The level of the spell, if needed.
 * @param {Set<string>} [details.attackModes]     The available attack modes.
 * @returns {Collection<Babonus>}                 The filtered Collection.
 */
export function itemCheck(subjects, hookType, details = {}) {
  return _check(subjects, hookType, details);
}

/* -------------------------------------------------- */

/**
 * Filters the Collection of bonuses using the filters of Babonus.
 * @param {string} hookType                        The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
 * @param {Collection<Babonus>} bonuses            The babonuses to filter. **will be mutated**
 * @param {SubjectConfig} subjects                 Subject config.
 * @param {object} [details]                       Additional data necessary to pass along.
 * @param {string} [details.ability]               The ability used for the saving throw.
 * @param {boolean} [details.isConcentration]      Is this a concentration saving throw?
 * @param {boolean} [detail.isDeath]               Is this a death saving throw?
 * @param {string} [details.abilityId]             The ability used for an ability check.
 * @param {string} [details.skillId]               The id of the skill, in case of skill checks.
 * @param {number} [details.spellLevel]            The level of the spell, if needed.
 * @param {string} [details.toolId]                The id of the tool type, in case of tool checks.
 * @returns {Collection<Babonus>}                  The filtered Collection.
 */
function _finalFilterBonuses(hookType, bonuses, subjects, details = {}) {
  /**
   * A hook that is called before the collection of bonuses has been filtered.
   * @param {Collection<Babonus>} bonuses     The collection of bonuses, before filtering.
   * @param {SubjectConfig} subjects          Subject config.
   * @param {object} [details={}]             Additional data passed along to perform the filtering.
   * @param {string} hookType                 The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
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
   * @param {object} [details]                Additional data passed along to perform the filtering.
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

    const data = src.getRollData();

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
  tags,
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
 * @param {SubjectConfig} subjects          Subject config.
 * @param {Set<string>} filter              The set of abilities.
 * @param {object} [details]                Additional context for the roll being performed.
 * @param {string} [details.abilityId]      The three-letter key of the ability used in the roll (checks only).
 * @param {string} [details.toolId]         The key for a tool type (tool checks only).
 * @returns {boolean}                       Whether the actor or item is using one of the abilities.
 */
function abilities({activity, item, actor}, filter, {abilityId, toolId} = {}) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  let abi;

  // Case 1: Tool Checks.
  if (toolId) abi = abilityId;

  // Case 2: Attack/Damage rolls.
  else if (activity) abi = activity.ability;

  // Case 3: AbilityTest or Skill.
  else if (actor) abi = abilityId;

  if (!abi) return false;

  // Test the filters.
  return _testInclusion(new Set([abi]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is one of the correct creature sizes.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of valid creature sizes.
 * @returns {boolean}                   Whether the actor is a correct creature size.
 */
function actorCreatureSizes({actor}, filter) {
  if (!filter.size) return true;
  const size = actor.system.traits?.size;
  return !!size && filter.has(size);
}

/* -------------------------------------------------- */

/**
 * Find out if the rolling actor is one of the included creature etypes and none of the excluded types.
 * In the case of no values, refer to whether any specific creature type was included.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of creature types the rolling actor must or must not be.
 * @returns {boolean}                   Whether the rolling actor is of a valid creature type.
 */
function actorCreatureTypes({actor}, filter) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  const details = actor.system.details;
  if (!details) return !included.size;

  // All the races the rolling actor is a member of.
  const races = _splitRaces(actor);

  return _testInclusion(races, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor speaks one of the included languages while not any of the excluded languages.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of languages the actor must speak or not speak.
 * @returns {boolean}
 */
function actorLanguages({actor}, filter) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);

  const values = actor.system.traits?.languages?.value;
  if (!values) return false;

  const speaksAny = included.some(lang => babonus.speaksLanguage(actor, lang));
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
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object[]} filter               An array of objects with 'one', 'other', and 'operator'.
 * @param {string} filter[].one           One value to compare against another.
 * @param {string} filter[].other         One value to compare against another.
 * @param {string} filter[].operator      The kind of comparison to make between the two values.
 * @returns {boolean}                     Whether every comparison were in the correct relationship.
 */
function arbitraryComparisons({activity, item, actor}, filter) {
  if (!filter.length) return true;

  const rollData = (activity ?? item ?? actor).getRollData();
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
 * @param {SubjectConfig} subjects                Subject config.
 * @param {object} filter                         The array of attack types.
 * @param {Set<string>} filter.value              The attack type (melee, ranged).
 * @param {Set<string>} filter.classification     The attack classification (weapon, spell, unarmed).
 * @param {Set<string>} filter.mode               The attack mode (offhand, one-handed, etc.).
 * @param {object} [details]                      Additional details.
 * @param {string} [details.attackMode]           The attack mode used if this damage roll comes after an attack.
 * @returns {boolean}                             Whether the item has any of the required attack types.
 */
function attackModes({activity, item, actor}, filter, details = {}) {
  if (activity.type !== "attack") return false;
  const {value, classification} = activity.attack.type;
  if (filter.value.size && !filter.value.has(value)) return false;
  if (filter.classification.size && !filter.classification.has(classification)) return false;
  if (filter.mode.size && !filter.mode.has(details.attackMode)) return false;

  return true;
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is wearing one of the included armor types
 * in the filter and none of the excluded types. Note that this includes shields as well.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of base armor keys.
 * @returns {boolean}                   Whether the rolling actor is wearing appropriate armor.
 */
function baseArmors({actor}, filter) {
  const {included, excluded} = _splitExlusion(filter);

  const ac = actor.system.attributes?.ac ?? {};
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
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of tool types.
 * @param {string} toolId               The type of tool being rolled.
 * @returns {boolean}                   Whether the tool type matches the filter.
 */
function baseTools(sujects, filter, {toolId}) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (!toolId) return !included.size;

  const types = new Set(babonus.proficiencyTree(toolId, "tool"));
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the item's base weapon type is one of the valid ones in the filter.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of weapon baseItem keys.
 * @returns {boolean}                   Whether the item's baseItem was in the filter.
 */
function baseWeapons({item}, filter) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (item.type !== "weapon") return !included.size;
  const types = new Set([item.system.type.value, item.system.type.baseItem]);
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the target is one of the included creature types and none of the excluded types.
 * In the case of no targets, refer to whether any specific creature type was included.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of creature types the target must or must not be.
 * @returns {boolean}                   Whether the target is of a valid creature type.
 */
function creatureTypes(subjects, filter) {
  if (!filter.size) return true;
  const target = game.user.targets.first();
  const {included, excluded} = _splitExlusion(filter);
  const details = target?.actor?.system.details;
  if (!details) return !included.size;

  // All the races the target is a member of.
  const races = _splitRaces(target.actor);

  return _testInclusion(races, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the embedded script returns true.
 * @param {SubjectConfig} subjects                Subject config.
 * @param {string} script                         The script saved in the filter.
 * @param {object} [details]                      Additional context to help filter the bonus.
 * @param {string} [details.ability]              The ability used for the saving throw.
 * @param {boolean} [details.isConcentration]     Is this a concentration saving throw?
 * @param {boolean} [details.isDeath]             Is this a death saving throw?
 * @param {string} [details.abilityId]            The ability used for an ability check.
 * @param {string} [details.skillId]              The id of the skill, in case of skill checks.
 * @param {string} [details.toolId]               The id of the tool type, in case of tool checks.
 * @param {number} [details.spellLevel]           The level of the spell, if needed.
 * @returns {boolean}                             True if the script returns true, otherwise false.
 */
function customScripts({activity, item, actor}, script, details = {}) {
  if (!script?.length) return true;
  if (game.settings.get(MODULE.ID, SETTINGS.SCRIPT)) return true;
  try {
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
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of damage types.
 * @returns {boolean}                   Whether the item's damage types overlap with the filter.
 */
function damageTypes({activity}, filter) {
  if (!filter.size) return true;
  const types = activity.damage.parts.reduce((acc, part) => acc.union(part.types), new Set());
  const {included, excluded} = _splitExlusion(filter);
  return _testInclusion(types, included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the item that made the roll was the correct feature type and feature subtype.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filter object.
 * @param {string} [filter.type]        The feature type.
 * @param {string} [filter.subtype]     The feature subtype.
 * @returns {boolean}                   Whether the feature is the correct type.
 */
function featureTypes({item}, {type, subtype}) {
  const config = CONFIG.DND5E.featureTypes;
  if (!type || !(type in config)) return true;
  if (item.type !== "feat") return false;
  if (type !== item.system.type.value) return false;

  const subtypes = config[type]?.subtypes ?? {};
  const hasSubtype = !foundry.utils.isEmpty(subtypes);
  if (!hasSubtype || !subtype) return true;

  return item.system.type.subtype === subtype;
}

/* -------------------------------------------------- */

/**
 * Find out if the health of the actor is at or above/below the threshold.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The object used for the filtering.
 * @param {number} filter.value         The hit point percentage threshold.
 * @param {number} filter.type          The type of threshold (0 for 'x or lower' and 1 for 'x and higher').
 * @returns {boolean}                   Whether the threshold is obeyed.
 */
function healthPercentages({actor}, {value, type}) {
  if (!Number.isNumeric(value) || ![0, 1].includes(type)) return true;
  if (!actor.system.attributes?.hp) return false;
  const hp = actor.system.attributes.hp.pct; // this takes tempmax into account, but not temphp.
  return ((type === 0) && (hp <= value)) || ((type === 1) && (hp >= value));
}

/* -------------------------------------------------- */

/**
 * Find out if the item being used has the right identifier.
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of identifiers.
 * @returns {boolean}                     Whether the identifier of the item is valid.
 */
function identifiers(subjects, filter) {
  return !filter.values.size || filter.values.has(subjects.item.identifier);
}

/* -------------------------------------------------- */

/**
 * Find out if the item's type is one of the valid ones in the filter.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of item type keys.
 * @returns {boolean}                   Whether the item's type was in the filter.
 */
function itemTypes({item}, filter) {
  return !filter.size || filter.has(item.type);
}

/* -------------------------------------------------- */

/**
 * Find out if the spell that is cast is one able to consume a spell slot.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of preparation modes allowed.
 * @returns {boolean}                   Whether the spell matches the preparation mode.
 */
function preparationModes({item}, filter) {
  return !filter.size || ((item.type === "spell") && filter.has(item.system.preparation.mode));
}

/* -------------------------------------------------- */

/**
 * Find out if the roll was proficient, and if at a valid level.
 * @param {SubjectConfig} subjects          Subject config.
 * @param {Set<number>} filter              The levels of valid proficiencies.
 * @param {object} details                  Additional properties for the filtering.
 * @param {string} [details.ability]        The type of saving throw.
 * @param {boolean} [details.isDeath]       Is this a death saving throw?
 * @param {string} [details.abilityId]      The type of ability check.
 * @param {string} [details.skillId]        The type of skill check.
 * @param {string} [details.toolId]         The type of tool check.
 * @returns {boolean}                       Whether the roll was one of the proficiency levels.
 */
function proficiencyLevels({activity, item, actor}, filter, details) {
  if (!filter.size) return true;

  // Case 1: Skill.
  if (details.skillId) {
    return filter.has(actor.system.skills[details.skillId]?.prof.multiplier || 0);
  }

  // Case 2: Ability Check.
  else if (details.abilityId && !details.toolId) {
    return filter.has(actor.system.abilities[details.abilityId]?.checkProf.multiplier || 0);
  }

  // Case 3: Death Saving Throw.
  else if (details.isDeath) {
    return filter.has(Number(actor.flags.dnd5e?.diamondSoul || false));
  }

  // Case 4: Saving Throw.
  else if (details.ability) {
    return filter.has(actor.system.abilities[details.ability]?.saveProf.multiplier || 0);
  }

  // Case 5: Weapon, equipment, spell, tool item.
  else if (item) {
    return filter.has(item.system.prof.multiplier);
  }

  // Case 6: Tool check without an item.
  else if (details.toolId) {
    return filter.has(actor.system.tools[details.toolId]?.prof.multiplier || 0);
  }

  // Else somehow return false.
  else return false;
}

/* -------------------------------------------------- */

/**
 * Find out if the actor has a number of spell slots remaining between the min and max.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filtering for the bonus.
 * @param {number} filter.min           The minimum value available required for the bonus to apply.
 * @param {number} filter.max           The maximum value available required for the bonus to apply.
 * @param {boolean} [filter.size]       Whether to take the size of the spell slot into account.
 * @returns {boolean}                   Whether the number of spell slots remaining falls within the bounds.
 */
function remainingSpellSlots({actor}, {min, max, size = false}) {
  if (![min, max].some(m => Number.isInteger(m))) return true;
  const spells = Object.values(actor.system.spells ?? {}).reduce((acc, val) => {
    if (!val.level || !val.value || !val.max) return acc;
    return acc + Math.clamp(val.value, 0, val.max) * (size ? val.level : 1);
  }, 0);
  return spells.between(min || 0, max || Infinity);
}

/* -------------------------------------------------- */

/**
 * Find out if the saving throw in the item is set using an ability in the filter.
 * This filter is only available for bonuses applying specifically to saving throw DCs.
 * Special consideration is made for items with save DC set using spellcasting ability.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The ability that is used to set the DC of the item's saving throw.
 * @returns {boolean}                   Whether the item's saving throw is set using an ability in the filter.
 */
function saveAbilities({activity, actor}, filter) {
  if (!filter.size) return true;
  if (activity.type !== "save") return false;
  if (!activity.save.dc.calculation) return false;

  const {included, excluded} = _splitExlusion(filter);
  let abl;
  if (activity.save.dc.calculation === "spellcasting") {
    abl = activity.spellcastingAbility;
  } else {
    abl = activity.save.dc.calculation;
  }

  return _testInclusion(new Set([abl]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Find out if the skill being rolled is one of the correct types.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The types of skill ids.
 * @param {object} details              Additional properties for the filtering.
 * @param {string} details.skillId      The id of the skill being rolled.
 * @returns {boolean}                   Whether the skill matches the filter.
 */
function skillIds(subjects, filter, {skillId}) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (!skillId) return !included.size;
  return _testInclusion(new Set([skillId]), included, excluded);
}

/* -------------------------------------------------- */

/**
 * Does this spell belong to a specific class?
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of class identifiers.
 * @returns {boolean}                     Whether the source class of the spell is valid.
 */
function sourceClasses(subjects, filter) {
  if (subjects.item.type !== "spell") return true;
  return !filter.values.size || filter.values.has(subjects.item.system.sourceClass);
}

/* -------------------------------------------------- */

/**
 * Find out if the item is a spell and has any, or all, of the required spell components.
 * The item must match either all or at least one, depending on what is set.
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filtering object.
 * @param {Set<string>} filter.types      The array of spell components in the filter.
 * @param {string} filter.match           The type of matching, either ALL or ANY.
 * @returns {boolean}                     Whether the item matched correctly with the components.
 */
function spellComponents({item}, {types, match}) {
  if (!types.size) return true;
  if (item.type !== "spell") return false;
  const comps = item.system.properties;

  /**
   * If it must match all, then `types` is a (proper) subset of the spell's components,
   * otherwise we ensure that it matches at least one component.
   */
  return ((match === "ALL") && types.isSubset(comps)) || ((match === "ANY") && types.intersects(comps));
}

/* -------------------------------------------------- */

/**
 * Find out if the item was cast at any of the required spell levels. When a spell is upcast,
 * the item here is the cloned spell only in the case of save dc bonuses, meaning we need to
 * pass on the correct spell level for attack and damage roll bonuses.
 * @param {SubjectConfig} subjects          Subject config.
 * @param {Set<number>} filter              The set of spell levels in the filter.
 * @param {object} [details]                Additional context for the filtering.
 * @param {number} [details.spellLevel]     The level at which the spell was cast.
 * @returns {boolean}                       Whether the item is at one of the appropriate levels.
 */
function spellLevels({item}, filter, {spellLevel = null} = {}) {
  // TODO: activity scaling?
  if (!filter.size) return true;
  if (item.type !== "spell") return false;
  return filter.has(spellLevel ?? item.system.level);
}

/* -------------------------------------------------- */

/**
 * Find out if the item is a spell and belongs to one of the filter's spell schools.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of spell schools.
 * @returns {boolean}                   Whether the item is a spell and is of one of these schools.
 */
function spellSchools({item}, filter) {
  return !filter.size || ((item.type === "spell") && filter.has(item.system.school));
}

/* -------------------------------------------------- */

/**
 * Find out if the actor has any of the included effects and none of the excluded effects.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of effect statuses you must have or must not have.
 * @returns {boolean}                   Whether the actor has any included effects and no excluded effects.
 */
function statusEffects({actor}, filter) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);

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
 * Find out if the actor or item has any of the valid tags.
 * @param {SubjectConfig} subjects        Subject config.
 * @param {object} filter                 The filter data.
 * @param {Set<string>} filter.values     The set of valid tags.
 * @returns {boolean}                     Whether the actor or item has any of the valid tags.
 */
function tags(subjects, filter) {
  const tags = filter.values;
  if (!tags.size) return true;

  const _hasTag = document => {
    const stored = document.getFlag("babonus", "tags") ?? [];
    return stored.some(tag => tags.has(tag));
  };

  const hasTag = document => {
    if (_hasTag(document)) return true;

    for (const effect of document.allApplicableEffects?.() ?? []) {
      if (effect.active && _hasTag(effect)) return true;
    }

    return false;
  };

  if (subjects.item && hasTag(subjects.item)) return true;
  return hasTag(subjects.actor);
}

/* -------------------------------------------------- */

/**
 * Find out if the actor is wearing one of the included armor types
 * in the filter and none of the excluded types. Note that this includes shields as well.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of base armor keys.
 * @returns {boolean}                   Whether the rolling actor is wearing appropriate armor.
 */
function targetArmors(subjects, filter) {
  const target = game.user.targets.first()?.actor;
  if (!target) return !_splitExlusion(filter).included.size;
  return baseArmors({actor: target}, filter);
}

/* -------------------------------------------------- */

/**
 * Find out if the target actor has any of the status conditions required.
 * The bonus will apply if the target actor exists and has at least one.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of effect statuses the target must have or must not have.
 * @returns {boolean}                   Whether the target actor has any of the status effects.
 */
function targetEffects(subjects, filter) {
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
 * @param {SubjectConfig} subjects                Subject config.
 * @param {Set<string>} filter                    The set of saving throw types to check for.
 * @param {object} details                        Additional context to help filter the bonus.
 * @param {string} [details.ability]              The ability used for the saving throw.
 * @param {boolean} [details.isConcentration]     Is this a concentration saving throw?
 * @param {boolean} [details.isDeath]             Is this a death saving throw?
 * @returns {boolean}                             Whether the throw type is in the filter.
 */
function throwTypes(subjects, filter, {ability, isConcentration, isDeath}) {
  if (!filter.size) return true;
  return (!!ability && filter.has(ability))
    || (filter.has("concentration") && isConcentration)
    || (filter.has("death") && isDeath);
}

/* -------------------------------------------------- */

/**
 * Find out if the targeted token is at least x-by-x or larger, or at most x-by-x or smaller,
 * while optionally also at most as big or small as the roller's token.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {object} filter               The filtering for the bonus.
 * @param {number} filter.size          The minimum/maximum size of the targeted token.
 * @param {number} filter.type          Whether it is 'at least' (0) or 'at most' (1).
 * @param {boolean} filter.self         Whether to clamp using the rolling token's size.
 */
function tokenSizes({actor}, {size, type, self}) {
  if (!(size > 0)) return true;
  const target = game.user.targets.first()?.document;
  if (!target) return false;
  const enemySize = Math.max(target.width, target.height);

  let se;
  if (self) {
    const token = actor.token ?? actor.getActiveTokens(false, true)[0];
    if (!token) return false;
    se = Math.max(token.width, token.height);
  } else {
    se = size;
  }

  // Greater than
  if (type === 0) {
    return enemySize >= Math.max(se, size);
  }

  // Less than
  if (type === 1) {
    return enemySize <= Math.min(se, size);
  }

  return false;
}

/* -------------------------------------------------- */

/**
 * Find out if the item has any of the included weapon properties and none of the excluded properties.
 * @param {SubjectConfig} subjects      Subject config.
 * @param {Set<string>} filter          The set of properties you must have one of or none of.
 * @returns {boolean}                   Whether the item has any of the included properties and none of the excluded properties.
 */
function weaponProperties({item}, filter) {
  if (!filter.size) return true;
  const {included, excluded} = _splitExlusion(filter);
  if (item.type !== "weapon") return !included.size;
  const props = item.system.properties;
  return _testInclusion(props, included, excluded);
}
