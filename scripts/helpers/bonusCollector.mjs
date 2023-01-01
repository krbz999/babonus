import { auraTargets, MODULE } from "../constants.mjs";
import { _getMinimumDistanceBetweenTokens, _getType } from "./helpers.mjs";
import { _getAllContainingTemplateDocuments } from "./templateHelpers.mjs";

/**
 * Retrieve all valid bonuses for a roll.
 *
 * object: the actor or item making a roll.
 * type: the type of bonus to retrieve.
 */
export function _collectBonuses(object, type) {
  const baboni = [];
  const actor = object.actor ?? object;
  const itemId = object instanceof Item ? object.id : null;
  baboni.push(..._filterOwnBonuses(actor, type, itemId));

  const rollingToken = actor.token ?? actor.getActiveTokens(false, true)[0];
  if (rollingToken) {
    const tokens = canvas.scene.tokens.filter(t => t !== rollingToken);
    const disp = rollingToken.disposition;
    for (const token of tokens) {
      const range = _getMinimumDistanceBetweenTokens(rollingToken.object, token.object);
      baboni.push(..._filterTokenBonuses(token, type, range, disp));
    }
    const templates = _getAllContainingTemplateDocuments(rollingToken);
    for (const template of templates) {
      baboni.push(..._filterTemplateBonuses(rollingToken, template, type));
    }
  }
  return baboni;
}

/**
 * SELF
 *
 * actor: the rolling actor.
 * type: the type of bonus.
 * itemId: the id of the item being rolled, if any.
 */
function _filterOwnBonuses(actor, type, itemId = null) {
  return [
    ..._getOwnActorBonuses(actor, type),
    ..._getOwnItemBonuses(actor, type, itemId),
    ..._getOwnEffectBonuses(actor, type)
  ].filter(bab => {
    const isBlockedAura = bab.hasAura && (bab.isAuraBlocked || !bab.aura.self);
    return bab.enabled && !isBlockedAura && !bab.isSuppressed && !bab.isTemplateAura;
  });
}

function _getOwnActorBonuses(actor, type) {
  const babs = _getType(actor, type);
  // do not replace roll data here.
  return babs;
}

function _getOwnItemBonuses(actor, type, itemId) {
  const boni = [];
  for (const item of actor.items) {
    const babs = _getType(item, type).filter(bab => {
      // immediately ignore any item-only babs on other items.
      return !(bab.isItemOnly && item.id !== itemId);
    });
    if (!babs.length) continue;
    if (item.id !== itemId) _replaceRollData(babs, item.getRollData());
    boni.push(...babs);
  }
  return boni;
}

function _getOwnEffectBonuses(actor, type) {
  return _getTokenEffectBonuses(actor, type);
}

/**
 * OTHER TOKENS
 *
 * token: the tokenDoc to yoink bonuses off.
 * type: the type of roll being performed.
 * range: the minimum distance to the token.
 * targetDisp: the disposition of the rolling token
 */
function _filterTokenBonuses(token, type, range, targetDisp) {
  if (token.hidden) return [];
  return [
    ..._getTokenBonuses(token.actor, type),
    ..._getTokenItemBonuses(token.actor, type),
    ..._getTokenEffectBonuses(token.actor, type)
  ].filter(bab => {
    return (bab.enabled && bab.hasAura && !bab.isAuraBlocked && !bab.isSuppressed)
      && _matchTokenDisposition(token, targetDisp, bab.aura.disposition) && (bab.aura.range >= range || bab.aura.range === -1);
  });
}

function _getTokenBonuses(actor, type) {
  const babs = _getType(actor, type);
  _replaceRollData(babs, actor.getRollData());
  return babs;
}

function _getTokenItemBonuses(actor, type) {
  const boni = [];
  for (const item of actor.items) {
    const babs = _getType(item, type);
    if (!babs.length) continue;
    _replaceRollData(babs, item.getRollData());
    boni.push(...babs);
  }
  return boni;
}

function _getTokenEffectBonuses(actor, type) {
  const boni = [];
  const data = actor.getRollData();
  for (const effect of actor.effects) {
    const babs = _getType(effect, type);
    if (!babs.length) continue;
    _replaceRollData(babs, data);
    boni.push(...babs);
  }
  return boni;
}

/**
 * TEMPLATES
 *
 * token: the token of the actor doing the rolling.
 * template: the templateDoc to yoink bonuses off.
 * type: the babonus type.
 */
function _filterTemplateBonuses(token, template, type) {
  if (template.hidden) return [];
  return [
    ..._getTemplateBonuses(template, type)
  ].filter(bab => {
    const isOwn = token.actor === bab.actor;
    if (isOwn) return bab.aura.self;
    return _matchTemplateDisposition(template, token.disposition, bab);
  });
}

function _getTemplateBonuses(template, type) {
  const babs = _getType(template, type);
  for (const bab of babs) {
    const doc = bab.item ?? bab.actor;
    const data = doc?.getRollData() ?? {};
    console.log("Before:", bab.bonuses.bonus);
    console.log({ doc, data, bab });
    _replaceRollData([bab], data);
  }
  return babs;
}

/**
 * Helper Functions
 */

// take an array of baboni and replace all their roll data.
function _replaceRollData(baboni, data) {
  for (const bab of baboni) {
    const update = Object.entries(bab.bonuses).reduce((acc, [key, val]) => {
      acc[key] = new Roll(val, data).formula;
      return acc;
    }, {});
    try { bab.updateSource({ bonuses: update }) } catch (err) {}
  }
}

// take a tokenDoc with an aura, the disposition of the token doing the roll,
// the targeting type of the aura, and return whether it should apply.
function _matchTokenDisposition(source, targetDisp, auraDisp) {
  const A = source.disposition;
  if (auraDisp === auraTargets.ALLY) {
    return A === targetDisp;
  } else if (auraDisp === auraTargets.ENEMY) {
    const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    const H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    return ((A === F) && (targetDisp === H)) || ((A === H) && (targetDisp === F));
  } else return auraDisp === auraTargets.ANY;
}

// take a templateDoc with an aura, the disposition of the token doing the roll,
// the bab for the targeting type of the aura, and return whether it should apply.
function _matchTemplateDisposition(template, targetDisp, bab) {
  const A = template.getFlag(MODULE, "defaultDisposition"); // fallback
  const srcActor = bab.actor;
  const srcToken = srcActor?.token ?? srcActor?.getActiveTokens(false, true)[0] ?? null;
  const srcDisp = srcToken?.disposition ?? A;
  if (bab.aura.disposition === auraTargets.ALLY) {
    return srcDisp === targetDisp;
  } else if (bab.aura.disposition === auraTargets.ENEMY) {
    const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    const H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    return ((srcDisp === F) && (targetDisp === H)) || ((srcDisp === H) && (targetDisp === F));
  } else return bab.aura.disposition === auraTargets.ANY;
}
