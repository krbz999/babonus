import {MODULE, SETTINGS} from "../constants.mjs";
import {BonusCollector} from "./bonus-collector.mjs";

export class FilterManager {
  /**
   * @param {Actor5e|Item5e} object     Actor or item performing the roll.
   * @param {string} type               The type of roll.
   * @param {object} [details]          Details for filtering.
   * @returns {Collection<Babonus>}     The filtered Collection.
   */
  static check(object, type, details = {}) {
    const collector = new BonusCollector({
      object: object,
      type: type
    });
    const bonuses = collector.returnBonuses();
    const filtered = this.finalFilterBonuses(type, bonuses, object, details);
    setTimeout(() => collector.destroyAuras(), 2000);
    return filtered;
  }

  /* -------------------------------------------------- */

  /**
   * Initiate the collection and filtering of bonuses applying to hit die rolls.
   * @param {Actor5e} actor             The actor performing the roll.
   * @returns {Collection<Babonus>}     The filtered Collection.
   */
  static hitDieCheck(actor) {
    return this.check(actor, "hitdie");
  }

  /* -------------------------------------------------- */

  /**
   * Initiate the collection and filtering of bonuses applying to saving throws.
   * @param {Actor5e} actor                         The actor performing the saving throw.
   * @param {object} details                        Additional context for the filtering and checks.
   * @param {string} [details.ability]              The ability used for the saving throw.
   * @param {boolean} [details.isConcentration]     Is this a concentration saving throw?
   * @param {boolean} [details.isDeath]             Is this a death saving throw?
   * @returns {Collection<Babonus>}                 The filtered Collection.
   */
  static throwCheck(actor, {ability, isConcentration, isDeath}) {
    return this.check(actor, "throw", {ability, isConcentration, isDeath});
  }

  /* -------------------------------------------------- */

  /**
   * Initiate the collection and filtering of bonuses applying to ability checks.
   * @param {Actor5e} actor                 The actor or item performing the test.
   * @param {string} abilityId              The ability used for the test.
   * @param {object} [details]              Additional context for the filtering and checks.
   * @param {string} [details.skillId]      The id of the skill, in case of skill checks.
   * @param {string} [details.toolId]       The id of the tool type, in case of tool checks.
   * @param {Item5e} [details.item]         The tool being used if rolled from an item instead.
   * @returns {Collection<Babonus>}         The filtered Collection.
   */
  static testCheck(actor, abilityId, {skillId, toolId, item} = {}) {
    return this.check(item ?? actor, "test", {abilityId, skillId, toolId});
  }

  /* -------------------------------------------------- */

  /**
   * Initiate the collection and filtering of bonuses applying to attack rolls, damage rolls, and save DCs.
   * @param {Item5e} item                     The item that is being used or is rolling.
   * @param {string} hookType                 The type of hook ('attack', 'damage', or 'save').
   * @param {object} [details]                Additional context for the filtering and checks.
   * @param {number} [details.spellLevel]     The level of the spell, if needed.
   * @returns {Collection<Babonus>}           The filtered Collection.
   */
  static itemCheck(item, hookType, {spellLevel} = {}) {
    return this.check(item, hookType, {spellLevel});
  }

  /* -------------------------------------------------- */

  /**
   * Filters the Collection of bonuses using the filters of Babonus.
   * @param {string} hookType                        The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
   * @param {Collection<Babonus>} bonuses            The babonuses to filter. **will be mutated**
   * @param {Actor5e|Item5e} object                  The actor or item used in each filter and for roll data.
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
  static finalFilterBonuses(hookType, bonuses, object, details = {}) {
    /**
     * A hook that is called before the collection of bonuses has been filtered.
     * @param {Collection<Babonus>} bonuses     The collection of bonuses, before filtering.
     * @param {Actor5e|Item5e} object           The actor or item performing the roll.
     * @param {object} [details={}]             Additional data passed along to perform the filtering.
     * @param {string} hookType                 The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
     */
    Hooks.callAll("babonus.preFilterBonuses", bonuses, object, details, hookType);

    const filter = (bab) => {
      for (const [k, v] of Object.entries(bab.filters ?? {})) {
        if (v === undefined) continue;
        if (!FilterManager[k].call(bab, object, v, details)) {
          return false;
        }
      }
      return true;
    };

    for (const [key, bab] of bonuses.entries()) {
      if (!filter(bab)) bonuses.delete(key);
    }

    this._replaceRollDataOfBonuses(bonuses, object);

    /**
     * A hook that is called after the collection of bonuses has been filtered.
     * @param {Collection<Babonus>} bonuses     The array of bonuses, after filtering.
     * @param {Actor5e|Item5e} object           The actor or item performing the roll.
     * @param {object} [details]                Additional data passed along to perform the filtering.
     * @param {string} hookType                 The type of hook being executed ('attack', 'damage',
     *                                          'save', 'throw', 'test', 'hitdie').
     */
    Hooks.callAll("babonus.filterBonuses", bonuses, object, details, hookType);

    return bonuses;
  }

  /* -------------------------------------------------- */

  /**
   * Replace roll data of bonuses that originate from foreign sources, including transferred effects.
   * @param {Collection<Babonus>} bonuses     A collection of babonuses whose bonuses to replace.
   * @param {Actor5e|Item5e} object           The actor or item performing the roll.
   */
  static _replaceRollDataOfBonuses(bonuses, object) {
    const item = (object instanceof Item) ? object : null;
    const actor = item?.actor ?? object;
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
  static _splitExlusion(filter) {
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
  static _split(str) {
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
  static _splitRaces(actor) {
    let races = new Set();

    /**
     * Find the type object on the actor to read from. We prefer the actor data,
     * since that is subject to effects and later changes, while the race item is not.
     */
    const type = actor.system.details?.type;

    if (type) {
      races = FilterManager._split(type.subtype);
      if (type.value === "custom") FilterManager._split(type.custom).forEach(k => races.add(k));
      else races.add(type.value);
    }
    return races;
  }

  /* -------------------------------------------------- */
  /*   Filtering functions                              */
  /* -------------------------------------------------- */

  /**
   * Find out if the item's type is one of the valid ones in the filter.
   * @param {Item5e} item             The item being filtered against.
   * @param {Set<string>} filter      The set of item type keys.
   * @returns {boolean}               Whether the item's type was in the filter.
   */
  static itemTypes(item, filter) {
    return !filter.size || filter.has(item.type);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item's base weapon type is one of the valid ones in the filter.
   * @param {Item5e} item             The item being filtered against.
   * @param {Set<string>} filter      The set of weapon baseItem keys.
   * @returns {boolean}               Whether the item's baseItem was in the filter.
   */
  static baseWeapons(item, filter) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (item.type !== "weapon") return !included.size;

    const types = new Set([item.system.type.value, item.system.type.baseItem]);
    if (included.size && !included.intersects(types)) return false;
    if (excluded.size && excluded.intersects(types)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the actor is wearing one of the included armor types
   * in the filter and none of the excluded types. Note that this includes shields as well.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {Set<string>} filter        The set of base armor keys.
   * @returns {boolean}                 Whether the rolling actor is wearing appropriate armor.
   */
  static baseArmors(object, filter) {
    const actor = (object instanceof Item) ? object.actor : object;
    const {included, excluded} = FilterManager._splitExlusion(filter);

    const ac = actor.system.attributes?.ac ?? {};
    const shield = ac?.equippedShield ?? null;
    const armor = ac?.equippedArmor ?? null;
    const types = new Set();
    if (shield) types.add(shield.system.type.baseItem).add(shield.system.type.value);
    if (armor) types.add(armor.system.type.baseItem).add(armor.system.type.value);
    if (ac.calc === "natural") types.add("natural");

    // If no armor worn.
    if (!types.size) return !(included.size > 0);

    if (included.size && !included.intersects(types)) return false;
    if (excluded.size && excluded.intersects(types)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the actor is wearing one of the included armor types
   * in the filter and none of the excluded types. Note that this includes shields as well.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {Set<string>} filter        The set of base armor keys.
   * @returns {boolean}                 Whether the rolling actor is wearing appropriate armor.
   */
  static targetArmors(object, filter) {
    const target = game.user.targets.first()?.actor;
    if (!target) return !FilterManager._splitExlusion(filter).included.size;
    return FilterManager.baseArmors(target, filter);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item has any of the included damage types in its damage parts and none of the excluded types.
   * @param {Item5e} item             The item being filtered against.
   * @param {Set<string>} filter      The set of damage types.
   * @returns {boolean}               Whether the item's damage types overlap with the filter.
   */
  static damageTypes(item, filter) {
    if (!filter.size) return true;
    const types = new Set(item.system.damage.parts.map(p => p[1]));
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (included.size && !types.intersects(included)) return false;
    if (excluded.size && types.intersects(excluded)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item is a spell and belongs to one of the filter's spell schools.
   * @param {Item5e} item             The item being filtered against.
   * @param {Set<string>} filter      The set of spell schools.
   * @returns {boolean}               Whether the item is a spell and is of one of these schools.
   */
  static spellSchools(item, filter) {
    return !filter.size || ((item.type === "spell") && filter.has(item.system.school));
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item is using one of the abilities in the filter. Consideration is made
   * by the system itself for items set to 'Default' to look for finesse weapons and spellcasting
   * abilities. Note that this is the ability set at the top level of the item's action, and
   * is NOT the ability used to determine the dc of the saving throw.
   * @param {Actor5e|Item5e} object           The actor or item performing the roll.
   * @param {Set<string>} filter              The set of abilities.
   * @param {object} [details]                Additional context for the roll being performed.
   * @param {string} [details.abilityId]      The three-letter key of the ability used in the roll (checks only).
   * @param {string} [details.toolId]         The key for a tool type (tool checks only).
   * @returns {boolean}                       Whether the actor or item is using one of the abilities.
   */
  static abilities(object, filter, {abilityId, toolId} = {}) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    let abi;

    // Case 1: Tool Checks.
    if (toolId) abi = abilityId;

    // Case 2: Attack/Damage rolls.
    if (object instanceof Item) {
      // if the item has no actionType, it has no ability.
      if (!object.system.actionType) return false;
      abi = object.abilityMod;
    }

    // Case 3: AbilityTest or Skill.
    if (object instanceof Actor) abi = abilityId;

    // Test the filters.
    if (included.size && !included.has(abi)) return false;
    if (excluded.size && excluded.has(abi)) return false;
    return !!abi;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item is a spell and has any, or all, of the required spell components.
   * The item must match either all or at least one, depending on what is set.
   * @param {Item5e} item                   The item being filtered against.
   * @param {object} filter                 The filtering object.
   * @param {Set<string>} filter.types      The array of spell components in the filter.
   * @param {string} filter.match           The type of matching, either ALL or ANY.
   * @returns {boolean}                     Whether the item matched correctly with the components.
   */
  static spellComponents(item, {types, match}) {
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
   * @param {Item5e} item                     The item being filtered against.
   * @param {Set<number>} filter              The set of spell levels in the filter.
   * @param {object} [details]                Additional context for the filtering.
   * @param {number} [details.spellLevel]     The level at which the spell was cast.
   * @returns {boolean}                       Whether the item is at one of the appropriate levels.
   */
  static spellLevels(item, filter, {spellLevel = null} = {}) {
    if (!filter.size) return true;
    if (item.type !== "spell") return false;
    return filter.has(spellLevel ?? item.system.level);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item's action type is set to any of the required attack types.
   * @param {Item5e} item            The item being filtered against.
   * @param {Set<string>} filter     The array of attack types.
   * @returns {boolean}              Whether the item has any of the required attack types.
   */
  static attackTypes(item, filter) {
    return !filter.size || filter.has(item.system.actionType);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the item has any of the included weapon properties and none of the excluded properties.
   * @param {Item5e} item            The item being filtered against.
   * @param {Set<string>} filter     The set of properties you must have one of or none of.
   * @returns {boolean}              Whether the item has any of the included properties and none of the excluded properties.
   */
  static weaponProperties(item, filter) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (item.type !== "weapon") return !included.size;
    const props = item.system.properties;
    if (included.size && !included.intersects(props)) return false;
    if (excluded.size && excluded.intersects(props)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the saving throw in the item is set using an ability in the filter.
   * This filter is only available for bonuses applying specifically to saving throw DCs.
   * Special consideration is made for items with save DC set using spellcasting ability.
   * @param {Item5e} item             The item being filtered against.
   * @param {Set<string>} filter      The ability that is used to set the DC of the item's saving throw.
   * @returns {boolean}               Whether the item's saving throw is set using an ability in the filter.
   */
  static saveAbilities(item, filter) {
    if (!filter.size) return true;
    if (!item.hasSave) return false;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    let abl;
    if (item.system.save.scaling === "spell") {
      abl = item.actor.system.attributes.spellcasting;
    } else abl = item.system.save.scaling;
    if (included.size && !included.has(abl)) return false;
    if (excluded.size && excluded.has(abl)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if 'one' and 'other have the correct relationship for each of the comparisons.
   * If 'one' and 'other' do not both evaluate to numbers, string comparison is instead used.
   * For string comparison, inequality operators are taken to mean substrings. The comparisons
   * are done after replacing any roll data.
   * @param {Actor5e|Item5e} object         The item or actor being filtered against.
   * @param {object[]} filter               An array of objects with 'one', 'other', and 'operator'.
   * @param {string} filter[].one           One value to compare against another.
   * @param {string} filter[].other         One value to compare against another.
   * @param {string} filter[].operator      The kind of comparison to make between the two values.
   * @returns {boolean}                     Whether every comparison were in the correct relationship.
   */
  static arbitraryComparisons(object, filter) {
    if (!filter.length) return true;

    const rollData = object.getRollData();
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
   * Find out if the actor has any of the included effects and none of the excluded effects.
   * @param {Actor5e|Item5e} object     The item or actor being filtered against.
   * @param {Set<string>} filter        The set of effect statuses you must have or must not have.
   * @returns {boolean}                 Whether the actor has any included effects and no excluded effects.
   */
  static statusEffects(object, filter) {
    if (!filter.size) return true;
    const actor = object.actor ?? object;
    const {included, excluded} = FilterManager._splitExlusion(filter);

    // Discard any conditions the actor is immune to.
    const ci = actor.system.traits?.ci?.value ?? new Set();
    for (const k of ci) {included.delete(k); excluded.delete(k);}

    if (included.size && !included.intersects(actor.statuses)) return false;
    if (excluded.size && excluded.intersects(actor.statuses)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the target actor has any of the status conditions required.
   * The bonus will apply if the target actor exists and has at least one.
   * @param {Actor5e|Item5e} object     The item or actor. Not relevant in this case.
   * @param {Set<string>} filter        The set of effect statuses the target must have or must not have.
   * @returns {boolean}                 Whether the target actor has any of the status effects.
   */
  static targetEffects(object, filter) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const actor = game.user.targets.first()?.actor;
    if (!actor) return !included.size;

    // Discard any conditions the actor is immune to.
    const ci = actor.system.traits?.ci?.value ?? new Set();
    for (const k of ci) {included.delete(k); excluded.delete(k);}

    if (included.size && !included.intersects(actor.statuses)) return false;
    if (excluded.size && excluded.intersects(actor.statuses)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the bonus should apply to this type of saving throw.
   * @param {Actor5e} actor                         The actor making the saving throw.
   * @param {Set<string>} filter                    The set of saving throw types to check for.
   * @param {object} details                        Additional context to help filter the bonus.
   * @param {string} [details.ability]              The ability used for the saving throw.
   * @param {boolean} [details.isConcentration]     Is this a concentration saving throw?
   * @param {boolean} [details.isDeath]             Is this a death saving throw?
   * @returns {boolean}                             Whether the throw type is in the filter.
   */
  static throwTypes(actor, filter, {ability, isConcentration, isDeath}) {
    if (!filter.size) return true;
    return (!!ability && filter.has(ability))
      || (filter.has("concentration") && isConcentration)
      || (filter.has("death") && isDeath);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the target is one of the included creature types and none of the excluded types.
   * In the case of no targets, refer to whether any specific creature type was included.
   * @param {Actor5e|Item5e} object     The item or actor. Not relevant in this case.
   * @param {Set<string>} filter        The set of creature types the target must or must not be.
   * @returns {boolean}                 Whether the target is of a valid creature type.
   */
  static creatureTypes(object, filter) {
    if (!filter.size) return true;
    const target = game.user.targets.first();
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const details = target?.actor?.system.details;
    if (!details) return !included.size;

    // All the races the target is a member of.
    const races = FilterManager._splitRaces(target.actor);

    if (included.size && !included.intersects(races)) return false;
    if (excluded.size && excluded.intersects(races)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the rolling actor is one of the included creature etypes and none of the excluded types.
   * In the case of no values, refer to whether any specific creature type was included.
   * @param {Actor5e|Item5e} object     The rolling actor or item.
   * @param {Set<string>} filter        The set of creature types the rolling actor must or must not be.
   * @returns {boolean}                 Whether the rolling actor is of a valid creature type.
   */
  static actorCreatureTypes(object, filter) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const actor = object.actor ?? object;
    const details = actor.system.details;
    if (!details) return !included.size;

    // All the races the rolling actor is a member of.
    const races = FilterManager._splitRaces(actor);

    if (included.length && !included.intersects(races)) return false;
    if (excluded.length && excluded.intersects(races)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the actor has a number of spell slots remaining between the min and max.
   * @param {Actor5e|Item5e} object     The item or actor.
   * @param {object} filter             The filtering for the bonus.
   * @param {number} filter.min         The minimum value available required for the bonus to apply.
   * @param {number} filter.max         The maximum value available required for the bonus to apply.
   * @param {boolean} [filter.size]     Whether to take the size of the spell slot into account.
   * @returns {boolean}                 Whether the number of spell slots remaining falls within the bounds.
   */
  static remainingSpellSlots(object, {min, max, size = false}) {
    if (![min, max].some(m => Number.isInteger(m))) return true;
    const caster = object.actor ?? object;
    const spells = Object.values(caster.system.spells ?? {}).reduce((acc, val) => {
      if (!val.level) return acc;
      return acc + Math.clamp(val.value, 0, val.max) * (size ? val.level : 1);
    }, 0);
    return spells.between(min || 0, max || Infinity);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the embedded script returns true.
   * @param {Actor5e|Item5e} object                 The item or actor.
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
  static customScripts(object, script, details = {}) {
    if (!script?.length) return true;
    if (game.settings.get(MODULE.ID, SETTINGS.SCRIPT)) return true;
    try {
      const func = Function("actor", "item", "token", "bonus", "details", script);
      const actor = (object.parent instanceof Actor) ? object.parent : (object instanceof Actor) ? object : null;
      const token = actor?.token?.object ?? actor?.getActiveTokens()[0] ?? null;
      const item = (object instanceof Item) ? object : null;
      const valid = func.call(object, actor, item, token, this, details) === true;
      return valid;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the spell that is cast is one able to consume a spell slot.
   * @param {Item5e} item             The spell being cast, or making an attack or damage roll.
   * @param {Set<string>} filter      The types of preparation modes allowed.
   * @returns {boolean}               Whether the spell matches the preparation mode.
   */
  static preparationModes(item, filter) {
    return !filter.size || ((item.type === "spell") && filter.has(item.system.preparation.mode));
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the targeted token is at least x-by-x or larger, or at most x-by-x or smaller,
   * while optionally also at most as big or small as the roller's token.
   * @param {Actor5e|Item5e} object     The roller from which to get their token.
   * @param {object} filter             The filtering for the bonus.
   * @param {number} filter.size        The minimum/maximum size of the targeted token.
   * @param {number} filter.type        Whether it is 'at least' (0) or 'at most' (1).
   * @param {boolean} filter.self       Whether to clamp using the rolling token's size.
   */
  static tokenSizes(object, {size, type, self}) {
    if (!(size > 0)) return true;
    const target = game.user.targets.first()?.document;
    if (!target) return false;
    const enemySize = Math.max(target.width, target.height);

    let se;
    if (self) {
      const actor = object.actor ?? object;
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
   * Find out if the tool being rolled for a check is one of the correct types.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {Set<string>} filter        The types of tool types.
   * @param {string} toolId             The type of tool being rolled.
   * @returns {boolean}                 Whether the tool type matches the filter.
   */
  static baseTools(object, filter, {toolId}) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (!toolId) return !included.size;

    const types = new Set(babonus.proficiencyTree(toolId, "tool"));
    if (included.size && !included.intersects(types)) return false;
    if (excluded.size && excluded.intersects(types)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the skill being rolled is one of the correct types.
   * @param {Actor5e} actor               The actor performing the roll.
   * @param {Set<string>} filter          The types of skill ids.
   * @param {object} details              Additional properties for the filtering.
   * @param {string} details.skillId      The id of the skill being rolled.
   * @returns {boolean}                   Whether the skill matches the filter.
   */
  static skillIds(actor, filter, {skillId}) {
    if (!filter.size) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (!skillId) return !included.size;
    if (included.size && !included.has(skillId)) return false;
    if (excluded.size && excluded.has(skillId)) return false;
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the health of the actor is at or above/below the threshold.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {object} filter             The object used for the filtering.
   * @param {number} filter.value       The hit point percentage threshold.
   * @param {number} filter.type        The type of threshold (0 for 'x or lower' and 1 for 'x and higher').
   * @returns {boolean}                 Whether the threshold is obeyed.
   */
  static healthPercentages(object, {value, type}) {
    if (!Number.isNumeric(value) || ![0, 1].includes(type)) return true;
    const actor = object.actor ?? object;
    const hp = actor.system.attributes.hp.pct; // this takes tempmax into account, but not temphp.
    return ((type === 0) && (hp <= value)) || ((type === 1) && (hp >= value));
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the roll was proficient, and if at a valid level.
   * @param {Actor5e|Item5e} object           The actor or item performing the roll.
   * @param {Set<number>} filter              The levels of valid proficiencies.
   * @param {object} details                  Additional properties for the filtering.
   * @param {string} [details.ability]        The type of saving throw.
   * @param {boolean} [details.isDeath]       Is this a death saving throw?
   * @param {string} [details.abilityId]      The type of ability check.
   * @param {string} [details.skillId]        The type of skill check.
   * @param {string} [details.toolId]         The type of tool check.
   * @returns {boolean}                       Whether the roll was one of the proficiency levels.
   */
  static proficiencyLevels(object, filter, details) {
    if (!filter.size) return true;
    const item = object instanceof Item ? object : null;
    const actor = object instanceof Item ? object.actor : object;

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
   * Find out if the item that made the roll was the correct feature type and feature subtype.
   * @param {Item5e} item                 The item performing the roll.
   * @param {object} filter               The filter object.
   * @param {string} [filter.type]        The feature type.
   * @param {string} [filter.subtype]     The feature subtype.
   * @returns {boolean}                   Whether the feature is the correct type.
   */
  static featureTypes(item, {type, subtype}) {
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
   * Find out if the actor is one of the correct creature sizes.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {Set<string>} filter        The set of valid creature sizes.
   * @returns {boolean}                 Whether the actor is a correct creature size.
   */
  static actorCreatureSizes(object, filter) {
    if (!filter.size) return true;
    const actor = (object instanceof Item) ? object.actor : object;
    const size = actor.system.traits?.size;
    return !!size && filter.has(size);
  }

  /* -------------------------------------------------- */

  /**
   * Find out if the actor speaks one of the included languages while not any of the excluded languages.
   * @param {Actor5e|Item5e} object     The actor or item performing the roll.
   * @param {Set<string>} filter        The set of languages the actor must speak or not speak.
   * @returns {boolean}
   */
  static actorLanguages(object, filter) {
    if (!filter.size) return true;
    const actor = (object instanceof Item) ? object.actor : object;
    const {included, excluded} = FilterManager._splitExlusion(filter);

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
}
