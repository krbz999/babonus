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
    return this.all.size;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses regardless of bonus, type, or modifiers.
   * @type {Collection<string, Babonus>}
   */
  get all() {
    if (!this.#all) {
      const collection = new Collection();
      for (const bonus of this.#bonuses) {
        collection.set(bonus.uuid, bonus);
      }
      this.#all = collection;
    }
    return this.#all;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses regardless of bonus, type, or modifiers.
   * @type {Collection<string, Babonus>}
   */
  #all = null;

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are just reminders.
   * @type {Collection<string, Babonus>}
   */
  get reminders() {
    if (!this.#reminders) {
      const collection = new Collection();
      for (const bonus of this.#bonuses) {
        if (bonus.isReminder) collection.set(bonus.uuid, bonus);
      }
      this.#reminders = collection;
    }
    return this.#reminders;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are just reminders.
   * @type {Collection<string, Babonus>}
   */
  #reminders = null;

  /* -------------------------------------------------- */

  /**
   * All the bonuses that have dice modifiers.
   * @type {Collection<string, Babonus>}
   */
  get modifiers() {
    if (!this.#modifiers) {
      const collection = new Collection();
      for (const bonus of this.#bonuses) {
        if (bonus.hasDiceModifiers) collection.set(bonus.uuid, bonus);
      }
      this.#modifiers = collection;
    }
    return this.#modifiers;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that have dice modifiers.
   * @type {Collection<string, Babonus>}
   */
  #modifiers = null;

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are optional.
   * @type {Collection<string, Babonus>}
   */
  get optionals() {
    if (!this.#optionals) {
      const collection = new Collection();
      for (const bonus of this.#bonuses) {
        if (bonus.isOptional) collection.set(bonus.uuid, bonus);
      }
      this.#optionals = collection;
    }
    return this.#optionals;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that are optional.
   * @type {Collection<string, Babonus>}
   */
  #optionals = null;

  /* -------------------------------------------------- */

  /**
   * All the bonuses that apply immediately with no configuration.
   * @type {Collection<string, Babonus>}
   */
  get nonoptional() {
    if (!this.#nonoptional) {
      const collection = new Collection();
      for (const bonus of this.#bonuses) {
        if (bonus.isOptional || bonus.isReminder) continue;
        if (bonus.hasBonuses) collection.set(bonus.uuid, bonus);
      }
      this.#nonoptional = collection;
    }
    return this.#nonoptional;
  }

  /* -------------------------------------------------- */

  /**
   * All the bonuses that apply immediately with no configuration.
   * @type {Collection<string, Babonus>}
   */
  #nonoptional = null;
}
