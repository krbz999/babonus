import { MODULE } from "./constants.mjs";
import { FILTER } from "./filters.mjs";
import {
  _getMinimumDistanceBetweenTokens,
  _getAppId,
  _createBabonus,
  _openWorkshop,
  _getAllTokenGridSpaces,
  _getType,
  _getCollection,
  _babFromUuid
} from "./helpers/helpers.mjs";
import { _getAllContainingTemplateDocuments } from "./helpers/templateHelpers.mjs";
import { migration } from "./migration.mjs";

export function _createAPI() {
  const API = {
    getId, getIds,
    getName, getNames,
    getType,
    getCollection,
    fromUuid,

    deleteBonus, copyBonus,
    toggleBonus, moveBonus,
    createBabonus,

    findEmbeddedDocumentsWithBonuses,
    findTokensInRangeOfAura,
    openBabonusWorkshop,
    getAllContainingTemplates,
    getMinimumDistanceBetweenTokens,
    sceneTokensByDisposition,
    getOccupiedGridSpaces,
    getApplicableBonuses,
    migration: migration
  };
  game.modules.get(MODULE).api = API;
  window.babonus = API;
}

/**
 * Returns all bonuses that applies to a specific roll.
 * @param {Actor5e|Item5e} object       The actor (for hitdie and throw) or item (for attack, damage, save).
 * @param {String} type                 The type of rolling (attack, damage, save, throw, hitdie).
 * @param {Object} options              Additional context for the inner methods.
 * @param {String} options.throwType    The type of saving throw (key of an ability, 'death' or 'concentration').
 * @param {Boolean} options.isConcSave  Whether the saving throw is for maintaining concentration.
 */
function getApplicableBonuses(object, type, { throwType = "int", isConcSave = false } = {}) {
  if (type === "hitdie") return FILTER.hitDieCheck(object);
  else if (type === "throw") return FILTER.throwCheck(object, throwType, { throwType, isConcSave });
  else if (["attack", "damage", "save"].includes(type)) return FILTER.itemCheck(object, type);
  else return null;
}

/**
 * Returns the bonus with the given name.
 * If multiple are found, returns the first one.
 * Returned in the form of [id, values].
 */
function getName(object, name) {
  return _getCollection(object).getName(name);
}

/**
 * Returns the names of all bonuses on the document.
 */
function getNames(object) {
  const flag = object.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).filter(([id, values]) => {
    return foundry.data.validators.isValidId(id);
  }).map(([id, values]) => values.name);
}

/**
 * Returns the bonus with the given id.
 * Returned in the form of [id, values].
 */
export function getId(object, id) {
  if (!id) return null;
  if (!foundry.data.validators.isValidId(id)) return null;
  return _getCollection(object).get(id);
}

/**
 * Returns the ids of all bonuses on the document.
 */
function getIds(object) {
  const flag = object.getFlag(MODULE, "bonuses") ?? {};
  return Object.keys(flag).filter(id => {
    return foundry.data.validators.isValidId(id);
  });
}

/**
 * Returns an array of the bonuses of a given type.
 */
function getType(object, type) {
  return _getType(object, type);
}

/**
 * Returns the ids of all templates on the scene that contain the TokenDocument.
 */
function getAllContainingTemplates(tokenDoc) {
  return _getAllContainingTemplateDocuments(tokenDoc).map(t => t.id);
}

/**
 * Delete the bonus with the given id from the document.
 * Returns null if the bonus is not found.
 */
async function deleteBonus(object, id) {
  const bonus = getId(object, id);
  if (!bonus) return null;
  await object.update({ [`flags.babonus.bonuses.-=${bonus.id}`]: null });
  _rerenderApp(object);
  return r;
}

/**
 * Copy the bonus from one document to another.
 * Returns null if the bonus is not found on the original.
 */
async function copyBonus(original, other, id) {
  const data = getId(original, id)?.toObject();
  if (!data) return null;

  const rand = foundry.utils.randomID();
  data.id = rand;
  const key = `bonuses.${rand}`;
  const r = await other.setFlag(MODULE, key, data);
  _rerenderApp(other);
  return r;
}

/**
 * Moves a bonus from one document to another.
 * Returns null if the bonus is not found on the original,
 * or if the other already has a bonus by that id.
 */
async function moveBonus(original, other, id) {
  const copy = await copyBonus(original, other, id);
  if (!copy) return null;
  const r = await deleteBonus(original, id);
  _rerenderApp(original);
  return r;
}

/**
 * Toggle the bonus with the given id on the document.
 * Returns null if the bonus was not found.
 */
async function toggleBonus(object, id, state = null) {
  const bonus = getId(object, id);
  if (!bonus) return null;
  const key = `bonuses.${bonus.id}.enabled`;
  let r;
  if (state === null) r = await object.setFlag(MODULE, key, !bonus.enabled);
  else r = await object.setFlag(MODULE, key, !!state);
  _rerenderApp(object);
  return r;
}

/**
 * Return an object of arrays of items and effects
 * on the given document that have a bonus embedded in them.
 */
function findEmbeddedDocumentsWithBonuses(object) {
  let items = [];
  let effects = [];

  if (object instanceof Actor) {
    items = object.items.filter(item => {
      return _getCollection(item).size > 0;
    });
  }
  if (object instanceof Actor || object instanceof Item) {
    effects = object.effects.filter(effect => {
      return _getCollection(effect).size > 0;
    });
  }
  return { effects, items };
}

/**
 * Returns all token documents that are in range of an aura.
 * Returns null if the bonus is not an aura, or if
 * the bonus is not on an actor with an active token.
 */
function findTokensInRangeOfAura(object, id) {
  const bonus = getId(object, id);
  if (!bonus) return null;
  const [_id, { aura }] = bonus;
  if (!aura) return null;
  if (aura.isTemplate) return null;
  const actor = object.actor ?? object;
  const tokenDoc = actor?.token ?? actor?.getActiveTokens(false, true)[0];
  if (!tokenDoc) return null;
  if (aura.range === -1) {
    return canvas.scene.tokens.filter(t => t !== tokenDoc);
  }
  return canvas.scene.tokens.filter(t => {
    if (t === tokenDoc) return false;
    const distance = _getMinimumDistanceBetweenTokens(t.object, tokenDoc.object);
    return aura.range >= distance;
  });
}

/**
 * Gets the minimum distance between two token placeables,
 * evaluating all grid spaces they occupy.
 */
function getMinimumDistanceBetweenTokens(tokenA, tokenB) {
  return _getMinimumDistanceBetweenTokens(tokenA, tokenB);
}

/**
 * Renders the Build-a-Bonus workship for the document.
 */
function openBabonusWorkshop(object) {
  const validDocumentType = (
    (object instanceof Actor)
    || (object instanceof Item)
    || (object instanceof ActiveEffect && !(object.parent.parent instanceof Actor))
  );
  if (!validDocumentType) {
    console.warn("The document provided is not a valid document type for Build-a-Bonus!");
    return null;
  }
  return _openWorkshop(object);
}

/**
 * Create a babonus given a babonusData object.
 * This does not save the babonus on the actor.
 */
function createBabonus(data, parent = null) {
  return _createBabonus(data, undefined, { parent });
}

/**
 * Split the scene's tokens into three arrays using their disposition.
 * @param {Array} sceneTokens All tokens on the scene that are not the single token.
 * @returns {Object<Array>}   An object of the three arrays.
 */
function sceneTokensByDisposition(scene) {
  const { HOSTILE, FRIENDLY, NEUTRAL } = CONST.TOKEN_DISPOSITIONS;
  return scene.tokens.reduce((acc, tokenDoc) => {
    const d = tokenDoc.disposition;
    if (d === HOSTILE) acc.hostiles.push(tokenDoc);
    else if (d === FRIENDLY) acc.friendlies.push(tokenDoc);
    else if (d === NEUTRAL) acc.neutrals.push(tokenDoc);
    return acc;
  }, { hostiles: [], friendlies: [], neutrals: [] });
}

/**
 * Returns an array of occupied grid spaces by a token document.
 */
function getOccupiedGridSpaces(tokenDoc) {
  return _getAllTokenGridSpaces(tokenDoc);
}

/**
 * Returns a babonus from its uuid.
 */
async function fromUuid(uuid) {
  return _babFromUuid(uuid);
}

/**
 * Returns the collection of bonuses on the document.
 */
function getCollection(object) {
  return _getCollection(object);
}

function _rerenderApp(object) {
  const apps = Object.values(ui.windows);
  const id = _getAppId(object);
  const app = apps.find(a => a.id === id);
  return app?.render();
}
