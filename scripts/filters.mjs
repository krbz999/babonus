import { MATCH, MODULE } from "./constants.mjs";
import {
  finalFilterBonuses,
  getActorEffectBonuses,
  getActorItemBonuses
} from "./helpers.mjs";

/**
 * An example bonus, as it would be
 * stored on an actor, effect, or item.
 * Includes all fields.
 * 
  flags.babonus.bonuses.<damage/attack/save/throw/hitdie>: {
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
        // UNIVERSAL:
        arbitraryComparison: {
          one: "@item.uses.value",
          other: "@abilities.int.mod",
          operator: "EQ" // or LE, GE, LT, GT
        },
        statusEffects: ["blind", "dead", "prone", "mute"], // array of 'flags.core.statusId' strings to match effects against
        targetEffects: ["blind", "dead", "prone", "mute"], // array of 'flags.core.statusId' strings to match effects on the target against

        // ATTACK:
        attackTypes: ["mwak", "rwak", "msak", "rsak"],

        // ATTACK, DAMAGE, SAVE:
        damageTypes: ["fire", "cold", "bludgeoning"],
        abilities: ["int"],
        saveAbilities: ["int", "cha", "con"],

        // THROW:
        throwTypes: ["int", "con", "death"],

        // SPELL:
        spellComponents: {
          types: ["concentration", "vocal"],
          match: "ALL" // or 'ANY'
        },
        spellLevels: ['0','1','2','3','4','5','6','7','8','9'],
        spellSchools: ["evo", "con"],

        // WEAPON
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
  static filterFunctions = {
    item: { // attack, damage, save
      itemTypes: this.itemTypes,
      attackTypes: this.attackTypes,
      baseWeapons: this.baseWeapons,
      damageTypes: this.damageTypes,
      spellSchools: this.spellSchools,
      abilities: this.abilities,
      spellComponents: this.spellComponents,
      spellLevels: this.spellLevels,
      weaponProperties: this.weaponProperties,
      saveAbilities: this.saveAbilities,
      arbitraryComparison: this.arbitraryComparison,
      statusEffects: this.statusEffects,
      targetEffects: this.targetEffects
    },
    throw: { // throw
      arbitraryComparison: this.arbitraryComparison,
      statusEffects: this.statusEffects,
      targetEffects: this.targetEffects,
      throwTypes: this.throwTypes
    },
    misc: { // hitdie
      arbitraryComparison: this.arbitraryComparison,
      statusEffects: this.statusEffects,
      targetEffects: this.targetEffects
    }
  }

  // hitdie rolls
  static hitDieCheck(actor) {
    let bonuses = [];
    const flag = actor.getFlag(MODULE, `bonuses.hitdie`);
    if (flag) bonuses = Object.entries(flag);
    bonuses = bonuses.concat(getActorItemBonuses(actor, "hitdie"));
    bonuses = bonuses.concat(getActorEffectBonuses(actor, "hitdie"));
    if (!bonuses.length) return [];
    return finalFilterBonuses(bonuses, actor, "misc");
  }

  // saving throws
  static throwCheck(actor, abilityId) {
    let bonuses = [];
    const flag = actor.getFlag(MODULE, `bonuses.throw`);
    if (flag) bonuses = Object.entries(flag);
    bonuses = bonuses.concat(getActorItemBonuses(actor, "throw"));
    bonuses = bonuses.concat(getActorEffectBonuses(actor, "throw"));
    if (!bonuses.length) return [];
    return finalFilterBonuses(bonuses, actor, "throw", { throwType: abilityId });
  }


  // attack rolls, damage rolls, displayCards (save dc)
  static itemCheck(item, hookType) {
    let bonuses = [];
    const flag = item.actor.getFlag(MODULE, `bonuses.${hookType}`);
    if (flag) bonuses = Object.entries(flag);
    bonuses = bonuses.concat(getActorItemBonuses(item.parent, hookType));
    bonuses = bonuses.concat(getActorEffectBonuses(item.parent, hookType));
    if (!bonuses.length) return [];
    return finalFilterBonuses(bonuses, item, "item");
  }

  /**
   * Find out if the item's type is one of the valid ones in the filter.
   * This filter is required, so if the filter is empty, it returns false.
   * 
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of item type keys.
   * @returns {Boolean}       Whether the item's type was in the filter.
   */
  static itemTypes(item, filter) {
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
  static baseWeapons(item, filter) {
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
  static damageTypes(item, filter) {
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
  static spellSchools(item, filter) {
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
  static abilities(item, filter) {
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
  static spellLevels(item, filter) {
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
  static attackTypes(item, filter) {
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
  static weaponProperties(item, { needed, unfit }) {
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
  static saveAbilities(item, filter) {
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
   * @param {Item5e|Actor5e} object   The item or actor being filtered against.
   * @param {String} one              The left-side value from the BAB.
   * @param {String} other            The right-side value from the BAB.
   * @param {String} operator         The relation that the two values should have.
   */
  static arbitraryComparison(object, { one, other, operator }) {
    /**
     * This method immediately returns false
     */
    if (!one || !other) return false;

    const rollData = object.getRollData();
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
   * @param {Item5e|Actor5e} object The item or actor being filtered against.
   * @param {Array} filter          The array of effect status ids.
   * @returns {Boolean}             Whether the actor has any of the status effects.
   */
  static statusEffects(object, filter) {
    if (!filter?.length) return true;
    const obj = object.parent ?? object;
    const conditions = filter.some(id => {
      return !!obj.effects.find(eff => {
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
   * @param {Item5e|Actor5e} object The item or actor. Not relevant in this case.
   * @param {Array} filter          The array of effect status ids.
   * @returns {Boolean}             Whether the target actor has any of the status effects.
   */
  static targetEffects(object, filter) {
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

  /**
   * Find out if the bonus should apply to this type of saving throw.
   * This filter is required, so an empty filter returns false.
   * 
   * @param {Actor5e} actor     The actor making the saving throw.
   * @param {Array}   filter    The array of saving throw types to check for.
   * @param {String}  throwType The id of the ability, can be 'death'.
   * @returns {Boolean}         Whether the throw type is in the filter.
   */
  static throwTypes(actor, filter, { throwType }) {
    if (!filter?.length) return false;
    if (!throwType) return false;
    return filter.includes(throwType);
  }
}
