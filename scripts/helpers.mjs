import { attackTypes, itemsValidForAttackDamageSave, MODULE, targetTypes } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

// Really, really, really slugify a string.
// it may only contain a-z, 0-9, and -.
export function superSlugify(id) {
  const regex = new RegExp(/[^a-z- ]+/gmi);
  let idf = id.replaceAll(regex, "").slugify();
  if (idf.length < 2) return "";
  if (!new RegExp(/[a-z]/).test(idf)) return "";
  return idf;
}

// the types of bonuses ('attack', 'damage', 'save', etc)
export function getTargets() {
  return targetTypes.map(value => {
    const upper = value.toUpperCase();
    const string = `BABONUS.VALUES.TARGET.${upper}`;
    const label = game.i18n.localize(string);
    return { value, label };
  });
}

// current bonuses on the document
export function getBonuses(doc) {
  const flag = doc.getFlag(MODULE, "bonuses");
  if (!flag) return [];

  const bonuses = targetTypes.reduce((acc, type) => {
    if (!flag[type]) return acc;
    const e = Object.entries(flag[type]);
    const map = e.map(([id, val]) => {
      return {
        identifier: id,
        description: val.description,
        label: val.label,
        type,
        enabled: val.enabled
      };
    });
    acc = acc.concat(map);
    return acc;
  }, []).sort((a, b) => {
    return a.label.localeCompare(b.label);
  });
  return bonuses;
}

export class KeyGetter {

  // valid item types; those that can have actions associated.
  static get itemTypes() {
    return itemsValidForAttackDamageSave.map(value => {
      const upper = value.titleCase();
      const string = `DND5E.ItemType${upper}`;
      const label = game.i18n.localize(string);
      return { value, label };
    });
  }

  // base weapon types.
  static get baseWeapons() {
    const entries = Object.entries(CONFIG.DND5E.weaponIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const { index } = game.packs.get(packKey);
      const { name: label } = index.find(({ _id }) => {
        return _id === id;
      }) ?? {};
      return { value, label };
    });
  }

  // the types of damage, as well as healing and temp.
  static get damageTypes() {
    const { damageTypes: d, healingTypes: h } = CONFIG.DND5E;
    const entries = Object.entries(d).concat(Object.entries(h));
    return entries.map(([value, label]) => ({ value, label }));
  }

  // the spell schools available.
  static get spellSchools() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([value, label]) => ({ value, label }));
  }

  // ability score keys.
  static get abilities() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, label]) => ({ value, label }));
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
        label: game.i18n.localize("CN.CONCENTRATION")
      })
    }
    return abl;
  }

  // spell component types.
  static get spellComponents() {
    const { spellComponents: s, spellTags: t } = CONFIG.DND5E;
    const entries = Object.entries(s).concat(Object.entries(t));
    return entries.map(([value, { label }]) => {
      return { value, label };
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }

  // spell levels.
  static get spellLevels() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({ value, label }));
  }

  // attack types.
  static get attackTypes() {
    const { itemActionTypes } = CONFIG.DND5E;
    const actions = attackTypes;
    return actions.map(value => {
      const label = itemActionTypes[value];
      return { value, label };
    });
  }

  // all weapon properties.
  static get weaponProperties() {
    const prop = Object.entries(CONFIG.DND5E.weaponProperties);
    return prop.map(([value, label]) => ({ value, label }));
  }

  // all status effects.
  static get statusEffects() {
    const effects = CONFIG.statusEffects;
    const ids = effects.reduce((acc, { id }) => {
      if (id) acc.push(id);
      return acc;
    }, []).map((id) => {
      return { value: id, label: id };
    }).sort((a, b) => {
      return a.value.localeCompare(b.value);
    });
    return ids;
  }
  static get targetEffects() {
    return this.statusEffects;
  }

  // aura blockers.
  static get blockers() {
    return this.statusEffects;
  }
}

/**
 * Get all the bonuses on the actor, their items, and their effects.
 * This method does NOT filter by aura properties.
 * That is done in 'getAllOwnBonuses'.
 * This method replaces roll data.
 */
export function getAllActorBonuses(actor, hookType) {
  const flag = actor.getFlag(MODULE, `bonuses.${hookType}`);
  let bonuses = flag ? Object.entries(flag) : [];
  bonuses = bonuses.concat(getActorEffectBonuses(actor, hookType));

  // replace formula data with actor roll data for actor/effect bonuses.
  const data = actor.getRollData();
  bonuses = foundry.utils.duplicate(bonuses).map(b => {
    const vals = b[1].values;
    for (const key in vals) {
      vals[key] = Roll.replaceFormulaData(vals[key], data);
    }
    return b;
  });
  bonuses = bonuses.concat(getActorItemBonuses(actor, hookType));

  return bonuses;
}

/**
 * Get all bonuses that apply to self.
 * This is all bonuses that either do not have 'aura' property,
 * or do have it and are set to affect self.
 */
export function getAllOwnBonuses(actor, hookType) {
  const bonuses = getAllActorBonuses(actor, hookType);
  const filtered = bonuses.filter(([key, val]) => {
    if (!val.aura) return true;
    if (val.aura.self) return true;
    return false;
  });
  return filtered;
}

/**
 * Add bonuses from items. Any item-only filtering happens here, such as checking
 * if the item is currently, and requires being, equipped and/or attuned.
 * Not all valid item types have these properties, such as feature type items.
 * This method replaces roll data.
 */
export function getActorItemBonuses(actor, hookType) {
  const { ATTUNED } = CONFIG.DND5E.attunementTypes;
  let boni = [];

  for (const item of actor.items) {
    const flag = item.getFlag(MODULE, `bonuses.${hookType}`);
    if (!flag) continue;

    const itemBonuses = Object.entries(flag);
    const { equipped, attunement } = item.system;
    const validItemBonuses = itemBonuses.filter(([id, vals]) => {
      if (!vals.enabled) return false;
      if (!vals.itemRequirements) return true;
      const { equipped: needsEq, attuned: needsAtt } = vals.itemRequirements;
      if (!equipped && needsEq) return false;
      if (attunement !== ATTUNED && needsAtt) return false;
      return true;
    });

    // replace formula data.
    const data = item.getRollData();
    const bonuses = foundry.utils.duplicate(validItemBonuses).map(b => {
      const vals = b[1].values;
      for (const key in vals) {
        vals[key] = Roll.replaceFormulaData(vals[key], data);
      }
      return b;
    });
    boni = boni.concat(bonuses);
  }
  return boni;
}

/**
 * Add bonuses from effects. Any effect-only filtering happens here,
 * such as checking whether the effect is disabled or unavailable.
 */
export function getActorEffectBonuses(actor, hookType) {
  const boni = [];
  for (const effect of actor.effects) {
    if (effect.disabled || effect.isSuppressed) continue;
    const flag = effect.getFlag(MODULE, `bonuses.${hookType}`);
    if (!flag) continue;
    const effectBonuses = Object.entries(flag);
    const validEffectBonuses = effectBonuses.filter(([id, { enabled }]) => {
      return enabled;
    });
    boni.push(...validEffectBonuses);
  }
  return boni;
}

/**
 * Filters the collected array of bonuses using the function objects in filters.mjs.
 * Returns the reduced array.
 */
export function finalFilterBonuses(bonuses, object, type, details = {}) {
  const funcs = FILTER.filterFunctions[type];

  const valids = bonuses.reduce((acc, [id, atts]) => {
    if (!atts.enabled) return acc;
    if (atts.itemTypes) atts.filters["itemTypes"] = atts.itemTypes;
    if (atts.throwTypes) atts.filters["throwTypes"] = atts.throwTypes;

    for (const key in atts.filters) {
      const validity = funcs[key](object, atts.filters[key], details);
      if (!validity) return acc;
    }
    delete atts.filters["itemTypes"];
    delete atts.filters["throwTypes"];
    acc.push(atts.values);
    return acc;
  }, []);
  return valids;
}

/**
 * Gets the token document from an actor document.
 */
export function getTokenFromActor(actor) {
  const token = actor.token?.object ?? actor.getActiveTokens()[0];
  if (!token) return false;
  return token.document;
}

/**
 * Gets the minimum distance between two tokens,
 * evaluating all grid spaces they occupy.
 */
export function getMinimumDistanceBetweenTokens(tokenA, tokenB) {
  const A = getAllTokenGridSpaces(tokenA);
  const B = getAllTokenGridSpaces(tokenB);
  const rays = A.flatMap(a => {
    return B.map(b => {
      return { ray: new Ray(a, b) };
    });
  });
  const dist = canvas.scene.grid.distance; // 5ft.
  const distances = canvas.grid.measureDistances(rays, {
    gridSpaces: false
  }).map(d => Math.round(d / dist) * dist);
  const eles = [tokenA, tokenB].map(t => t.document.elevation);
  const elevationDiff = Math.abs(eles[0] - eles[1]);
  return Math.max(Math.min(...distances), elevationDiff);
}

/**
 * Get the upper left corners of all grid spaces a token occupies.
 */
function getAllTokenGridSpaces(token) {
  const { width, height, x, y } = token.document;
  if (width <= 1 && height <= 1) return [{ x, y }];
  const centers = [];
  const grid = canvas.grid.size;
  for (let a = 0; a < width; a++) {
    for (let b = 0; b < height; b++) {
      centers.push({
        x: x + a * grid,
        y: y + b * grid
      });
    }
  }
  return centers;
}
