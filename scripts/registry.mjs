/**
 * Utility extension of Map to keep track of rolls and bonuses that apply to them.
 */
class RollRegistry extends Map {
  /**
   * Register an object of data with a generated id.
   * @param {object} config     The data to store.
   * @returns {string}          Randomly generated id to later retrieve the stored data.
   */
  register(config) {
    const id = foundry.utils.randomID();
    this.set(id, config);
    return id;
  }
}

/* -------------------------------------------------- */

/**
 * The registry of rolls being made.
 * @type {RollRegistry<string, object>}
 */
export default new RollRegistry();
