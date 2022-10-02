import { MATCH, MODULE } from "./constants.mjs";

/**
 * An example bonus, as it would be
 * stored on an actor, effect, or item.
 * Includes all fields.
 * 
    flags.babonus.bonuses.<damage/attack/save>: {
        <identifier>: {
            enabled: true,
            label: "Special Fire Spell Bonus",
            description: "This is a special fire spell bonus.",
            itemTypes: ["spell", "weapon", "feat", "equipment", "consumable"], // if attack/damage/save
            values: {
                bonus: "1d4 + @abilities.int.mod",  // all types, but 'save' only takes numbers, not dice.
                criticalBonusDice: "5",             // strings that evaluate to numbers only (including rollData), 'damage' only
                criticalBonusDamage: "4d6 + 2"      // any die roll, 'damage' only
            },
            itemRequirements: { // for bonuses stored on items only.
                equipped: true,
                attuned: false
            },
            filters: {
                damageTypes: ["fire", "cold", "bludgeoning"],
                abilities: ["int"],
                arbitraryComparison: {
                    one: "@item.uses.value",
                    other: "@abilities.int.mod",
                    operator: "EQ" // or LE, GE, LT, GT
                },
                statusEffects: ["blind", "dead", "prone", "mute"], // array of 'flags.core.statusId' strings to match effects against
                targetEffects: ["blind", "dead", prone", "mute"], // array of 'flags.core.statusId' strings to match effects on the target against
                attackTypes: ["mwak", "rwak", "msak", "rsak"], // only when set to 'attack'
                saveAbilities: ["int", "cha", "..."],
                spellComponents: {
                    types: ["concentration", "vocal"],
                    match: "ALL" // or 'ANY'
                },
                spellLevels: ['0','1','2','3','4','5','6','7','8','9'],
                spellSchools: ["evo", "con"],
                baseweapons: ["dagger", "lance", "shortsword"],
                weaponProperties: {
                    needed: ["fin", "lgt"],
                    unfit: ["two", "ver"]
                }
            }
        }
    }
 */

export class FILTER {
  /**
   * An object mapping filter keys to the relevant filtering
   * function found in this class. Mainly used for an overview.
   */
  static filterFn = {
    itemTypes: this.itemType,
    attackTypes: this.attackType,
    baseWeapons: this.baseWeapon,
    damageTypes: this.damageType,
    spellSchools: this.spellSchool,
    abilities: this.ability,
    spellComponents: this.spellComponents,
    spellLevels: this.spellLevel,
    weaponProperties: this.weaponProperty,
    saveAbilities: this.saveAbility,
    arbitraryComparison: this.arbitraryComparison,
    statusEffects: this.statusEffects,
    targetEffects: this.targetEffects
  }


  /**
   * The main function that loops through all applicable filter functions and returns the bonuses to apply.
   * 
   * @param {Item5e} item         The item being used or displayed.
   * @param {String} hookType     The type of action happening, which tells the filter what
   *                              bonus types to look for. This is either 'save' (on displayCard),
   *                              'attack' or 'damage' for when an item is rolled in this way.
   * @returns {Array}             The array of valid bonuses.
   */
  static mainCheck(item, hookType) {
    let bonuses = [];

    // add bonuses from actor.
    const flag = item.actor.getFlag(MODULE, `bonuses.${hookType}`);
    if (flag) bonuses = Object.entries(flag);

    /**
     * Add bonuses from items. Any item-only filtering happens here,
     * such as checking if the item is currently, and requires being,
     * equipped and/or attuned. Not all valid item types have these
     * properties, such as feature type items.
     */
    for (const it of item.actor.items) {
      const itemFlag = it.getFlag(MODULE, `bonuses.${hookType}`);
      if (!itemFlag) continue;

      const itemBonuses = Object.entries(itemFlag);
      const { equipped, attunement } = it.system;
      const { ATTUNED } = CONFIG.DND5E.attunementTypes;
      const validItemBonuses = itemBonuses.filter(([id, { enabled, itemRequirements }]) => {
        if (!enabled) return false;
        if (!itemRequirements) return true;
        const { equipped: needsEq, attuned: needsAtt } = itemRequirements;
        if (!equipped && needsEq) return false;
        if (attunement !== ATTUNED && needsAtt) return false;
        return true;
      });

      bonuses = bonuses.concat(validItemBonuses);
    }

    /**
     * Add bonuses from effects. Any effect-only filtering happens here,
     * such as checking whether the effect is disabled or unavailable.
     */
    for (const eff of item.actor.effects) {
      if (eff.disabled || eff.isSuppressed) continue;
      const effectFlag = eff.getFlag(MODULE, `bonuses.${hookType}`);
      if (!effectFlag) continue;

      const effectBonuses = Object.entries(effectFlag);
      const validEffectBonuses = effectBonuses.filter(([id, { enabled }]) => {
        return enabled;
      });
      bonuses = bonuses.concat(validEffectBonuses);
    }

    /**
     * After finding all valid bonuses, if none
     * are found, we have no need to filter anything.
     */
    if (!bonuses.length) return [];

    // the final filtering.
    const valids = bonuses.reduce((acc, [id, { enabled, values, filters, itemTypes }]) => {
      /**
       * The bonus must be enabled. This can be disabled
       * either via ActiveEffects or directly in the BAB.
       */
      if (!enabled) return acc;

      /**
       * Add itemTypes to the filter temporarily to allow it to be checked against
       * as well. This normally does not live in the 'filters' object of a bonus.
       */
      filters["itemTypes"] = itemTypes;

      /**
       * Check if the bonus is a valid bonus for each key in the filter object.
       * Not every filter has all keys; they contain only those keys that the 
       * BAB has verified (e.g., removed empty bonuses or invalid keys).
       * If any of these filters are empty, it is due to ActiveEffects.
       */
      for (const key in filters) {
        const validity = FILTER.filterFn[key](item, filters[key]);
        if (!validity) return acc;
      }

      // delete temporary key.
      delete filters["itemTypes"];

      acc.push(values);
      return acc;
    }, []);
    return valids;
  }

  /**
   * Find out if the item's type is one of the valid ones in the filter.
   * This filter is required, so if the filter is empty, it returns false.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of item type keys.
   * @returns {Boolean}       Whether the item's type was in the filter.
   */
  static itemType(item, filter) {
    if (!filter?.length) return false;
    const itemType = item.type;
    return filter.includes(itemType);
  }

  /**
   * Find out if the item's base weapon type is one of the valid ones in the filter.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of weapon baseItem keys.
   * @returns {Boolean}       Whether the item's baseItem was in the filter.
   */
  static baseWeapon(item, filter) {
    if (!filter?.length) return true;
    // only weapons can be a type of weapon...
    if (item.type !== "weapon") return false;
    return filter.includes(item.system.baseItem);
  }

  /**
   * Find out if the item has any of the filter's damage types in its damage.parts.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of damage types.
   * @returns {Boolean}       Whether the item's damage types overlap with the filter.
   */
  static damageType(item, filter) {
    if (!filter?.length) return true;

    const damageTypes = item.getDerivedDamageLabel().some(({ damageType }) => {
      return filter.includes(damageType);
    });
    return damageTypes;
  }

  /**
   * Find out if the item is a spell and belongs to one of the filter's spell schools.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of spell schools.
   * @returns {Boolean}       Whether the item is a spell and is of one of these schools.
   */
  static spellSchool(item, filter) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    return filter.includes(item.system.school);
  }

  /**
   * Find out if the item is using one of the abiities in the filter.
   * Special consideration is made for items set to 'Default' to look for
   * finesse weapons and spellcasting abilities.
   * Note that this is the ability set at the top level of the item's action,
   * and is NOT the ability used to determine the saving throw DC.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of abilities.
   * @returns {Boolean}       Whether item is using one of the abilities.
   */
  static ability(item, filter) {
    if (!filter?.length) return true;

    const { actionType, ability, properties } = item.system;

    // if the item has no actionType, it has no ability.
    if (!actionType) return false;

    /**
     * Special consideration for items set to use 'Default'.
     * This is sometimes an empty string, and sometimes null,
     * but should always be falsy.
     */
    if (!ability) {
      const { abilities, attributes } = item.actor.system;

      /**
       * If a weapon is Finesse, then a bonus applying to Strength
       * or Dexterity should apply if and only if the relevant
       * modifier is higher than the other.
       */
      if (item.type === "weapon" && properties.fin) {
        const str = abilities.str.mod;
        const dex = abilities.dex.mod;
        if (filter.includes("str") && str >= dex) return true;
        if (filter.includes("dex") && dex >= str) return true;
      }

      /**
       * If the action type is a melee weapon attack, then a bonus
       * applying to Strength should apply.
       */
      if (actionType === "mwak" && filter.includes("str")) return true;

      /**
       * If the action type is a ranged weapon attack, then a bonus
       * applying to Dexterity should apply.
       */
      if (actionType === "rwak" && filter.includes("dex")) return true;

      /**
       * If the action type is a melee or ranged spell attack, or a saving throw,
       * then bonuses applying to the actor's spellcasting ability should apply.
       * 
       * Unless explicitly set to something different, the ability for a saving throw
       * is always the spellcasting ability, no matter the item type.
       */
      if (["msak", "rsak", "save"].includes(actionType)) {
        if (filter.includes(attributes.spellcasting)) return true;
      }
    }

    return filter.includes(ability);
  }

  /**
   * Find out if the item is a spell and has any, or all, of the required spell components.
   * The item must match either ALL or at least one, depending on what is set.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} types     The array of spell components in the filter.
   * @param {String} match    The type of matching, either ALL or ANY.
   * @returns {Boolean}       Whether the item had any/all of the components.
   */
  static spellComponents(item, { types, match }) {
    if (!types?.length) return true;
    if (item.type !== "spell") return false;

    const { components } = item.system;

    /**
     * If the item must match all of the components in the filter,
     * then the filter is a (proper) subset of the spell's components.
     */
    if (match === MATCH.ALL) {
      return types.every(type => components[type]);
    }
    /**
     * If the item must match at least one of the components in the filter,
     * then at least one element of the filter must be found in the spell's components.
     */
    else if (match === MATCH.ANY) {
      return types.some(type => components[type]);
    }

    return false;
  }

  /**
   * Find out if the item was cast at any of the required spell levels.
   * If a spell is upcast, the item is the cloned spell, so the level of the item
   * is always the level at which it was cast.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of spell levels in the filter.
   * @returns {Boolean}       Whether the item is of one of the appropriate levels.
   */
  static spellLevel(item, filter) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    const level = Number(item.system.level);
    return filter.map(i => Number(i)).includes(level);
  }

  /**
   * Find out if the item's action type is set to any of the required types.
   * This filter only applies to attack rolls and will not be filtered against otherwise.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of attack types.
   * @returns {Boolean}       Whether the item has any of the required attack types.
   */
  static attackType(item, filter) {
    if (!filter?.length) return true;
    const actionType = item.system.actionType;
    if (!actionType) return false;
    return filter.includes(actionType);
  }

  /**
   * Find out if the item has any of the needed weapon properties, while having none
   * of the unfit properties. Such as only magical weapons that are not two-handed.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} needed    The weapon properties that the item must have at least one of.
   * @param {Array} unfit     The weapon properties that the item must have none of.
   * @returns {Boolean}       Whether the item has any of the needed properties, and none of the unfit properties.
   */
  static weaponProperty(item, { needed, unfit }) {
    if (!needed?.length && !unfit?.length) return true;
    if (item.type !== "weapon") return false;

    const { properties } = item.system;

    if (unfit?.length) {
      const isUnfit = unfit.some((property) => properties[property]);
      if (isUnfit) return false;
    }

    if (needed?.length) {
      const isFit = needed.some((property) => properties[property]);
      if (!isFit) return false;
    }

    return true;
  }

  /**
   * Find out if the saving throw in the item is set using an ability in the filter.
   * This filter is only available for bonuses applying specifically to saving throws.
   * Special consideration is made for items with save DC set using spellcasting ability.
   * 
   * @param {Item5e} item     The item being filterd against.
   * @param {Array} filter    The ability that is used to set the DC of the item's saving throw.
   * @returns {Boolean}       Whether the item's saving throw is set using an ability in the filter.
   */
  static saveAbility(item, filter) {
    if (!filter?.length) return true;

    const scaling = item.system.save?.scaling;
    const { spellcasting } = item.actor.system.attributes;
    if (!scaling) return false;

    // if the item is set to use spellcasting ability for the DC.
    if (scaling === "spell") {
      return filter.includes(spellcasting);
    }

    return filter.includes(scaling);
  }

  /**
   * Return whether ONE and OTHER have the correct relation.
   * If the two values do not evaluate to numbers, string comparison
   * will be used instead. Here 'less than' and 'less than or equal'
   * will mean 'is a substring'. String comparison happens after 
   * replacing any rollData attributes.
   * 
   * @param {Item5e} item         The item being filtered against.
   * @param {String} one          The left-side value from the BAB.
   * @param {String} other        The right-side value from the BAB.
   * @param {String} operator     The relation that the two values should have.
   */
  static arbitraryComparison(item, { one, other, operator }) {
    /**
     * This method immediately returns false
     */
    if (!one || !other) return false;

    const rollData = item.getRollData();
    let left = Roll.replaceFormulaData(one, rollData);
    let right = Roll.replaceFormulaData(other, rollData);

    try {
      // try comparing numbers.
      let nLeft = Roll.safeEval(left);
      let nRight = Roll.safeEval(right);
      if (operator === "EQ") return nLeft === nRight;
      if (operator === "LT") return nLeft < nRight;
      if (operator === "GT") return nLeft > nRight;
      if (operator === "LE") return nLeft <= nRight;
      if (operator === "GE") return nLeft >= nRight;
      return false;
    }
    catch {
      // try comparing strings.
      if (operator === "EQ") return left == right;
      if (["LT", "LE"].includes(operator)) return right.includes(left);
      if (["GT", "GE"].includes(operator)) return left.includes(right);
      return false;
    }
  }

  /**
   * Find out if the actor has any of the status conditions required.
   * The bonus will apply if the actor has at least one.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of effect status ids.
   * @returns {Boolean}       Whether the actor has any of the status effects.
   */
  static statusEffects(item, filter) {
    if (!filter?.length) return true;
    const conditions = filter.some(id => {
      return !!item.actor.effects.find(eff => {
        if (eff.disabled || eff.isSuppressed) return false;
        return eff.getFlag("core", "statusId") === id;
      });
    });
    return conditions;
  }

  /**
   * Find out if the target actor has any of the status conditions required.
   * The bonus will apply if the target actor exists and has at least one.
   * 
   * @param {Item5e} item     The item used. Not relevant in this case.
   * @param {Array} filter    The array of effect status ids.
   * @returns {Boolean}       Whether the target actor has any of the status effects.
   */
  static targetEffects(item, filter) {
    if (!filter?.length) return true;
    const target = game.user.targets.first();
    if (!target) return false;
    const conditions = filter.some(id => {
      return target.actor.effects.find(eff => {
        if (eff.disabled || eff.isSuppressed) return false;
        return eff.getFlag("core", "statusId") === id;
      });
    });
    return conditions;
  }
}
