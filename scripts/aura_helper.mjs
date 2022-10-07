import { auraTargets, MODULE } from "./constants.mjs";
import { getActorEffectBonuses, getActorItemBonuses } from "./helpers.mjs";

/**
 * Gets the auras that applies to a token using their disposition,
 * This only returns auras that are within range.
 * @param {TokenDocument5e} tokenDoc  The token document.
 * @param {String} hookType           The hook type being called.
 * @returns {Array} The array of bonuses.
 */
export function getAurasThatApplyToMe(tokenDoc, hookType) {
  const { HOSTILE, FRIENDLY, NEUTRAL } = CONST.TOKEN_DISPOSITIONS;
  const me = tokenDoc.disposition;
  const they = tokenDoc.parent.tokens.filter(t => t !== tokenDoc);

  const { hostiles, friendlies, neutrals } = _splitTokensByDisposition(they);

  let auras = [];
  if (me === HOSTILE) {
    // get auras from hostile tokens that target allies.
    auras = auras.concat(getAurasByDisposition(tokenDoc, hostiles, auraTargets.FRIENDLY, hookType));
    // get auras from friendly tokens that target enemies.
    auras = auras.concat(getAurasByDisposition(tokenDoc, friendlies, auraTargets.HOSTILE, hookType));
  } else if (me === FRIENDLY) {
    // get auras from hostile tokens that target enemies.
    auras = auras.concat(getAurasByDisposition(tokenDoc, hostiles, auraTargets.HOSTILE, hookType));
    // get auras from friendly tokens that target allies.
    auras = auras.concat(getAurasByDisposition(tokenDoc, friendlies, auraTargets.FRIENDLY, hookType));
  } else if (me === NEUTRAL) {
    // get auras from neutral tokens that target allies.
    auras = auras.concat(getAurasByDisposition(tokenDoc, neutrals, auraTargets.FRIENDLY, hookType));
  }

  // lastly get auras from ALL tokens that target all.
  auras = auras.concat(getAurasByDisposition(tokenDoc, they, auraTargets.ALL, hookType));
  return auras;
}

/**
 * Split the scene's tokens into three arrays using their disposition.
 * @param {Array} sceneTokens All tokens on the scene that are not the single token.
 * @returns {Object<Array>}   An object of the three arrays.
 */
function _splitTokensByDisposition(sceneTokens) {
  const { HOSTILE, FRIENDLY, NEUTRAL } = CONST.TOKEN_DISPOSITIONS;

  const hostiles = [];
  const friendlies = [];
  const neutrals = [];

  for (const tokenDoc of sceneTokens) {
    if (tokenDoc.disposition === HOSTILE) hostiles.push(tokenDoc);
    else if (tokenDoc.disposition === FRIENDLY) friendlies.push(tokenDoc);
    else neutrals.push(tokenDoc);
  }
  return { hostiles, friendlies, neutrals };
}

/**
 * From each token document in the array, get the actor's auras
 * if the aura has the given target type and is within range.
 * @param {TokenDocument5e} tokenDoc  The target of the auras.
 * @param {Array} tokenDocs     An array of token documents.
 * @param {Number} disposition  The target type.
 * @param {String} hookType     The type of hook that is called.
 * @returns {Array}             The array of auras that apply.
 */
function getAurasByDisposition(tokenDoc, tokenDocs, disposition, hookType){
  const auras = tokenDocs.reduce((acc, doc) => {
    if(!doc.actor) return acc;
    // TODO: pre-evaluate these using the source's roll data.
    const a = _getActorAurasByDisposition(doc, disposition, hookType);
    const i = _getItemAurasByDisposition(doc, disposition, hookType);
    const e = _getEffectAurasByDisposition(doc, disposition, hookType);
    const docAuras = [].concat(a, i, e);
    
    // filter by range.
    const f = _filterAurasByRange(tokenDoc, doc, docAuras);
    acc = acc.concat(f);
    return acc;
  }, []);

  return auras;
}

/**
 * Get all auras from a token document's actor, given that the aura
 * has the given target type.
 * @param {TokenDocument5e} tokenDoc      The token document with the actor.
 * @param {Number}          disposition   The target type.
 * @param {String}          hookType      The type of hook called.
 * @returns {Array} The array of bonuses.
 */
function _getActorAurasByDisposition(tokenDoc, disposition, hookType){
  // get all ACTOR BONUSES
  const flag = tokenDoc.actor.getFlag(MODULE, `bonuses.${hookType}`);
  let bonuses = flag ? Object.entries(flag) : []; // TODO: replace formula data... duplicate?
  // then filter if the bonus is an aura and if the target is in the Set
  bonuses = bonuses.filter(([id, vals]) => {
    if (!vals.aura?.enabled) return false;
    return disposition === vals.aura?.disposition;
  });
  return bonuses;
}

/**
 * Get all auras from a token document's actor's items, given that the aura
 * has the given target type.
 * @param {TokenDocument5e} tokenDoc      The token document with the actor.
 * @param {Number}          disposition   The target type.
 * @param {String}          hookType      The type of hook called.
 * @returns {Array} The array of bonuses.
 */
 function _getItemAurasByDisposition(tokenDoc, disposition, hookType){
  // get all ACTOR ITEM BONUSES
  let bonuses = getActorItemBonuses(tokenDoc.actor, hookType); // TODO: replace formula data inside that function
  // then filter if the bonus is an aura and if the target is in the Set
  bonuses = bonuses.filter(([id, vals]) => {
    if(!vals.aura?.enabled) return false;
    return disposition === vals.aura?.disposition;
  });
  return bonuses;
}

/**
 * Get all auras from a token document's actor's effects, given that the aura
 * has the given target type.
 * @param {TokenDocument5e} tokenDoc      The token document with the actor.
 * @param {Number}          disposition   The target type.
 * @param {String}          hookType      The type of hook called.
 * @returns {Array} The array of bonuses.
 */
 function _getEffectAurasByDisposition(tokenDoc, disposition, hookType){
  // get all ACTOR EFFECT BONUSES
  let bonuses = getActorEffectBonuses(tokenDoc.actor, hookType); // TODO: replace formula data inside that function
  // then filter if the bonus is an aura and if the target is in the Set
  bonuses = bonuses.filter(([id, vals]) => {
    if(!vals.aura?.enabled) return false;
    return disposition === vals.aura?.disposition;
  });
  return bonuses;
}

/**
 * Given token documents and an array of auras, find all those
 * that have a big enough range. This can be Infinity.
 * @param {TokenDocument5e} me    The target of the auras.
 * @param {TokenDocument5e} you   The source of the auras.
 * @param {Array}           auras The array of auras.
 * @returns {Array} The filtered array of auras.
 */
function _filterAurasByRange(me, you, auras){
  const distance = _measureDistance(me, you);
  const filtered = auras.filter(([id, {aura}]) => {
    if ( aura.range === Infinity ) return true;
    return aura.range >= distance;
  });
  return filtered;
}

/**
 * Measure distance between two token documents.
 * @returns {Number}  An integer.
 */
function _measureDistance(me, you){
  const options = { gridSpaces: true };
  return canvas.grid.measureDistance(me.object, you.object, options);
}
