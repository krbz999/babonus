import { auraTargets, MODULE } from "./constants.mjs";
import { getActorEffectBonuses, getActorItemBonuses, getMinimumDistanceBetweenTokens } from "./helpers.mjs";

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
  const they = tokenDoc.parent.tokens.filter(t => {
    if (t === tokenDoc) return false;
    if (t.hidden) return false;
    return true;
  });

  const { hostiles, friendlies, neutrals } = _splitTokensByDisposition(they);

  let auras = [];
  const { HOSTILE: h, FRIENDLY: f, ALL: a } = auraTargets;
  if (me === HOSTILE) {
    auras = auras.concat(getAurasByDisposition(tokenDoc, hostiles, f, hookType));
    auras = auras.concat(getAurasByDisposition(tokenDoc, friendlies, h, hookType));
  } else if (me === FRIENDLY) {
    auras = auras.concat(getAurasByDisposition(tokenDoc, hostiles, h, hookType));
    auras = auras.concat(getAurasByDisposition(tokenDoc, friendlies, f, hookType));
  } else if (me === NEUTRAL) {
    auras = auras.concat(getAurasByDisposition(tokenDoc, neutrals, f, hookType));
  }
  auras = auras.concat(getAurasByDisposition(tokenDoc, they, a, hookType));
  return auras;
}

/**
 * Split the scene's tokens into three arrays using their disposition.
 * @param {Array} sceneTokens All tokens on the scene that are not the single token.
 * @returns {Object<Array>}   An object of the three arrays.
 */
function _splitTokensByDisposition(sceneTokens) {
  const { HOSTILE, FRIENDLY } = CONST.TOKEN_DISPOSITIONS;

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
 * @param {Array} tokenDocs           An array of token documents.
 * @param {Number} disposition        The target type.
 * @param {String} hookType           The type of hook that is called.
 * @returns {Array}                   The array of auras that apply.
 */
function getAurasByDisposition(tokenDoc, tokenDocs, disposition, hookType) {
  const auras = tokenDocs.reduce((acc, doc) => {
    if (!doc.actor) return acc;
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
 * Utility function to filter auras.
 * Returns true if the aura is enabled, if its disposition matches,
 * and if the owner does not have any of the blockers that prevent the aura.
 * @param {Actor5e} actor The actor document that is the source of the auras.
 * @param {Number} disp   The disposition to match for.
 * @param {Object} aura   The aura object from the bonus in the flag.
 * @returns {Boolean}     Whether the filter matches.
 */
function _auraFilterUtility(actor, disp, aura = {}) {
  // aura is enabled
  const e = aura.enabled;
  if (!e) return false;

  // target is correct.
  const d = disp === aura.disposition;
  if (!d) return false;

  // get blockers
  const blockers = aura.blockers ?? [];
  if (!blockers.length) return true;

  // get active effects on the actor.
  const efIds = actor.effects.filter(effect => {
    return effect.modifiesActor;
  }).map(effect => {
    return effect.getFlag("core", "statusId");
  }).filter(id => !!id);

  // get whether you have any of the blockers.
  const blocked = blockers.some(s => efIds.includes(s));
  if (blocked) return false;

  return true;
}

/**
 * Get all auras from a token document's actor, given that the aura
 * has the given target type.
 * @param {TokenDocument5e} tokenDoc    The token document with the actor.
 * @param {Number}          disposition The target type.
 * @param {String}          hookType    The type of hook called.
 * @returns {Array}                     The array of bonuses.
 */
function _getActorAurasByDisposition(tokenDoc, disposition, hookType) {
  // get all ACTOR BONUSES
  const actor = tokenDoc.actor;
  const flag = actor.getFlag(MODULE, `bonuses.${hookType}`);
  let bonuses = flag ? Object.entries(flag) : [];
  // then filter if the bonus is an aura and if the disp matches.
  bonuses = bonuses.filter(([id, { aura, filters }]) => {
    return _auraFilterUtility(actor, disposition, aura, filters);
  });

  // replace formula data with this actor's data.
  const data = actor.getRollData();
  bonuses = foundry.utils.duplicate(bonuses).map(b => {
    const vals = b[1].values;
    for (const key in vals) {
      vals[key] = Roll.replaceFormulaData(vals[key], data);
    }
    return b;
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
function _getItemAurasByDisposition(tokenDoc, disposition, hookType) {
  // get all ACTOR ITEM BONUSES
  let bonuses = getActorItemBonuses(tokenDoc.actor, hookType);
  // then filter if the bonus is an aura and if the disp matches.
  bonuses = bonuses.filter(([id, vals]) => {
    return _auraFilterUtility(tokenDoc.actor, disposition, vals.aura, vals.filters);
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
function _getEffectAurasByDisposition(tokenDoc, disposition, hookType) {
  // get all ACTOR EFFECT BONUSES
  let bonuses = getActorEffectBonuses(tokenDoc.actor, hookType);
  // then filter if the bonus is an aura and if the disp matches.
  bonuses = bonuses.filter(([id, vals]) => {
    return _auraFilterUtility(tokenDoc.actor, disposition, vals.aura, vals.filters);
  });
  return bonuses;
}

/**
 * Given token documents and an array of auras, find all those
 * that have a big enough range. This can be Infinity (-1).
 * @param {TokenDocument5e} me    The target of the auras.
 * @param {TokenDocument5e} you   The source of the auras.
 * @param {Array}           auras The array of auras.
 * @returns {Array} The filtered array of auras.
 */
function _filterAurasByRange(me, you, auras) {
  const distance = _measureDistance(me, you);
  const filtered = auras.filter(([id, { aura }]) => {
    if (aura.range === -1) return true;
    return aura.range >= distance;
  });
  return filtered;
}

/**
 * Measure distance between two token documents.
 * @returns {Number}  An integer.
 */
function _measureDistance(me, you) {
  return getMinimumDistanceBetweenTokens(me.object, you.object);
}
