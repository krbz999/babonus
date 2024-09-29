import {Babonus} from "../models/babonus-model.mjs";

const {Collection} = foundry.utils;

/**
 * Simple class for holding onto bonuses in a structured manner depending on their type and effect.
 * @param {Iterable<Babonus>} bonuses     The bonuses to structure.
 */
export default class BonusCollection {
  constructor(bonuses) {
    this.#bonuses = bonuses;
  }

  /* -------------------------------------------------- */

  /**
   * The bonuses to structure.
   * @type {Iterable<Babonus>}
   */
  #bonuses = null;

  /* -------------------------------------------------- */

  /**
   * Reference to the size of the collection, regardless of type of iterator.
   * @type {number}
   */
  get size() {
    return [...this.#bonuses].length;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses regardless of bonus, type, or modifiers.
   * @type {Collection<string, Babonus>}
   */
  get all() {
    const collection = new Collection();
    for (const bonus of this.#bonuses) {
      collection.set(bonus.uuid, bonus);
    }
    return collection;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are just reminders.
   * @type {Collection<string, Babonus>}
   */
  get reminders() {
    const collection = new Collection();
    for (const bonus of this.#bonuses) {
      if (bonus.isReminder) collection.set(bonus.uuid, bonus);
    }
    return collection;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that have dice modifiers.
   * @type {Collection<string, Babonus>}
   */
  get modifiers() {
    const collection = new Collection();
    for (const bonus of this.#bonuses) {
      if (bonus.hasDiceModifiers) collection.set(bonus.uuid, bonus);
    }
    return collection;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are optional.
   * @type {Collection<string, Babonus>}
   */
  get optionals() {
    const collection = new Collection();
    for (const bonus of this.#bonuses) {
      if (bonus.isOptional) collection.set(bonus.uuid, bonus);
    }
    return collection;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that apply immediately with no configuration.
   * @type {Collection<string, Babonus>}
   */
  get nonoptional() {
    const collection = new Collection();
    for (const bonus of this.#bonuses) {
      if (bonus.isOptional || bonus.isReminder) continue;
      if (bonus.hasBonuses) collection.set(bonus.uuid, bonus);
    }
    return collection;
  }
}
