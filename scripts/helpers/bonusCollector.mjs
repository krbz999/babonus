import {AURA_TARGETS, MODULE} from "../constants.mjs";
import {_getMinimumDistanceBetweenTokens, _getType} from "./helpers.mjs";
import {_getAllContainingTemplateDocuments} from "./templateHelpers.mjs";

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
    // Special consideration for templates; allow overlapping without stacking the same bonus.
    const templateBabs = [];
    for (const template of templates) {
      templateBabs.push(..._filterTemplateBonuses(rollingToken, template, type));
    }
    baboni.push(...new foundry.utils.Collection(templateBabs.map(b => [`${b.item.uuid}.Babonus.${b.id}`, b])));
  }
  return new foundry.utils.Collection(baboni.map(b => [b.uuid, b]));
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
      return !(bab.isExclusive && item.id !== itemId);
    });
    if (!babs.length) continue;
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
  if (token.hidden || !token.actor) return [];
  return [
    ..._getTokenBonuses(token.actor, type),
    ..._getTokenItemBonuses(token.actor, type),
    ..._getTokenEffectBonuses(token.actor, type)
  ].filter(bab => {
    const a = bab.aura;
    return (bab.enabled && bab.hasAura && !bab.isAuraBlocked && !bab.isSuppressed)
      && _matchTokenDisposition(token, targetDisp, a.disposition)
      && (a.range >= range || a.range === -1);
  });
}

function _getTokenBonuses(actor, type) {
  const babs = _getType(actor, type);
  return babs;
}

function _getTokenItemBonuses(actor, type) {
  const boni = [];
  for (const item of actor.items) {
    const babs = _getType(item, type);
    if (!babs.length) continue;
    boni.push(...babs);
  }
  return boni;
}

function _getTokenEffectBonuses(actor, type) {
  const boni = [];
  for (const effect of actor.effects) {
    if (!effect.modifiesActor) continue;
    const babs = _getType(effect, type);
    if (!babs.length) continue;
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
    if (bab.isAuraBlocked) return false;
    const isOwn = token.actor === bab.actor;
    if (isOwn) return bab.aura.self;
    return _matchTemplateDisposition(template, token.disposition, bab);
  });
}

function _getTemplateBonuses(template, type) {
  const babs = _getType(template, type);
  return babs;
}

/**
 * Helper Functions
 */

// take a tokenDoc with an aura, the disposition of the token doing the roll,
// the targeting type of the aura, and return whether it should apply.
function _matchTokenDisposition(source, targetDisp, auraDisp) {
  const A = source.disposition;
  if (auraDisp === AURA_TARGETS.ALLY) {
    return A === targetDisp;
  } else if (auraDisp === AURA_TARGETS.ENEMY) {
    const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    const H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    return ((A === F) && (targetDisp === H)) || ((A === H) && (targetDisp === F));
  } else return auraDisp === AURA_TARGETS.ANY;
}

// take a templateDoc with an aura, the disposition of the token doing the roll,
// the bab for the targeting type of the aura, and return whether it should apply.
function _matchTemplateDisposition(template, targetDisp, bab) {
  const A = template.getFlag(MODULE, "defaultDisposition"); // fallback
  const srcActor = bab.actor;
  const srcToken = srcActor?.token ?? srcActor?.getActiveTokens(false, true)[0] ?? null;
  const srcDisp = srcToken?.disposition ?? A;
  if (bab.aura.disposition === AURA_TARGETS.ALLY) {
    return srcDisp === targetDisp;
  } else if (bab.aura.disposition === AURA_TARGETS.ENEMY) {
    const F = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    const H = CONST.TOKEN_DISPOSITIONS.HOSTILE;
    return ((srcDisp === F) && (targetDisp === H)) || ((srcDisp === H) && (targetDisp === F));
  } else return bab.aura.disposition === AURA_TARGETS.ANY;
}
