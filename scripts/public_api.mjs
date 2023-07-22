import {BabonusWorkshop} from "./applications/babonus.mjs";
import {BonusCollector} from "./applications/bonusCollector.mjs";
import {babonusFields} from "./applications/dataFields.mjs";
import {BabonusTypes} from "./applications/dataModel.mjs";
import {MODULE} from "./constants.mjs";
import {FILTER} from "./filters.mjs";

export function _createAPI() {
  const API = {
    getId, getIds,
    getName, getNames,
    getType,
    getCollection,
    fromUuid: babonusFromUuid,

    deleteBonus, copyBonus,
    toggleBonus, moveBonus,
    createBabonus, embedBabonus,

    findEmbeddedDocumentsWithBonuses,
    findTokensInRangeOfAura,
    findTokensInRangeOfToken,
    openBabonusWorkshop,
    getAllContainingTemplates,
    getMinimumDistanceBetweenTokens,
    sceneTokensByDisposition,
    getOccupiedGridSpaces,
    getApplicableBonuses,

    abstract: {
      DataModels: BabonusTypes,
      DataFields: babonusFields,
      TYPES: Object.keys(BabonusTypes)
    }
  };
  game.modules.get(MODULE).api = API;
  window.babonus = API;
}

/**
 * Return all bonuses that applies to a specific roll.
 * @param {Document} object                         The actor (for hitdie and throw) or item (for attack, damage, save).
 * @param {string} type                             The type of rolling (attack, damage, test, save, throw, hitdie).
 * @param {object} [options={}]                     Additional context for the inner methods.
 * @param {string} [options.throwType="int"]        The type of saving throw (key of an ability, 'death' or 'concentration').
 * @param {boolean} [options.isConcSave=false]      Whether the saving throw is for maintaining concentration.
 * @param {string} [options.abilityId="int"]        The ability being used for an ability check.
 * @param {string} [options.skillId=undefined]      The id of the skill being used in a skill check.
 * @returns {Babonus[]}                             An array of valid babonuses.
 */
function getApplicableBonuses(object, type, {throwType = "int", isConcSave = false, abilityId = "int", skillId} = {}) {
  if (type === "hitdie") return FILTER.hitDieCheck(object);
  else if (type === "throw") return FILTER.throwCheck(object, throwType, {throwType, isConcSave});
  else if (type === "test") return FILTER.testCheck(object, abilityId, {skillId});
  else if (["attack", "damage", "save"].includes(type)) return FILTER.itemCheck(object, type);
}

/**
 * Return a babonus that has the given name. If more are found, returns the first found.
 * @param {Document} object     The document that has the babonus.
 * @param {string} name         The name of the babonus.
 * @returns {Babonus}           The found babonus.
 */
function getName(object, name) {
  return BabonusWorkshop._getCollection(object).getName(name);
}

/**
 * Return the names of all bonuses on the document.
 * @param {Document} object     The document that has the babonuses.
 * @returns {string[]}          An array of names.
 */
function getNames(object) {
  return [...new Set(BabonusWorkshop._getCollection(object).map(bonus => bonus.name))];
}

/**
 * Return a babonus that has the given id.
 * @param {Document} object     The document that has the babonus.
 * @param {string} id           The id of the babonus.
 * @returns {Babonus}           The found babonus.
 */
function getId(object, id) {
  return BabonusWorkshop._getCollection(object).get(id);
}

/**
 * Return the ids of all bonuses on the document.
 * @param {Document} object     The document that has the babonuses.
 * @returns {string[]}          An array of ids.
 */
function getIds(object) {
  return [...new Set(BabonusWorkshop._getCollection(object).map(bonus => bonus.id))];
}

/**
 * Return an array of the bonuses of a given type on the document.
 * @param {Document} object     The document that has the babonuses.
 * @param {string} type         The type of babonuses to find.
 * @returns {Babonus[]}         An array of babonuses.
 */
function getType(object, type) {
  return BabonusWorkshop._getCollection(object).filter(b => b.type === type);
}

/**
 * Return the ids of all templates on the scene if they contain the token document.
 * @param {TokenDocument} tokenDoc      The token document.
 * @returns {string[]}                  An array of ids.
 */
function getAllContainingTemplates(tokenDoc) {
  const size = tokenDoc.parent.grid.size;
  const centers = getOccupiedGridSpaces(tokenDoc).map(({x, y}) => {
    return {x: x + size / 2, y: y + size / 2};
  });

  return tokenDoc.parent.templates.filter(template => {
    return centers.some(({x, y}) => {
      return template.object.shape.contains(x - template.x, y - template.y);
    });
  }).map(t => t.id);
}

/**
 * Delete a babonus from a document.
 * @param {Document} object         A measured template, active effect, actor, or item to delete from.
 * @param {string} id               The id of the babonus to remove.
 * @returns {Promise<Document>}     The updated document.
 */
async function deleteBonus(object, id) {
  const bonus = getId(object, id);
  if (!bonus) return null;
  return object.update({[`flags.babonus.bonuses.-=${bonus.id}`]: null});
}

/**
 * Copy a babonus from a document to another.
 * @param {Document} original       A measured template, active effect, actor, or item to copy from.
 * @param {Document} other          A measured template, active effect, actor, or item to copy to.
 * @param {string} id               The id of the babonus to copy.
 * @returns {Promise<Document>}     The original after the update.
 */
async function copyBonus(original, other, id) {
  const data = getId(original, id).toObject();
  data.id = foundry.utils.randomID();
  return other.update({[`flags.babonus.bonuses.${data.id}`]: data});
}

/**
 * Move a babonus from a document to another.
 * @param {Document} original       A measured template, active effect, actor, or item to move from.
 * @param {Document} other          A measured template, active effect, actor, or item to move to.
 * @param {string} id               The id of the babonus to move.
 * @returns {Promise<Document>}     The other document after the update.
 */
async function moveBonus(original, other, id) {
  const copy = await copyBonus(original, other, id);
  if (!copy) return null;
  return deleteBonus(original, id);
}

/**
 * Toggle a babonus on a document
 * @param {Document} object           A measured template, active effect, actor, or item.
 * @param {string} id                 The id of the babonus to toggle.
 * @param {boolean} [state=null]      A specific toggle state to set a babonus to (true or false).
 * @returns {Promise<Document>}       The document after the update.
 */
async function toggleBonus(object, id, state = null) {
  const bonus = getId(object, id);
  if (!bonus) return null;
  const value = (state === null) ? !bonus.enabled : !!state;
  return object.update({[`flags.babonus.bonuses.${id}.enabled`]: value});
}

/**
 * Return an object of arrays of items and effects on the given document
 * that have one or more babonuses embedded in them.
 * @param {Document} object     An actor or item with embedded documents.
 * @returns {object}            An object with an array of effects and array of items.
 */
function findEmbeddedDocumentsWithBonuses(object) {
  let items = [];
  let effects = [];

  if (object instanceof Actor) {
    items = object.items.filter(item => {
      return BabonusWorkshop._getCollection(item).size > 0;
    });
  }
  if ((object instanceof Actor) || (object instanceof Item)) {
    effects = object.effects.filter(effect => {
      return BabonusWorkshop._getCollection(effect).size > 0;
    });
  }
  return {effects, items};
}

/**
 * Return all token documents that are in range of an aura.
 * @param {Document} object       The actor, item, or effect with the babonus.
 * @param {string} id             The id of the babonus.
 * @returns {TokenDocument[]}     An array of token documents.
 */
function findTokensInRangeOfAura(object, id) {
  const bonus = getId(object, id);
  if (!bonus.isTokenAura) return null;
  let actor;
  if (object instanceof Actor) actor = object;
  else if (object instanceof Item) actor = object.actor;
  else if (object instanceof ActiveEffect) actor = object.parent;
  const tokenDoc = actor.token ?? actor.getActiveTokens(false, true)[0];
  const range = dnd5e.utils.simplifyBonus(bonus.aura.range, bonus.getRollData({deterministic: true}));
  if (range === -1) return canvas.scene.tokens.filter(t => {
    if (!t.actor) return false;
    if (t.actor.type === "group") return false;
    return t !== tokenDoc;
  });
  return canvas.scene.tokens.filter(t => {
    if (!t.actor) return false;
    if (t.actor.type === "group") return false;
    if (t === tokenDoc) return false;
    const distance = getMinimumDistanceBetweenTokens(t.object, tokenDoc.object);
    return range >= distance;
  });
}

/**
 * Return an array of tokens that are within a radius of the source token.
 * Credit to @Freeze#2689 for much artistic aid.
 * @param {Token} source      The source token placeable.
 * @param {number} radius     The radius (usually feet) to extend from the source.
 * @returns {Token[]}         An array of token placeables, excluding the source.
 */
function findTokensInRangeOfToken(source, radius) {
  const tokenRadius = Math.abs(source.document.x - source.center.x);
  const pixels = radius * canvas.dimensions.distancePixels + tokenRadius;
  const captureArea = new PIXI.Circle(source.center.x, source.center.y, pixels);
  const grid = canvas.dimensions.size;
  return canvas.tokens.placeables.filter(t => {
    if (t === source) return false;

    const {width, height, x, y} = t.document;
    if (width <= 1 && height <= 1) return captureArea.contains(t.center.x, t.center.y);
    for (let a = 0; a < width; a++) {
      for (let b = 0; b < height; b++) {
        const test = captureArea.contains(...canvas.grid.getCenter(x + a * grid, y + b * grid));
        if (test) return true;
      }
    }
    return false;
  });
}

/**
 * Return the minimum distance between two tokens, evaluating height and all grid spaces they occupy.
 * @param {Token} tokenA        One token placeable.
 * @param {Token} tokenB        Another token placeable.
 * @param {object} options      Options to modify the measurements.
 * @returns {number}            The minimum distance (in feet).
 */
function getMinimumDistanceBetweenTokens(tokenA, tokenB, options = {}) {
  const spacesA = getOccupiedGridSpaces(tokenA.document);
  const spacesB = getOccupiedGridSpaces(tokenB.document);
  // Construct rays between each grid center of tokenA to each grid center of tokenB.
  const rays = spacesA.flatMap(a => spacesB.map(b => ({ray: new Ray(a, b)})));
  const horizontalDistance = Math.min(Infinity, ...canvas.grid.measureDistances(rays, options));
  const verticalDistance = Math.abs(tokenA.document.elevation - tokenB.document.elevation);
  return Math.max(horizontalDistance, verticalDistance);
}

/**
 * Render the build-a-bonus application for a document.
 * @param {Document} object       An actor, item, or effect.
 * @returns {BabonusWorkshop}     The rendered workshop.
 */
function openBabonusWorkshop(object) {
  const validDocumentType = ["Actor", "Item", "ActiveEffect"].includes(object.documentName);
  if (!validDocumentType) {
    console.warn("The document provided is not a valid document type for Build-a-Bonus!");
    return null;
  }
  return new BabonusWorkshop(object).render(true);
}

/**
 * Create a babonus in memory with the given data.
 * @param {object} data                 An object of babonus data.
 * @param {Document} [parent=null]      The document to act as parent of the babonus.
 * @returns {Babonus}                   The created babonus.
 */
function createBabonus(data, parent = null) {
  if (!(data.type in BabonusTypes)) throw new Error("INVALID BABONUS TYPE.");
  return BabonusWorkshop._createBabonus(data, undefined, {parent});
}

/**
 * Return the scene's token documents in four arrays split by disposition.
 * @param {Scene} scene     A scene that contains tokens.
 * @returns {object}        An object of the four arrays.
 */
function sceneTokensByDisposition(scene) {
  return scene.tokens.reduce((acc, tokenDoc) => {
    const d = tokenDoc.disposition;
    const t = CONST.TOKEN_DISPOSITIONS;
    if (d === t.HOSTILE) acc.hostiles.push(tokenDoc);
    else if (d === t.FRIENDLY) acc.friendlies.push(tokenDoc);
    else if (d === t.NEUTRAL) acc.neutrals.push(tokenDoc);
    else if (d === t.SECRET) acc.secret.push(tokenDoc);
    return acc;
  }, {hostiles: [], friendlies: [], neutrals: [], secret: []});
}

/**
 * Get the centers of all grid spaces that overlap with a token document.
 * @param {TokenDocument} tokenDoc      The token document on the scene.
 * @returns {object[]}                  An array of xy coordinates.
 */
function getOccupiedGridSpaces(tokenDoc) {
  return BonusCollector._collectTokenCenters(tokenDoc);
}

/**
 * Return a babonus using its uuid.
 * @param {string} uuid             The babonus uuid.
 * @returns {Promise<Babonus>}      The found babonus.
 */
async function babonusFromUuid(uuid) {
  try {
    const parts = uuid.split(".");
    const id = parts.pop();
    parts.pop();
    const parentUuid = parts.join(".");
    const parent = await fromUuid(parentUuid);
    return getId(parent, id) ?? null;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

/**
 * Return the collection of bonuses on the document.
 * @param {Document} object           An actor, item, effect, or template.
 * @returns {Collection<Babonus>}     A collection of babonuses.
 */
function getCollection(object) {
  return BabonusWorkshop._getCollection(object);
}

/**
 * Embed a created babonus onto the target object.
 * @param {Document} object         The actor, item, or effect that should have the babonus.
 * @param {Babonus} bonus           The created babonus.
 * @returns {Promise<Document>}     The actor, item, or effect that has received the babonus.
 */
async function embedBabonus(object, bonus) {
  const validDocumentType = ["Actor", "Item", "ActiveEffect"].includes(object.documentName);
  if (!validDocumentType) {
    console.warn("The document provided is not a valid document type for Build-a-Bonus!");
    return null;
  }
  if (!Object.values(BabonusTypes).some(t => bonus instanceof t)) return null;
  return BabonusWorkshop._embedBabonus(object, bonus);
}
