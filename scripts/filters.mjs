import {MODULE, SETTINGS} from "./constants.mjs";
import {BonusCollector} from "./applications/bonusCollector.mjs";

/**
 * An example bonus, as it would be stored on an actor, effect, item, or template.
 * Includes all fields.
 *
  flags.babonus.bonuses: {
    <id>: {
      enabled: true,                                        // Whether this bonus is turned on.
      name: "Special Fire Spell Bonus",                     // The name of the bonus.
      id: "hgienfid783h",                                   // Regular 16 character id.
      description: "This is...",                            // Description of the bonus.
      type: "attack",                                       // Or "damage", "save", "throw", "hitdie".
      exclusive: false,                                     // whether this bonus only applies to the item on which it is created (attack/damage/save only).
      optional: false,                                      // whether this bonus is toggleable in the roll config.
      consume: {
        enabled: true,                                      // Whether the bonus consumes uses/quantity off its item or slots off its actor.
        scales: true,                                       // Whether the consumption scales between the min and max values given.
        type: "uses",                                       // Whether the consumption is limited "uses", "quantity", "slots", "health", or "effect".
        value: {min: 5, max: 15, step: 5},                  // The minimum and maximum number consumed when applying the bonus.
        formula: "1d8"                                      // A formula with which the bonus scales, default being the bonus formula itself.
      },
      aura: {
        enabled: true,                                      // Whether this should be an aura.
        template: true,                                     // Whether this should be a template aura, not a regular aura.
        range: "60",                                        // The range of the aura (in ft), not relevant if template. Use -1 for infinite.
        self: false,                                        // Whether the aura affects the owner, too.
        disposition: 1                                      // What token actors within range to affect.
        blockers: ["dead", "unconscious"]                   // Array of statuses that stop auras from being transferred.
        require: {                                          // Obstructions that might block an aura.
          sight: true,                                      // Whether the aura requires that the receiver can see the source.
          move: true                                        // Whether the aura requires an unobstructed path from the source to the receiver.
        }
      },
      bonuses: {
        bonus: "1d4 + @abilities.int.mod",                  // All types, but 'save' only takes numbers, not dice.
        criticalBonusDice: "5",                             // A value (can be roll data) that adds more dice on a crit, 'damage' only.
        criticalBonusDamage: "4d6 + 2"                      // Any die roll, 'damage' only.
        deathSaveTargetValue: "12",                         // A value (can be roll data) that lowers the target value of death saves, 'throw' only.
        deathSaveCritical: "5",                             // A value (can be roll data) that lowers the crit range of death saves, 'throw' only.
        criticalRange: "1",                                 // A value (can be roll data) that lowers the crit range, 'attack' only.
        fumbleRange: "3"                                    // A value (can be roll data) that raises the fumble range, 'attack' only.
      },
      filters: {
        // UNIVERSAL:
        arbitraryComparison: [{                             // An array of objects comparing two values.
          one: "@item.uses.value",                          // The left-side value.
          other: "@abilities.int.mod",                      // The right-side value.
          operator: "EQ"                                    // The method of comparison.
        }],
        healthPercentages: {value: 50, type: 0},            // A percentage value and whether it must be 'and lower' or 'and higher'.
        statusEffects: ["blind", "dead", "!prone"],         // Array of statuses to match effects against.
        targetEffects: ["blind", "dead", "!prone"],         // Array of statuses to match effects on the target against.
        creatureTypes: ["undead", "!humanoid"],             // Array of CONFIG.DND5E.creatureTypes. This is not strict, to allow for subtype/custom.
        actorCreatureTypes: ["undead", "!humanoid"],        // Array of CONFIG.DND5E.creatureTypes. This is not strict, to allow for subtype/custom.
        customScripts: "return true;",                      // A custom script that returns true or false.
        remainingSpellSlots: {min: 3, max: null},           // A min and max number of spell slots remaining the actor must have.
        preparationModes: ["pact", "always"],               // The type of preparation mode the spell must be one of.
        tokenSizes: {size: 2, type: 0, self: true},         // The size of the targeted token, whether it must be smaller than/greater than, and whether to clamp with self.

        // ATTACK, DAMAGE:
        attackTypes: ["mwak", "rwak", "msak", "rsak"],      // The type of attack.

        // ATTACK, DAMAGE, SAVE:
        damageTypes: ["fire", "cold", "!bludgeoning"],      // The type of damage or healing the item must have.
        itemTypes: ["spell", "weapon"],                     // The item types to which it applies; also "feat", "equipment", "consumable".

        // ATTACK, DAMAGE, THROW, TEST:
        abilities: ["int"],                                 // The ability the actor/item must be using.

        // ATTACK, TEST, THROW:
        proficiencyLevels: [0, 1, 2, 0.5],                  // The valid proficiency levels.

        // SAVE:
        saveAbilities: ["int", "cha", "con"],               // The ability that sets the save DC.

        // THROW:
        throwTypes: ["con", "death", "concentration"],      // The type of saving throw to which it applies.

        // TEST:
        baseTools: ["herb", "alchemist"],                   // The type of tool being used for the tool check.
        skillIds: ["ath", "acr"],                           // The type of skill being rolled.

        // SPELL:
        spellComponents: {types: ["vocal"], match: "ALL"},  // Spell components it must have; at least one, or match "ANY".
        spellLevels: [0, 1, 2, 3],                          // The level the spell must be.
        spellSchools: ["evo", "con"],                       // The school the spell must be.

        // WEAPON
        baseWeapons: ["dagger", "lance", "shortsword"],     // The weapon the item must be.
        weaponProperties: ["fin", "!two"],                  // The weapon properties the item must have one of, and have none of.
      }
    }
  }
 */

export class FilterManager {

  /**
   **********************************************************
   *
   *
   *                  CHECKING FUNCTIONS
   *
   *
   **********************************************************
   */

  //#region

  /**
   * Initiate the collection and filtering of bonuses applying to hit die rolls.
   * @param {Actor} actor     The actor performing the roll.
   * @returns {Babonus[]}     A filtered array of babonuses to apply.
   */
  static hitDieCheck(actor) {
    const bonuses = new BonusCollector({object: actor, type: "hitdie"}).returnBonuses();
    if (!bonuses.size) return [];
    return this.finalFilterBonuses("hitdie", bonuses, actor);
  }

  /**
   * Initiate the collection and filtering of bonuses applying to saving throws.
   * @param {Actor} actor                     The actor performing the saving throw.
   * @param {string} throwType                The type of saving throw being made (possibly 'death').
   * @param {object} details                  Additional context for the filtering and checks.
   * @param {boolean} details.isConcSave      Whether this saving throw is made to maintain concentration.
   * @returns {Babonus[]}                     A filtered array of babonuses to apply.
   */
  static throwCheck(actor, throwType, {isConcSave}) {
    const bonuses = new BonusCollector({object: actor, type: "throw"}).returnBonuses();
    if (!bonuses.size) return [];
    return this.finalFilterBonuses("throw", bonuses, actor, {throwType, isConcSave});
  }

  /**
   * Initiate the collection and filtering of bonuses applying to ability checks.
   * @param {Actor} actor                   The actor performing the test.
   * @param {string} abilityId              The ability used for the test.
   * @param {object} [details={}]           Additional context for the filtering and checks.
   * @param {string} [details.skillId]      The id of the skill, in case of skill checks.
   * @param {string} [details.toolId]       The id of the tool type, in case of tool checks.
   * @returns {Babonus[]}                   A filtered array of babonuses to apply.
   */
  static testCheck(actor, abilityId, {skillId, toolId} = {}) {
    const bonuses = new BonusCollector({object: actor, type: "test"}).returnBonuses();
    if (!bonuses.size) return [];
    return this.finalFilterBonuses("test", bonuses, actor, {abilityId, skillId, toolId});
  }

  /**
   * Initiate the collection and filtering of bonuses applying to attack rolls, damage rolls, and save DCs.
   * @param {Item} item                       The item that is being used or is rolling.
   * @param {string} hookType                 The type of hook ('attack', 'damage', or 'save').
   * @param {object} [details={}]             Additional context for the filtering and checks.
   * @param {number} [details.spellLevel]     The level of the spell, if needed.
   * @returns {Babonus[]}                     A filtered array of babonuses to apply.
   */
  static itemCheck(item, hookType, {spellLevel} = {}) {
    const bonuses = new BonusCollector({object: item, type: hookType}).returnBonuses();
    if (!bonuses.size) return [];
    return this.finalFilterBonuses(hookType, bonuses, item, {spellLevel});
  }

  /**
   * Filters the Collection of bonuses using the filters of Babonus.
   * @param {string} hookType                   The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
   * @param {Collection<Babonus>} bonuses       The babonuses to filter.
   * @param {Actor|Item} object                 The actor or item used in each filter and for roll data.
   * @param {object} [details={}]               Additional data necessary to pass along.
   * @param {string} [details.throwType]        The type of saving thwo being made (possibly 'death').
   * @param {boolean} [details.isConcSave]      Whether a saving throw is made to maintain concentration.
   * @param {string} [details.abilityId]        The ability used for an ability check.
   * @param {string} [details.skillId]          The id of the skill, in case of skill checks.
   * @param {number} [details.spellLevel]       The level of the spell, if needed.
   * @param {string} [details.toolId]           The id of the tool type, in case of tool checks.
   * @returns {Babonus[]}                       The filtered Collection.
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

    bonuses = bonuses.reduce((acc, bab) => {
      const filters = Object.entries(bab.filters ?? {});
      for (const [key, val] of filters) {
        if (val === undefined) continue;
        const valid = this[key].call(bab, object, val, details);
        if (!valid) return acc;
      }
      acc.push(bab);
      return acc;
    }, []);
    this._replaceRollDataOfBonuses(bonuses, object);

    /**
     * A hook that is called after the collection of bonuses has been filtered.
     * @param {Babonus[]} bonuses         The array of bonuses, after filtering.
     * @param {Actor5e|Item5e} object     The actor or item performing the roll.
     * @param {object} [details={}]       Additional data passed along to perform the filtering.
     * @param {string} hookType           The type of hook being executed ('attack', 'damage', 'save', 'throw', 'test', 'hitdie').
     */
    Hooks.callAll("babonus.filterBonuses", bonuses, object, details, hookType);

    return bonuses;
  }

  /**
   * Replace roll data of bonuses that originate from foreign sources, including transferred effects.
   * @param {Babonus[]} bonuses     An array of babonuses whose bonuses to replace.
   * @param {Actor|Item} object     An actor or item used to get the correct roll data.
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
      if (src.id === item?.id) continue;

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
      try {bonus.updateSource({bonuses: update})} catch (err) {}
    }
  }

  /**
   * Split an array into 'included' and 'exluded'.
   * @param {string[]} filter     The array of strings, some with '!' prefixed.
   * @returns {object}            An object with two arrays of strings.
   */
  static _splitExlusion(filter) {
    const data = filter.reduce((acc, str) => {
      if (!str.startsWith("!")) acc.included.push(str);
      else if (str.startsWith("!")) acc.excluded.push(str.slice(1));
      return acc;
    }, {included: [], excluded: []});
    return data;
  }

  /**
   * Utility function to split a string by '/'.
   * @param {string} str      The string to split.
   * @returns {string[]}      The array of strings.
   */
  static _split(str) {
    return str?.split("/").reduce((acc, e) => {
      const trim = e.trim().toLowerCase();
      if (trim.length) acc.push(trim);
      return acc;
    }, []) ?? [];
  }

  /**
   * Utility function to split racial values.
   * @param {Actor5e} actor     The actor.
   * @returns {string[]}        The different 'races' to compare against.
   */
  static _splitRaces(actor) {
    let races = [];
    let type;

    // Find the value/subtype/custom object to read from.
    if (actor.type === "npc") type = actor.system.details.type;
    else if (actor.type === "character") type = actor.system.details.race?.system?.type;

    if (type) {
      races = FilterManager._split(type.subtype);
      if (type.value === "custom") races.push(...FilterManager._split(type.custom));
      else races.push(type.value);
    } else if (actor.type === "character") {
      races = FilterManager._split(actor.system.details.race);
    }
    return races;
  }

  //#endregion

  /**
   **********************************************************
   *
   *
   *                   FILTERS FUNCTIONS
   *
   *
   **********************************************************
   */

  //#region

  /**
   * Find out if the item's type is one of the valid ones in the filter.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of item type keys.
   * @returns {boolean}           Whether the item's type was in the filter.
   */
  static itemTypes(item, filter) {
    if (!filter?.length) return true;
    return filter.includes(item.type);
  }

  /**
   * Find out if the item's base weapon type is one of the valid ones in the filter.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of weapon baseItem keys.
   * @returns {boolean}           Whether the item's baseItem was in the filter.
   */
  static baseWeapons(item, filter) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (item.type !== "weapon") return included.length === 0;
    const type = item.system.baseItem;
    if (included.length && !included.includes(type)) return false;
    if (excluded.length && excluded.includes(type)) return false;
    return true;
  }

  /**
   * Find out if the actor is wearing one of the included armor types in the filter and none of the excluded types.
   * Note that this includes shields as well.
   * @param {Actor|Item} object     The actor or item performing the roll.
   * @param {string[]} filter       The array of base armor keys.
   * @returns {boolean}             Whether the rolling actor is wearing appropriate armor.
   */
  static baseArmors(object, filter) {
    const actor = (object instanceof Item) ? object.actor : object;
    const {included, excluded} = FilterManager._splitExlusion(filter);

    // Vehicles cannot wear base armor.
    if (actor.type === "vehicle") return !(included.length > 0);

    // Check for shield(s) first.
    const hasShield = !!actor.system.attributes.ac.equippedShield;
    if (!hasShield && included.includes("shield")) return false;
    if (hasShield && excluded.includes("shield")) return false;

    const armor = actor.system.attributes.ac.equippedArmor ?? null;

    // If no armor worn.
    if (!armor) return !(included.length > 0);

    const type = armor.system.baseItem;
    if (included.filter(i => i !== "shield").length && !included.includes(type)) return false;
    if (excluded.length && excluded.includes(type)) return false;
    return true;
  }

  /**
   * Find out if the item has any of the included damage types in its damage parts and none of the excluded types.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of damage types.
   * @returns {boolean}           Whether the item's damage types overlap with the filter.
   */
  static damageTypes(item, filter) {
    if (!filter?.length) return true;
    const types = item.getDerivedDamageLabel().map(i => i.damageType);
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (included.length && !types.some(t => included.includes(t))) return false;
    if (excluded.length && types.some(t => excluded.includes(t))) return false;
    return true;
  }

  /**
   * Find out if the item is a spell and belongs to one of the filter's spell schools.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of spell schools.
   * @returns {boolean}           Whether the item is a spell and is of one of these schools.
   */
  static spellSchools(item, filter) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    return filter.includes(item.system.school);
  }

  /**
   * Find out if the item is using one of the abilities in the filter. Consideration is made
   * by the system itself for items set to 'Default' to look for finesse weapons and spellcasting
   * abilities. Note that this is the ability set at the top level of the item's action, and
   * is NOT the ability used to determine the dc of the saving throw.
   * @param {Actor|Item} object               The actor or item performing the roll.
   * @param {string[]} filter                 The array of abilities.
   * @param {object} [details={}]             Additional context for the roll being performed.
   * @param {string} [details.abilityId]      The three-letter key of the ability used in the roll (checks only).
   * @param {string} [details.toolId]         The key for a tool type (tool checks only).
   * @returns {boolean}                       Whether the actor or item is using one of the abilities.
   */
  static abilities(object, filter, {abilityId, toolId} = {}) {
    if (!filter?.length) return true;
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
    if (included.length && !included.includes(abi)) return false;
    if (excluded.length && excluded.includes(abi)) return false;
    return !!abi;
  }

  /**
   * Find out if the item is a spell and has any, or all, of the required spell components.
   * The item must match either all or at least one, depending on what is set.
   * @param {Item} item                 The item being filtered against.
   * @param {object} filter             The filtering object.
   * @param {string[]} filter.types     The array of spell components in the filter.
   * @param {string} filter.match       The type of matching, either ALL or ANY.
   * @returns {boolean}                 Whether the item matched correctly with the components.
   */
  static spellComponents(item, {types, match}) {
    if (!types?.length) return true;
    if (item.type !== "spell") return false;

    const comps = item.system.components;
    // If it must match all, then filter is a (proper) subset of the spell's comps.
    if (match === "ALL") return types.every(type => comps[type]);
    // Else ensure it matches at least one comp.
    else if (match === "ANY") return types.some(type => comps[type]);
    return false;
  }

  /**
   * Find out if the item was cast at any of the required spell levels. When a spell is upcast,
   * the item here is the cloned spell only in the case of save dc bonuses, meaning we need to
   * pass on the correct spell level for attack and damage roll bonuses.
   * TODO: the upcast level cannot be retrieved from template auras.
   * @param {Item} item                             The item being filtered against.
   * @param {string[]} filter                       The array of spell levels in the filter.
   * @param {object} [details={}]                   Additional context for the filtering.
   * @param {number} [details.spellLevel=null]      The level at which the spell was cast.
   * @returns {boolean}                             Whether the item is at one of the appropriate levels.
   */
  static spellLevels(item, filter, {spellLevel = null} = {}) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    return filter.includes(spellLevel ?? item.system.level);
  }

  /**
   * Find out if the item's action type is set to any of the required attack types.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of attack types.
   * @returns {boolean}           Whether the item has any of the required attack types.
   */
  static attackTypes(item, filter) {
    if (!filter?.length) return true;
    const actionType = item.system.actionType;
    if (!actionType) return false;
    return filter.includes(actionType);
  }

  /**
   * Find out if the item has any of the included weapon properties and none of the excluded properties.
   * @param {Item} item           The item being filtered against.
   * @param {string[]} filter     The array of properties you must have one of or none of.
   * @returns {boolean}           Whether the item has any of the included properties and none of the excluded properties.
   */
  static weaponProperties(item, filter) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (item.type !== "weapon") return included.length === 0;
    const props = item.system.properties;
    if (included.length && !included.some(p => props[p])) return false;
    if (excluded.length && excluded.some(p => props[p])) return false;
    return true;
  }

  /**
   * Find out if the saving throw in the item is set using an ability in the filter.
   * This filter is only available for bonuses applying specifically to saving throw DCs.
   * Special consideration is made for items with save DC set using spellcasting ability.
   * @param {Item} item            The item being filtered against.
   * @param {string[]} filter      The ability that is used to set the DC of the item's saving throw.
   * @returns {boolean}            Whether the item's saving throw is set using an ability in the filter.
   */
  static saveAbilities(item, filter) {
    if (!filter?.length) return true;
    if (!item.hasSave) return false;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    let abl;
    if (item.system.save.scaling === "spell") {
      abl = item.actor.system.attributes.spellcasting;
    } else abl = item.system.save.scaling;
    if (included.length && !included.includes(abl)) return false;
    if (excluded.length && excluded.includes(abl)) return false;
    return true;
  }

  /**
   * Find out if 'one' and 'other have the correct relationship for each of the comparisons.
   * If 'one' and 'other' do not both evaluate to numbers, string comparison is instead used.
   * For string comparison, inequality operators are taken to mean substrings. The comparisons
   * are done after replacing any roll data.
   * @param {Item|Actor} object             The item or actor being filtered against.
   * @param {object[]} filter               An array of objects with 'one', 'other', and 'operator'.
   * @param {string} filter[].one           One value to compare against another.
   * @param {string} filter[].other         One value to compare against another.
   * @param {string} filter[].operator      The kind of comparison to make between the two values.
   * @returns {boolean}                     Whether every comparison were in the correct relationship.
   */
  static arbitraryComparison(object, filter) {
    if (!filter?.length) return true;

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
        const nLeft = Roll.safeEval(left);
        const nRight = Roll.safeEval(right);
        if (operator === "EQ" && !(nLeft === nRight)) return false;
        else if (operator === "LT" && !(nLeft < nRight)) return false;
        else if (operator === "GT" && !(nLeft > nRight)) return false;
        else if (operator === "LE" && !(nLeft <= nRight)) return false;
        else if (operator === "GE" && !(nLeft >= nRight)) return false;
      } catch {
        // try comparing strings.
        if (operator === "EQ" && !(left == right)) return false;
        else if (["LT", "LE"].includes(operator) && !(right.includes(left))) return false;
        else if (["GT", "GE"].includes(operator) && !(left.includes(right))) return false;
      }
    }
    return true;
  }

  /**
   * Find out if the actor has any of the included effects and none of the excluded effects.
   * @param {Item|Actor} object     The item or actor being filtered against.
   * @param {string[]} filter       The array of effect statuses you must have or must not have.
   * @returns {boolean}             Whether the actor has any included effects and no excluded effects.
   */
  static statusEffects(object, filter) {
    if (!filter?.length) return true;
    const actor = object.actor ?? object;
    const {included, excluded} = FilterManager._splitExlusion(filter);

    const hasIncluded = included.some(id => actor.statuses.has(id));
    if (included.length && !hasIncluded) return false;

    const hasExcluded = excluded.some(id => actor.statuses.has(id));
    if (excluded.length && hasExcluded) return false;

    return true;
  }

  /**
   * Find out if the target actor has any of the status conditions required.
   * The bonus will apply if the target actor exists and has at least one.
   * @param {Item|Actor} object     The item or actor. Not relevant in this case.
   * @param {string[]} filter       The array of effect statuses the target must have or must not have.
   * @returns {boolean}             Whether the target actor has any of the status effects.
   */
  static targetEffects(object, filter) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const actor = game.user.targets.first()?.actor;
    if (!actor) return !included.length;

    const hasIncluded = included.some(id => actor.statuses.has(id));
    if (included.length && !hasIncluded) return false;

    const hasExcluded = excluded.some(id => actor.statuses.has(id));
    if (excluded.length && hasExcluded) return false;

    return true;
  }

  /**
   * Find out if the bonus should apply to this type of saving throw.
   * @param {Actor} actor                     The actor making the saving throw.
   * @param {string[]} filter                 The array of saving throw types to check for.
   * @param {object} details                  Additional context to help filter the bonus.
   * @param {string} details.throwType        The id of the ability, can be 'death'.
   * @param {boolean} details.isConcSave      Whether the saving throw is a conc save (if CN enabled).
   * @returns {boolean}                       Whether the throw type is in the filter.
   */
  static throwTypes(actor, filter, {throwType, isConcSave}) {
    if (!filter?.length) return true;
    if (!throwType) return false;
    return filter.includes(throwType) || (filter.includes("concentration") && isConcSave);
  }

  /**
   * Find out if the target is one of the included creature types and none of the excluded types.
   * In the case of no targets, refer to whether any specific creature type was included.
   * @param {Actor|Item} object     The item or actor. Not relevant in this case.
   * @param {string[]} filter       The array of creature types the target must or must not be.
   * @returns {boolean}             Whether the target is of a valid creature type.
   */
  static creatureTypes(object, filter) {
    if (!filter?.length) return true;
    const target = game.user.targets.first();
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const details = target?.actor?.system.details;
    if (!details) return !included.length;

    // All the races the target is a member of.
    const races = FilterManager._splitRaces(target.actor);

    if (included.length && !included.some(e => races.includes(e))) return false;
    if (excluded.length && excluded.some(e => races.includes(e))) return false;
    return true;
  }

  /**
   * Find out if the rolling actor is one of the included creature etypes and none of the excluded types.
   * In the case of no values, refer to whether any specific creature type was included.
   * @param {Actor|Item} object     The rolling actor or item.
   * @param {string[]} filter       The array of creature types the rolling actor must or must not be.
   * @returns {boolean}             Whether the rolling actor is of a valid creature type.
   */
  static actorCreatureTypes(object, filter) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    const actor = object.actor ?? object;
    const details = actor.system.details;
    if (!details) return !included.length;

    // All the races the rolling actor is a member of.
    const races = FilterManager._splitRaces(actor);

    if (included.length && !included.some(e => races.includes(e))) return false;
    if (excluded.length && excluded.some(e => races.includes(e))) return false;
    return true;
  }

  /**
   * Find out if the actor has a number of spell slots remaining between the min and max.
   * @param {Actor|Item} object     The item or actor.
   * @param {object} filter         The filtering for the bonus.
   * @param {number} filter.min     The minimum value available required for the bonus to apply.
   * @param {number} filter.max     The maximum value available required for the bonus to apply.
   * @returns {boolean}             Whether the number of spell slots remaining falls within the bounds.
   */
  static remainingSpellSlots(object, {min, max}) {
    const caster = object.actor ?? object;
    const spells = Object.values(caster.system.spells).reduce((acc, val) => {
      if (!val.value || !val.max) return acc;
      return acc + val.value;
    }, 0);
    return (!!min ? min <= spells : true) && (!!max ? spells <= max : true);
  }

  /**
   * Find out if the embedded script returns true.
   * @param {Actor|Item} object               The item or actor.
   * @param {string} script                   The script saved in the filter.
   * @param {object} details                  Additional context to help filter the bonus.
   * @param {boolean} details.isConcSave      Whether this saving throw is made to maintain concentration.
   * @param {string} details.abilityId        The ability used for an ability check.
   * @param {string} details.skillId          The id of the skill, in case of skill checks.
   * @param {string} details.toolId           The id of the tool type, in case of tool checks.
   * @param {number} details.spellLevel       The level of the spell, if needed.
   * @param {string} details.throwType        The type of saving thwo being made (possibly 'death').
   * @returns {boolean}                       True if the script returns true, otherwise false.
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

  /**
   * Find out if the spell that is cast is one able to consume a spell slot.
   * @param {Item} item           The spell being cast, or making an attack or damage roll.
   * @param {string[]} filter     The types of preparation modes allowed.
   * @returns {boolean}           Whether the spell matches the preparation mode.
   */
  static preparationModes(item, filter) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    return filter.includes(item.system.preparation.mode);
  }

  /**
   * Find out if the targeted token is at least x-by-x or larger, or at most x-by-x or smaller,
   * while optionally also at most as big or small as the roller's token.
   * @param {Actor|Item} object       The roller from which to get their token.
   * @param {object} filter           The filtering for the bonus.
   * @param {number} filter.size      The minimum/maximum size of the targeted token.
   * @param {number} filter.type      Whether it is 'at least' (0) or 'at most' (1).
   * @param {boolean} filter.self     Whether to clamp using the rolling token's size.
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
    return ((type === 0) && (enemySize >= Math.max(se, size))) || ((type === 1) && (enemySize <= Math.min(se, size)));
  }

  /**
   * Find out if the tool being rolled for a check is one of the correct types.
   * @param {Actor} actor         The actor performing the roll.
   * @param {string[]} filter     The types of tool types.
   * @param {string} toolId       The type of tool being rolled.
   * @returns {boolean}           Whether the tool type matches the filter.
   */
  static baseTools(actor, filter, {toolId}) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (!toolId) return included.length === 0;
    if (included.length && !included.includes(toolId)) return false;
    if (excluded.length && excluded.includes(toolId)) return false;
    return true;
  }

  /**
   * Find out if the skill being rolled is one of the correct types.
   * @param {Actor} actor                 The actor performing the roll.
   * @param {string[]} filter             The types of skill ids.
   * @param {object} details              Additional properties for the filtering.
   * @param {string} details.skillId      The id of the skill being rolled.
   * @returns {boolean}                   Whether the skill matches the filter.
   */
  static skillIds(actor, filter, {skillId}) {
    if (!filter?.length) return true;
    const {included, excluded} = FilterManager._splitExlusion(filter);
    if (!skillId) return included.length === 0;
    if (included.length && !included.includes(skillId)) return false;
    if (excluded.length && excluded.includes(skillId)) return false;
    return true;
  }

  /**
   * Find out if the health of the actor is at or above/below the threshold.
   * @param {Actor|Item} object       The actor or item performing the roll.
   * @param {object} filter           The object used for the filtering.
   * @param {number} filter.value     The hit point percentage threshold.
   * @param {number} filter.type      The type of threshold (0 for 'x or lower' and 1 for 'x and higher').
   * @returns {boolean}               Whether the threshold is obeyed.
   */
  static healthPercentages(object, {value, type}) {
    if (!Number.isNumeric(value) || ![0, 1].includes(type)) return true;
    const actor = object.actor ?? object;
    const hp = Math.floor(actor.system.attributes.hp.value / actor.system.attributes.hp.max * 100);
    return ((type === 0) && (hp <= value)) || ((type === 1) && (hp >= value));
  }

  /**
   * Find out if the roll was proficient, and if at a valid level.
   * @param {Actor|Item} object             The actor or item performing the roll.
   * @param {number[]} filter               The levels of valid proficiencies.
   * @param {object} details                Additional properties for the filtering.
   * @param {string} details.throwType      The type of saving throw.
   * @param {string} details.abilityId      The type of ability check.
   * @param {string} details.skillId        The type of skill check.
   * @param {string} details.toolId         The type of tool check.
   * @returns {boolean}                     Whether the roll was one of the proficiency levels.
   */
  static proficiencyLevels(object, filter, {throwType, abilityId, skillId, toolId}) {
    if (!filter?.length) return true;

    // Case 1: Skill.
    else if (skillId) return filter.includes(object.system.skills[skillId]?.prof.multiplier || 0);

    // Case 2: Ability Check.
    else if (abilityId && !toolId) return filter.includes(object.system.abilities[abilityId]?.checkProf.multiplier || 0);

    // Case 3: Death Saving Throw.
    else if (throwType === "death") return filter.includes(Number(object.flags.dnd5e?.diamondSoul || false));

    // Case 4: Saving Throw.
    else if (throwType) return filter.includes(object.system.abilities[throwType]?.saveProf.multiplier || 0);

    // Case 5: Tool.
    else if (toolId) return filter.includes(object.system.tools[toolId]?.prof.multiplier || 0);

    // Case 6: Weapon, equipment, spell.
    else if (object instanceof Item) return filter.includes(object.system.prof.multiplier);

    // Else somehow return false.
    else return false;
  }

  /**
   * Find out if the item that made the roll was the correct feature type and feature subtype.
   * @param {Item} item                 The actor or item performing the roll.
   * @param {object} filter
   * @param {string} filter.type        The feature type.
   * @param {string} filter.subtype     The feature subtype.
   * @returns {boolean}                 Whether the feature is the correct type.
   */
  static featureTypes(item, filter) {
    const config = CONFIG.DND5E.featureTypes;
    if (!filter.type || !(filter.type in config)) return true;
    if (item.type !== "feat") return false;

    const {value, subtype} = item.system.type;
    if (filter.type !== value) return false;

    const subtypes = config[filter.type]?.subtypes ?? {};
    const hasSubtype = !foundry.utils.isEmpty(subtypes);
    if (!hasSubtype || !filter.subtype) return true;

    return subtype === filter.subtype;
  }

  //#endregion
}
