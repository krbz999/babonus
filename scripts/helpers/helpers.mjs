/** A collection of getters for Keys dialogs when creating or editing a babonus. */
export class KeyGetter {

  /**
   * Helper method for creating an array of choices.
   * @param {string} key                  The choices to retrieve from the KeyGetter.
   * @param {boolean} [negate=false]      Whether 'exclude' options should be included.
   * @returns {string[]}                  An array of string options.
   */
  static _getSchemaFilterOptions(key, negate = false) {
    if (negate) return KeyGetter[key].flatMap(({value}) => [value, `!${value}`]);
    else return KeyGetter[key].map(({value}) => value);
  }

  /**
   * Get key and names from compendium packs given an object of ids in the CONFIG.
   * @param {object} key      The key of the object of ids in CONFIG.DND5E.
   * @returns {object[]}      An array of objects with 'value' and 'label.
   */
  static _getEntriesFromConfig(key) {
    return Object.entries(CONFIG.DND5E[key]).reduce((acc, [value, uuid]) => {
      let pack = CONFIG.DND5E.sourcePacks.ITEMS;
      let [scope, collection, id] = uuid.split(".");
      if (scope && collection) pack = `${scope}.${collection}`;
      if (!id) id = uuid;
      const name = game.packs.get(pack)?.index.get(id)?.name;
      if (name) acc.push({value, label: name});
      return acc;
    }, []);
  }

  // Base armor types (and 'shield').
  static get baseArmors() {
    return KeyGetter._getEntriesFromConfig("armorIds").concat({
      value: "shield", label: game.i18n.localize("DND5E.EquipmentShield")
    });
  }

  // base weapon types.
  static get baseWeapons() {
    return KeyGetter._getEntriesFromConfig("weaponIds");
  }

  // Base tool types.
  static get baseTools() {
    return KeyGetter._getEntriesFromConfig("toolIds");
  }

  // the types of damage, as well as healing and temp.
  static get damageTypes() {
    const damages = Object.entries(CONFIG.DND5E.damageTypes);
    const heals = Object.entries(CONFIG.DND5E.healingTypes);
    return [...damages, ...heals].map(([value, label]) => ({value, label}));
  }

  // the spell schools available.
  static get spellSchools() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([value, label]) => ({value, label}));
  }

  // ability score keys.
  static get abilities() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, {label}]) => ({value, label}));
  }

  static get saveAbilities() {
    return this.abilities;
  }

  static get throwTypes() {
    const abl = this.abilities;
    abl.push({
      value: "death",
      label: game.i18n.localize("DND5E.DeathSave")
    });
    // CN compatibility.
    if (game.modules.get("concentrationnotifier")?.active) {
      abl.push({
        value: "concentration",
        label: game.i18n.localize("DND5E.Concentration")
      });
    }
    return abl;
  }

  // spell component types.
  static get spellComponents() {
    const comps = Object.entries(CONFIG.DND5E.spellComponents);
    const tags = Object.entries(CONFIG.DND5E.spellTags);
    return [...comps, ...tags].map(([value, {abbr, label}]) => {
      return {value, label, abbr};
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  // spell levels.
  static get spellLevels() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({value, label}));
  }

  // all weapon properties.
  static get weaponProperties() {
    const properties = Object.entries(CONFIG.DND5E.weaponProperties);
    return properties.map(([value, label]) => ({value, label}));
  }

  // all status effects.
  static get effects() {
    let effects = CONFIG.statusEffects;
    if (game.modules.get("concentrationnotifier")?.active) {
      // Using .concat as not to mutate.
      effects = effects.concat({
        id: "concentration",
        icon: "icons/magic/light/orb-lightbulb-gray.webp"
      });
    }
    return effects.reduce((acc, {id, icon}) => {
      if (!id) return acc;
      acc.push({value: id, label: id, icon});
      return acc;
    }, []).sort((a, b) => a.value.localeCompare(b.value));
  }

  static get targetEffects() {
    return this.effects;
  }

  static get statusEffects() {
    return this.effects;
  }

  static get auraBlockers() {
    return this.effects;
  }

  // all base creature types
  static get creatureTypes() {
    const types = Object.entries(CONFIG.DND5E.creatureTypes);
    return types.map(([value, label]) => {
      return {value, label: game.i18n.localize(label)};
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  static get actorCreatureTypes(){
    return this.creatureTypes;
  }

  // Preparation modes.
  static get preparationModes() {
    const modes = Object.entries(CONFIG.DND5E.spellPreparationModes);
    return modes.map(([value, label]) => ({value, label}));
  }

  // Skill ids.
  static get skillIds() {
    const ids = Object.entries(CONFIG.DND5E.skills);
    return ids.map(([value, {label}]) => ({value, label}));
  }
}
