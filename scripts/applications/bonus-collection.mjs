import {Babonus} from "../models/babonus-model.mjs";
import {filters} from "./filterings.mjs";

/**
 * @typedef {object} OptionalBonusConfiguration
 * @property {Babonus} bonus            The babonus.
 * @property {string} [addition]        Bonus to add on top of the roll.
 * @property {string} [damageType]      The selected damage type.
 * @property {number} [scale]           The scaling value.
 * @property {string} [uuid]            Uuid of the document to update or delete.
 * @property {object|object[]|number} [update]   Update object(s) to apply if updating, or a number if damage application.
 * @property {boolean} [isDeletion]     Is this a deletion, not an update?
 * @property {boolean} [isDamage]       Should this be damage application instead of a regular update?
 * @property {boolean} [isEmbedded]     Update embedded documents instead?
 */

/* -------------------------------------------------- */

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

  /* -------------------------------------------------- */

  /**
   * Should a bonus apply?
   * @param {Babonus} babonus     The bonus to test.
   * @param {SubjectConfig} subjects
   * @param {DetailsConfig} details
   * @returns {boolean}           Whether it should apply.
   */
  shouldApply(babonus, subjects, details) {
    for (const [k, v] of Object.entries(babonus.filters)) {
      const result = filters[k].call(babonus, subjects, v, details);
      if (result === false) return false;
    }
    return true;
  }

  /* -------------------------------------------------- */

  /**
   * Iterate the bonuses that might apply.
   * @param {import("./filterings.mjs").SubjectConfig} subjects
   * @param {import("./filterings.mjs").DetailsConfig} details
   * @yields {Babonus}
   * @returns {Generator<Babonus, void, void>}
   */
  *applyingBonuses(subjects, details) {
    for (const babonus of this.all) {
      if (babonus.isOptional && !this.configuredOptionals.has(babonus.uuid)) continue;
      if (!this.shouldApply(babonus, subjects, details)) continue;
      yield babonus;
    }
  }

  /* -------------------------------------------------- */

  /**
   * The optional bonuses that have been configured and should be applied.
   * @type {Map<string, OptionalBonusConfiguration>}
   */
  configuredOptionals = new Map();

  /* -------------------------------------------------- */

  /**
   * Apply updates and deletions from optional bonuses.
   */
  async applyUpdatesAndDeletions() {
    // Perform deletions.
    const deletions = new Set();
    for (const c of this.configuredOptionals.values()) {
      if (!c.isDeletion) continue;
      if (deletions.has(c.uuid)) continue;
      deletions.add(c.uuid);
      const doc = await fromUuid(c.uuid);
      if (doc) await doc.delete();
    }

    // Apply damage.
    for (const c of this.configuredOptionals.values()) {
      if (!c.isDamage) continue;
      const actor = await fromUuid(c.uuid);
      if (actor) await actor.applyDamage(c.update);
    }

    // Update embedded.
    for (const c of this.configuredOptionals.values()) {
      if (!c.isEmbedded) continue;
      const parent = await fromUuid(c.uuid);
      await parent.updateEmbeddedDocuments("Item", c.update);
    }

    // Apply direct updates.
    for (const c of this.configuredOptionals.values()) {
      if (c.isEmbedded || c.isDamage || c.isDeletion) continue;
      const doc = await fromUuid(c.uuid);
      if (doc) await doc.update(c.update);
    }
  }
}
