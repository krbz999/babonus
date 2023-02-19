import {
  MODULE,
  SETTING_DISABLE_CUSTOM_SCRIPT_FILTER,
  SPELL_COMPONENT_MATCHING
} from "./constants.mjs";
import { _collectBonuses } from "./helpers/bonusCollector.mjs";

/**
 * An example bonus, as it would be stored on an actor, effect, item, or template.
 * Includes all fields.
 *
  flags.babonus.bonuses: {
    <id>: {
      enabled: true,                                        // Whether this bonus is turned on.
      name: "Special Fire Spell Bonus",                     // The name of the bonus.
      id: "hgienfid783h",                                   // Regular 16 character id.
      description: "This is ...",                           // Description of the bonus.
      type: "attack",                                       // Or "damage", "save", "throw", "hitdie".
      itemOnly: false,                                      // whether this bonus only applies to the item on which it is created (attack/damage/save only).
      optional: false,                                      // whether this bonus is toggleable in the roll config.
      consume: {
        enabled: true,                                      // whether the bonus consumes uses/quantity off its item or slots off its actor.
        scales: true,                                       // whether the consumption scales between the min and max values given.
        type: "uses",                                       // whether the consumption is limited "uses" or "quantity" or "slots".
        value: {min: 1, max: 3}                             // the minimum and maximum number consumed when applying the bonus.
      },
      aura: {
        enabled: true,                                      // Whether this should be an aura.
        isTemplate: true,                                   // Whether this should be a template aura, not a regular aura.
        range: 60,                                          // The range of the aura (in ft), not relevant if template. Use -1 for infinite.
        self: false,                                        // Whether the aura affects the owner, too.
        disposition: 1                                      // What token actors within range to affect.
        blockers: ["dead", "unconscious"]                   // Array of status ids that stop auras from being transferred. Not relevant if template.
      },
      bonuses: {
        bonus: "1d4 + @abilities.int.mod",                  // All types, but 'save' only takes numbers, not dice.
        criticalBonusDice: "5",                             // Strings that evaluate to numbers only (including rollData), 'damage' only.
        criticalBonusDamage: "4d6 + 2"                      // Any die roll, 'damage' only.
        deathSaveTargetValue: "12",                         // Strings that evaluate to numbers only (including rollData), 'throw' only.
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
        statusEffects: ["blind", "dead", "prone", "mute"],  // Array of status ids to match effects against.
        targetEffects: ["blind", "dead", "prone", "mute"],  // Array of status ids to match effects on the target against.
        creatureTypes: {
          needed: ["undead", "humanoid"],                   // Array of CONFIG.DND5E.creatureTypes. This is not strict, to allow for subtype/custom.
          unfit: ["construct"]
        },
        itemRequirements: {equipped: true, attuned: false}, // Whether it must be attuned/equipped.
        customScripts: "return true;",                      // A custom script that returns true or false.
        remainingSpellSlots: {min: 3, max: null},           // A min and max number of spell slots remaining the actor must have.

        // ATTACK, DAMAGE:
        attackTypes: ["mwak", "rwak", "msak", "rsak"],      // The type of attack.

        // ATTACK, DAMAGE, SAVE:
        damageTypes: ["fire", "cold", "bludgeoning"],       // The type of damage the item must have.
        abilities: ["int"],                                 // The ability the item must be using.
        saveAbilities: ["int", "cha", "con"],               // The ability that sets the save DC.
        itemTypes: ["spell", "weapon"],                     // The item types to which it applies; also "feat", "equipment", "consumable".

        // THROW:
        throwTypes: ["con", "death", "concentration"],      // The type of saving throw to which it applies.

        // SPELL:
        spellComponents: {types: ["vocal"], match: "ALL"},  // Spell components it must have; at least one or match "ANY".
        spellLevels: ['0','1','2','3'],                     // The level the spell must be.
        spellSchools: ["evo", "con"],                       // The school the spell must be.

        // WEAPON
        baseWeapons: ["dagger", "lance", "shortsword"],     // The weapon the item must be.
        weaponProperties: {needed: ["fin"], unfit: []}      // The weapon properties the item must have one of, and have none of.
      }
    }
  }
 */

export class FILTER {

  // hitdie rolls
  static hitDieCheck(actor) {
    const bonuses = _collectBonuses(actor, "hitdie");
    if (!bonuses.length) return [];
    return this.finalFilterBonuses(bonuses, actor);
  }

  // saving throws (isConcSave for CN compatibility)
  static throwCheck(actor, throwType, { isConcSave }) {
    const bonuses = _collectBonuses(actor, "throw");
    if (!bonuses.length) return [];
    return this.finalFilterBonuses(bonuses, actor, { throwType, isConcSave });
  }


  // attack rolls, damage rolls, displayCards (save dc)
  static itemCheck(item, hookType, { spellLevel } = {}) {
    const bonuses = _collectBonuses(item, hookType);
    if (!bonuses.length) return [];
    return this.finalFilterBonuses(bonuses, item, { spellLevel });
  }

  // Filters the collected array of bonuses. Returns the reduced array.
  static finalFilterBonuses(bonuses, object, details = {}) {
    const valids = bonuses.reduce((acc, bab) => {
      const filters = Object.entries(bab.filters ?? {});
      for (const [key, val] of filters) {
        if (val === undefined) continue;
        const valid = this[key](object, val, details);
        if (!valid) return acc;
      }
      acc.push(bab);
      return acc;
    }, []);
    this._replaceRollDataOfBonuses(valids, object);
    return valids;
  }

  // Replace roll data of bonuses that originate from foreign sources, including transferred effects.
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
      const update = Object.entries(bonus.bonuses).reduce((acc, [key, val]) => {
        if (!val) return acc;
        acc[key] = Roll.replaceFormulaData(val, data);
        return acc;
      }, {});
      try { bonus.updateSource({ bonuses: update }) } catch (err) {}
    }
  }

  /**
   * Find out if the item's type is one of the valid ones in the filter.
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of item type keys.
   * @returns {Boolean}       Whether the item's type was in the filter.
   */
  static itemTypes(item, filter) {
    if (!filter?.length) return true;
    return filter.includes(item.type);
  }

  /**
   * Find out if the item's base weapon type is one of the valid ones in the filter.
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of weapon baseItem keys.
   * @returns {Boolean}       Whether the item's baseItem was in the filter.
   */
  static baseWeapons(item, filter) {
    if (!filter?.length) return true;
    if (item.type !== "weapon") return false;
    return filter.includes(item.system.baseItem);
  }

  /**
   * Find out if the item has any of the filter's damage types in its damage.parts.
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of damage types.
   * @returns {Boolean}       Whether the item's damage types overlap with the filter.
   */
  static damageTypes(item, filter) {
    if (!filter?.length) return true;
    return item.getDerivedDamageLabel().some(i => {
      return filter.includes(i.damageType);
    });
  }

  /**
   * Find out if the item is a spell and belongs to one of the filter's spell schools.
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
   * Find out if the item is using one of the abiities in the filter. Consideration is made
   * by the system itself for items set to 'Default' to look for finesse weapons and
   * spellcasting abilities. Note that this is the ability set at the top level of the
   * item's action, and is NOT the ability used to determine the saving throw DC.
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} filter    The array of abilities.
   * @returns {Boolean}       Whether item is using one of the abilities.
   */
  static abilities(item, filter) {
    if (!filter?.length) return true;
    // if the item has no actionType, it has no ability.
    if (!item.system.actionType) return false;
    return filter.includes(item.abilityMod);
  }

  /**
   * Find out if the item is a spell and has any, or all, of the required spell components.
   * The item must match either ALL or at least one, depending on what is set.
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} types     The array of spell components in the filter.
   * @param {String} match    The type of matching, either ALL or ANY.
   * @returns {Boolean}       Whether the item had any/all of the components.
   */
  static spellComponents(item, { types, match }) {
    if (!types?.length) return true;
    if (item.type !== "spell") return false;

    const comps = item.system.components;
    // If it must match all, then filter is a (proper) subset of the spell's comps.
    if (match === SPELL_COMPONENT_MATCHING.ALL) return types.every(type => comps[type]);
    // Else ensure it matches at least one comp.
    else if (match === SPELL_COMPONENT_MATCHING.ANY) return types.some(type => comps[type]);
    return false;
  }

  /**
   * Find out if the item was cast at any of the required spell levels.
   * If a spell is upcast, the item is the cloned spell, so the level of the item
   * is always the level at which it was cast.
   * @param {Item5e} item         The item being filtered against.
   * @param {Array} filter        The array of spell levels in the filter.
   * @param {Number} spellLevel   The level at which an attack/damage roll was performed, for spells.
   * @returns {Boolean}           Whether the item is of one of the appropriate levels.
   */
  static spellLevels(item, filter, { spellLevel = null } = {}) {
    if (!filter?.length) return true;
    if (item.type !== "spell") return false;
    const level = Number(spellLevel ?? item.system.level);
    return filter.some(f => {
      return Number(f) === level;
    });
  }

  /**
   * Find out if the item's action type is set to any of the required types.
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
   * @param {Item5e} item     The item being filtered against.
   * @param {Array} needed    The weapon properties that the item must have at least one of.
   * @param {Array} unfit     The weapon properties that the item must have none of.
   * @returns {Boolean}       Whether the item has any of the needed properties, and none of the unfit properties.
   */
  static weaponProperties(item, { needed, unfit }) {
    if (!needed?.length && !unfit?.length) return true;
    if (item.type !== "weapon") return false;
    const props = item.system.properties;
    const pu = unfit?.length && unfit.some(p => props[p]);
    const pn = needed?.length ? needed.some(p => props[p]) : true;
    return !pu && pn;
  }

  /**
   * Find out if the saving throw in the item is set using an ability in the filter.
   * This filter is only available for bonuses applying specifically to saving throw DCs.
   * Special consideration is made for items with save DC set using spellcasting ability.
   * @param {Item5e} item     The item being filterd against.
   * @param {Array} filter    The ability that is used to set the DC of the item's saving throw.
   * @returns {Boolean}       Whether the item's saving throw is set using an ability in the filter.
   */
  static saveAbilities(item, filter) {
    if (!filter?.length) return true;
    if (!item.hasSave) return false;
    let abl;
    if (item.system.save.scaling === "spell") {
      abl = item.actor.system.attributes.spellcasting;
    } else abl = item.system.save.scaling;
    return filter.includes(abl);
  }

  /**
   * Return whether ONE and OTHER have the correct relation. If the two values
   * do not evaluate to numbers, string comparison will be used instead. Here
   * 'less than' and 'less than or equal' will mean 'is a substring'. String
   * comparison happens after replacing any rollData attributes.
   * @param {Item5e|Actor5e} object   The item or actor being filtered against.
   * @param {Array} filter            An array of objects with one, other, operator.
   */
  static arbitraryComparison(object, filter) {
    if (!filter?.length) return true;

    const rollData = object.getRollData();
    const target = game.user.targets.first();
    if (target?.actor) rollData.target = target.actor.getRollData();

    for (const { one, other, operator } of filter) {
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
   * Find out if the actor has any of the status conditions required.
   * The bonus will apply if the actor has at least one.
   * @param {Item5e|Actor5e} object   The item or actor being filtered against.
   * @param {Array} filter            The array of effect status ids.
   * @returns {Boolean}               Whether the actor has any of the status effects.
   */
  static statusEffects(object, filter) {
    if (!filter?.length) return true;
    const obj = object.actor ?? object;
    return filter.some(id => {
      return !!obj.effects.find(eff => {
        if (eff.disabled || eff.isSuppressed) return false;
        return eff.getFlag("core", "statusId") === id;
      });
    });
  }

  /**
   * Find out if the target actor has any of the status conditions required.
   * The bonus will apply if the target actor exists and has at least one.
   * @param {Item5e|Actor5e} object   The item or actor. Not relevant in this case.
   * @param {Array} filter            The array of effect status ids.
   * @returns {Boolean}               Whether the target actor has any of the status effects.
   */
  static targetEffects(object, filter) {
    if (!filter?.length) return true;
    const target = game.user.targets.first();
    if (!target?.actor) return false;
    return filter.some(id => {
      return target.actor.effects.find(eff => {
        if (eff.disabled || eff.isSuppressed) return false;
        return eff.getFlag("core", "statusId") === id;
      });
    });
  }

  /**
   * Find out if the bonus should apply to this type of saving throw.
   * @param {Actor5e} actor         The actor making the saving throw.
   * @param {Array} filter          The array of saving throw types to check for.
   * @param {String} throwType      The id of the ability, can be 'death'.
   * @param {Booolean} isConcSave   Whether the saving throw is a conc save (if CN enabled).
   * @returns {Boolean}             Whether the throw type is in the filter.
   */
  static throwTypes(actor, filter, { throwType, isConcSave }) {
    if (!filter?.length) return true;
    if (!throwType) return false;
    return filter.includes(throwType) || (filter.includes("concentration") && isConcSave);
  }

  /**
   * Find out if your target is one of the listed creature types. In the case of no targets,
   * refer to whether a specific creature type was needed.
   * @param {Actor5e|Item5e} object   The item or actor. Not relevant in this case.
   * @param {Array} needed            The array of creature types the target must be.
   * @param {Array} unfit             The array of creature types the target must not be.
   * @returns {Boolean}               Whether the target is of a valid creature type.
   */
  static creatureTypes(object, { needed, unfit }) {
    if (!needed?.length && !unfit?.length) return true;
    const target = game.user.targets.first();
    if (!target?.actor) return !needed?.length;
    const { value, subtype, custom } = target.actor.system.details?.type ?? {};
    const race = target.actor.system.details?.race;
    function _inclusionTest(array) {
      const val = value ? array.includes(value) : false;
      const sub = subtype ? array.includes(subtype?.toLowerCase()) : false;
      const cus = custom ? array.includes(custom?.toLowerCase()) : false;
      const rac = race ? array.includes(race?.toLowerCase()) : false;
      return val || sub || cus || rac;
    }
    if (needed?.length && !_inclusionTest(needed)) return false;
    if (unfit?.length && _inclusionTest(unfit)) return false;
    return true;
  }

  /**
   * Find out if the actor has a number of spell slots remaining between the min and max.
   * @param {Actor|Item5e} object   The item or actor.
   * @param {Number} min            The minimum value available required for the bonus to apply.
   * @param {Number} max            The maximum value available required for the bonus to apply.
   * @returns {Boolean}             Whether the number of spell slots remaining falls within the bounds.
   */
  static remainingSpellSlots(object, { min, max }) {
    const caster = object.actor ?? object;
    const spells = Object.values(caster.system.spells).reduce((acc, val) => {
      if (!val.value || !val.max) return acc;
      return acc + val.value;
    }, 0);
    return (!!min ? min <= spells : true) && (!!max ? spells <= max : true);
  }

  /**
   * This always returns true because it is filtered elsewhere.
   * A babonus on an item is immediately discarded if the item
   * requires equipped/attuned but was not.
   * @returns {Boolean}   Always returns true.
   */
  static itemRequirements() {
    return true;
  }

  /**
   * Find out if the embedded script returns true.
   * @param {Actor5e|Item5e} object   The item or actor.
   * @param {String} script           The script saved in the filter.
   * @returns {Boolean}               True if the script returns true, otherwise false.
   */
  static customScripts(object, script) {
    if (!script?.length) return true;
    if (game.settings.get(MODULE, SETTING_DISABLE_CUSTOM_SCRIPT_FILTER)) return true;
    try {
      const func = Function("actor", "item", "token", script);
      const actor = object.parent instanceof Actor ? object.parent : object instanceof Actor ? object : null;
      const token = actor?.token?.object ?? actor?.getActiveTokens()[0] ?? null;
      const item = object instanceof Item ? object : null;
      const valid = func.call({}, actor, item, token) === true;
      return valid;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
}
