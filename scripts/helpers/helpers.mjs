/**
 * A collection of getters for Keys dialogs when creating or editing a babonus.
 */
export class KeyGetter {

  // base weapon types.
  static get baseWeapons() {
    const entries = Object.entries(CONFIG.DND5E.weaponIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const {name} = game.packs.get(packKey).index.find(({_id}) => _id === id) ?? {};
      return {value, label: name};
    });
  }

  // Base tool types.
  static get baseTools() {
    const entries = Object.entries(CONFIG.DND5E.toolIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const {name} = game.packs.get(packKey).index.find(({_id}) => _id === id) ?? {};
      return {value, label: name};
    });
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
  static get abilities() { // TODO: fix in 2.2.x.
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, label]) => ({value, label}));
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
      })
    }
    return abl;
  }

  // spell component types.
  static get spellComponents() {
    const comps = Object.entries(CONFIG.DND5E.spellComponents);
    const tags = Object.entries(CONFIG.DND5E.spellTags);
    return [...comps, ...tags].map(([value, {label}]) => {
      return {value, label};
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
