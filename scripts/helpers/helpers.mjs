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
  attackTypes,
  itemsValidForAttackDamageSave,
  MODULE,
  TYPES
} from "../constants.mjs";
import { getType } from "../public_api.mjs";
import { _isAuraAvailable } from "./auraHelpers.mjs";

// current bonuses on the document, for HTML purposes only.
export function _getBonuses(doc) {
  const flag = doc.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).map(b => {
    return {
      id: b[0],
      description: b[1].description,
      name: b[1].name,
      type: b[1].type,
      enabled: b[1].enabled
    };
  }).sort((a, b) => {
    return a.name?.localeCompare(b.name);
  }).filter(b => {
    // explicitly true for valid ids.
    return _verifyID(b.id) === true;
  });
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
 * Get all bonuses that apply to self.
 * This is all bonuses that either do not have 'aura' property,
 * or do have it and are set to affect self and not template,
 * and are not blocked by an 'aura.blockers'.
 */
export function _getBonusesApplyingToSelf(actor, hookType) {
  const bonuses = _getAllActorBonuses(actor, hookType);
  return bonuses.filter(([id, val]) => {
    if (!val.aura?.enabled) return true;
    if (val.aura.isTemplate) return false;
    if (!_isAuraAvailable(actor, val.aura)) return false;
    return val.aura.self;
  });
}

/**
 * Get all the bonuses on the actor, their items, and their effects.
 * This method does NOT filter by aura properties.
 * That is done in '_getBonusesApplyingToSelf'.
 * This method replaces roll data.
 */
function _getAllActorBonuses(actor, hookType) {
  const flag = getType(actor, hookType); // [id,values]
  const bonuses = _replaceRollData(actor, flag);
  bonuses.push(..._getActorEffectBonuses(actor, hookType));
  bonuses.push(..._getActorItemBonuses(actor, hookType));
  return bonuses;
}

/**
 * Add bonuses from items. Any item-only filtering happens here, such as checking
 * if the item is currently, and requires being, equipped and/or attuned.
 * Not all valid item types have these properties, such as feature type items.
 * This method replaces roll data.
 */
export function _getActorItemBonuses(actor, hookType) {
  const { ATTUNED } = CONFIG.DND5E.attunementTypes;
  const boni = [];
  if (!actor) return [];

  for (const item of actor.items) {
    const flag = getType(item, hookType);
    if (!flag) continue;

    const { equipped, attunement } = item.system;
    const bonuses = flag.filter(([id, vals]) => {
      if (!vals.enabled) return false;
      if (!vals.filters?.itemRequirements) return true;
      const { equipped: needsEq, attuned: needsAtt } = vals.filters?.itemRequirements;
      if (!equipped && needsEq) return false;
      if (attunement !== ATTUNED && needsAtt) return false;
      return true;
    });
    boni.push(..._replaceRollData(item, bonuses));
  }
  return boni;
}

/**
 * Add bonuses from effects. Any effect-only filtering happens here,
 * such as checking whether the effect is disabled or unavailable.
 * Replaces roll data.
 */
export function _getActorEffectBonuses(actor, hookType) {
  const boni = [];
  if (!actor) return [];
  for (const effect of actor.effects) {
    if (effect.disabled || effect.isSuppressed) continue;
    const flag = getType(effect, hookType);
    if (!flag) continue;
    const bonuses = flag.filter(([id, vals]) => {
      return vals.enabled;
    });
    boni.push(..._replaceRollData(actor, bonuses));
  }
  return boni;
}

/**
 * Gets the token document from an actor document.
 */
export function _getTokenFromActor(actor) {
  const token = actor.token?.object ?? actor.getActiveTokens()[0];
  if (!token) return false;
  return token.document;
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

/**
 * Utility function to replace roll data.
 */
export function _replaceRollData(object, bonuses) {
  const data = object?.getRollData() ?? {};
  const boni = foundry.utils.duplicate(bonuses);
  return boni.map(bonus => {
    const vals = bonus[1].bonuses;
    for (const key of Object.keys(vals)) {
      vals[key] = Roll.replaceFormulaData(vals[key], data);
    }
    return bonus;
  });
}

// returns true if id is valid, otherwise a new id.
export function _verifyID(id) {
  const valid = foundry.data.validators.isValidId(id);
  if (valid) return true;
  else return foundry.utils.randomID();
}

// Turn a babonus into something that can easily be 'pasted' into the ui.
export function _babonusToString(babonus) {
  let flattened = foundry.utils.flattenObject(babonus);
  for (let key of Object.keys(flattened)) {
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
    title: `Build-a-Bonus: ${object.name ?? object.label}`
  }).render(true);
}
