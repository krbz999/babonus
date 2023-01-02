import { BabonusWorkshop } from "../applications/babonus.mjs";
import { ArbitraryComparisonField, SemicolonArrayField } from "../applications/dataFields.mjs";
import {
  AttackBabonus,
  DamageBabonus,
  HitDieBabonus,
  SaveBabonus,
  ThrowBabonus
} from "../applications/dataModel.mjs";
import {
  MODULE,
  MODULE_NAME,
  TYPES
} from "../constants.mjs";
import { getId } from "../public_api.mjs";

// current bonuses on the document, for HTML purposes only.
export function _getBonuses(doc) {
  const flag = doc.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).map(([id, data]) => {
    try {
      return _createBabonus(data, id, { parent: doc });
    } catch (err) {
      console.error(err);
      return null;
    }
  }).filter(b => {
    // explicitly true for valid ids.
    return !!b && foundry.data.validators.isValidId(b.id);
  }).sort((a, b) => {
    return a.name?.localeCompare(b.name);
  });
}

export class KeyGetter {

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

  // all weapon properties.
  static get weaponProperties() {
    const prop = Object.entries(CONFIG.DND5E.weaponProperties);
    return prop.map(([value, label]) => ({ value, label }));
  }

  // all status effects.
  static get statusEffects() {
    const effects = CONFIG.statusEffects;
    return effects.reduce((acc, { id, icon }) => {
      if (!id) return acc;
      acc.push({ value: id, label: id, icon })
      return acc;
    }, []).sort((a, b) => {
      return a.value.localeCompare(b.value);
    });
  }

  // target status effects.
  static get targetEffects() {
    return this.statusEffects;
  }

  // aura blockers.
  static get blockers() {
    return this.statusEffects;
  }

  // all base creature types
  static get creatureTypes() {
    const creatureTypes = CONFIG.DND5E.creatureTypes;
    return Object.entries(creatureTypes).map(([key, local]) => {
      return { value: key, label: game.i18n.localize(local) };
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }
}

/**
 * Gets the minimum distance between two tokens,
 * evaluating all grid spaces they occupy.
 */
export function _getMinimumDistanceBetweenTokens(tokenA, tokenB) {
  const A = _getAllTokenGridSpaces(tokenA.document);
  const B = _getAllTokenGridSpaces(tokenB.document);
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
 * Get the upper left corners of all grid spaces a token document occupies.
 */
export function _getAllTokenGridSpaces(tokenDoc) {
  const { width, height, x, y } = tokenDoc;
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

// Turn a babonus into something that can easily be 'pasted' into the ui.
export function _babonusToString(babonus) {
  let flattened = foundry.utils.flattenObject(babonus);
  for (const key of Object.keys(flattened)) {
    const path = "schema.fields." + key.split(".").join(".fields.")
    const field = foundry.utils.getProperty(babonus, path);
    if (field instanceof SemicolonArrayField) flattened[key] = flattened[key]?.join(";");
    else if (field instanceof ArbitraryComparisonField && flattened[key]) {
      const a = Object.assign({}, flattened[key]);
      flattened[key] = foundry.utils.flattenObject(a);
      flattened = foundry.utils.flattenObject(flattened);
    }
  }
  return flattened;
}

// same app id everywhere for lookup reasons.
export function _getAppId(object) {
  return `${MODULE}-${object.id}`;
}

// create a Babonus with the given id (or a new one if none is provided).
export function _createBabonus(data, id, options = {}) {
  const types = TYPES.map(t => t.value);
  if (!types.includes(data.type)) {
    throw new Error("INVALID BABONUS TYPE.");
  }

  // if no id explicitly provided, make a new one.
  data.id = id ?? foundry.utils.randomID();

  const BAB = new {
    attack: AttackBabonus,
    damage: DamageBabonus,
    save: SaveBabonus,
    throw: ThrowBabonus,
    hitdie: HitDieBabonus
  }[data.type](data, options);
  return BAB;
}

export function _openWorkshop(object) {
  return new BabonusWorkshop(object, {
    title: `${MODULE_NAME}: ${object.name ?? object.label}`
  }).render(true);
}

// Returns an array of the bonuses of a given type on the object.
export function _getType(object, type) {
  return _getCollection(object).filter(b => b.type === type);
}

// Returns a collection of bonuses on the object.
export function _getCollection(object) {
  const bonuses = Object.entries(object.getFlag(MODULE, "bonuses") ?? {});
  const contents = bonuses.reduce((acc, [id, data]) => {
    if (!foundry.data.validators.isValidId(id)) return acc;
    try {
      const bab = _createBabonus(data, id, { parent: object });
      acc.push([id, bab]);
      return acc;
    } catch (err) {
      console.warn(err);
      return acc;
    }
  }, []);
  return new foundry.utils.Collection(contents);
}

export async function _babFromDropData(data, parent) {
  if (data.data) return _createBabonus(data.data, null, { parent });
  else if (data.uuid) {
    const pre = await fromUuid(data.uuid);
    const prevParent = pre instanceof TokenDocument ? pre.actor : pre;
    const babonusData = getId(prevParent, data.babId).toObject();
    delete babonusData.id;
    return _createBabonus(babonusData, null, { parent });
  }
  return null;
}
