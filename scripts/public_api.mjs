import { MODULE, TYPES } from "./constants.mjs";
import { _splitTokensByDisposition } from "./helpers/auraHelpers.mjs";
import {
  _getMinimumDistanceBetweenTokens,
  _getTokenFromActor,
  _getAppId,
  _createBabonus,
  _openWorkshop,
  _getAllTokenGridSpaces
} from "./helpers/helpers.mjs";
import { _getAllContainingTemplates } from "./helpers/templateHelpers.mjs";
import { migration } from "./migration.mjs";

export function _createAPI() {
  game.modules.get(MODULE).api = {
    getId, getIds,
    getName, getNames,
    getType,

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
    migration: migration,

    // deprecated.
    getBonusIds,
    findBonus,
    getBonuses,
    changeBonusId,
  }
}

/**
 * Returns the bonus with the given name.
 * If multiple are found, returns the first one.
 * Returned in the form of [id, values].
 */
function getName(object, name) {
  if (!name) return null;
  const flag = object.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).filter(([id, values]) => {
    return foundry.data.validators.isValidId(id);
  }).find(([id, values]) => values.name === name);
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
function getId(object, id) {
  if (!id) return null;
  const flag = object.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).filter(([_id, values]) => {
    return foundry.data.validators.isValidId(_id);
  }).find(([_id]) => id === _id);
}

/* Deprecated */
function findBonus(object, id) {
  ui.notifications.warn("You are using 'findBonus' which has been deprecated in favor of 'getId'.");
  return getId(object, id);
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

/* Deprecated */
function getBonusIds(object) {
  ui.notifications.warn("You are using 'getBonusIds' which has been deprecated in favor of 'getIds'.");
  return getIds(object);
}

/* Deprecated */
function getBonuses() {
  ui.notifications.warn("You are using 'getBonuses' which has been deprecated in favor of 'getType'.");
  return null;
}

/**
 * Returns the bonuses of a given type.
 * Returned in the form of [id, values].
 */
export function getType(object, type) {
  if (!TYPES.map(t => t.value).includes(type)) {
    console.error(`'${type}' is not a valid Build-a-Bonus type!`);
    return null;
  }
  const flag = object.getFlag(MODULE, "bonuses") ?? {};
  return Object.entries(flag).filter(([id, values]) => {
    const validId = foundry.data.validators.isValidId(id);
    const validtype = values?.type === type;
    return validId && validtype;
  });
}

/**
 * Returns the ids of all templates on the scene that contain the TokenDocument.
 */
function getAllContainingTemplates(tokenDoc) {
  return _getAllContainingTemplates(tokenDoc.object);
}

/**
 * Delete the bonus with the given id from the document.
 * Returns null if the bonus is not found.
 */
async function deleteBonus(object, id) {
  if (!_validId(id)) return null;
  const [_id] = getId(object, id) ?? [];
  if (!_id) return null;
  await object.update({ [`flags.babonus.bonuses.-=${_id}`]: null });
  _rerenderApp(object);
  return r;
}

/**
 * Copy the bonus from one document to another.
 * Returns null if the bonus is not found on the original.
 */
async function copyBonus(original, other, id) {
  if (!_validId(id)) return null;
  const target = getId(original, id);
  if (!target) return null;

  const values = createBabonus(target[1]).toObject();
  const key = `bonuses.${values.id}`;
  const r = await other.setFlag(MODULE, key, values);
  _rerenderApp(other);
  return r;
}

/**
 * Moves a bonus from one document to another.
 * Returns null if the bonus is not found on the original,
 * or if the other already has a bonus by that id.
 */
async function moveBonus(original, other, id) {
  if (!_validId(id)) return null;
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
  if (!_validId(id)) return null;
  const bonus = getId(object, id);
  if (!bonus) return null;
  const key = `bonuses.${bonus[0]}.enabled`;
  let r;
  if (state === null) r = await object.setFlag(MODULE, key, !bonus[1].enabled);
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
      return getIds(item).length > 0;
    });
  }
  if (object instanceof Actor || object instanceof Item) {
    effects = object.effects.filter(effect => {
      return getIds(effect).length > 0;
    });
  }
  return { effects, items };
}

/**
 * Change the identifier of a bonus on the document.
 * Returns null if the document already has a bonus with the new id.
 */
function changeBonusId() {
  ui.notifications.warn("You are using 'changeBonusId' which has been deprecated in favor of absolutely nothing. Don't change ids.");
  return null;
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
  const tokenDoc = _getTokenFromActor(object.parent ?? object);
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
 */
function createBabonus(data) {
  return _createBabonus(data);
}

/**
 * Returns an object of three arrays; the tokens on the scene
 * split into three arrays by disposition.
 */
function sceneTokensByDisposition(scene) {
  const s = scene ?? canvas.scene;
  if (!s) return null;
  return _splitTokensByDisposition(s.tokens);
}

/**
 * Returns an array of occupied grid spaces by a token document.
 */
function getOccupiedGridSpaces(tokenDoc) {
  return _getAllTokenGridSpaces(tokenDoc);
}

function _rerenderApp(object) {
  const apps = Object.values(ui.windows);
  const id = _getAppId(object);
  const app = apps.find(a => a.id === id);
  return app?.render();
}

function _validId(id) {
  const validId = foundry.data.validators.isValidId(id);
  if (!validId) {
    console.error("The id provided is not valid.");
    return false;
  }
  return true;
}
