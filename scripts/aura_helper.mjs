import { auraTargets, MODULE, SETTING_AURABLOCKERS } from "./constants.mjs";
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
 * and if the owner is not dead/unconscious (as per the setting).
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
  const setting = game.settings.get(MODULE, SETTING_AURABLOCKERS);
  const blockers = setting.split(";").map(c => c.trim());

  // get active effects on the actor.
  const efIds = actor.effects.filter(effect => {
    return effect.modifiesActor;
  }).map(effect => effect.getFlag("core", "statusId")).filter(id => !!id);

  // get whether you have any of the blockers.
  return !blockers.some(s => efIds.includes(s));
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
  const flag = tokenDoc.actor.getFlag(MODULE, `bonuses.${hookType}`);
  let bonuses = flag ? Object.entries(flag) : [];
  // then filter if the bonus is an aura and if the disp matches.
  bonuses = bonuses.filter(([id, vals]) => {
    return _auraFilterUtility(tokenDoc.actor, disposition, vals.aura, vals.filters);
  });

  // replace formula data with this actor's data.
  const data = tokenDoc.actor.getRollData();
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
  const options = { gridSpaces: true };
  return canvas.grid.measureDistance(me.object, you.object, options);
}
