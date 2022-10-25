import { _replaceRollData } from "./helpers.mjs";
import { auraTargets, MODULE } from "./constants.mjs";
import { getAllTokenGridSpaces } from "./helpers.mjs";

/**
 * Get the item that created a template.
 * If found, get any 'template' auras on the item and merge the data.
 */
export function _preCreateMeasuredTemplate(templateDoc, templateData, context, userId) {
  const origin = foundry.utils.getProperty(templateData, "flags.dnd5e.origin");
  if (!origin) return;
  const item = fromUuidSync(origin);
  if (!item) return;

  const bonuses = game.modules.get(MODULE).api.getBonuses(item);
  const valids = bonuses.filter(([type, id, values]) => {
    return values.enabled && values.aura?.isTemplate;
  });
  const bonusData = valids.reduce((acc, [type, id, vals]) => {
    foundry.utils.setProperty(acc, `flags.${MODULE}.bonuses.${type}.${id}`, vals);
    return acc;
  }, {});
  const actor = item.parent;
  if (actor) {
    const tokenDoc = actor.token ?? actor.getActiveTokens(false, true)[0];
    const path = `flags.${MODULE}.defaultDisposition`;
    if (tokenDoc) foundry.utils.setProperty(bonusData, path, tokenDoc.disposition);
    else foundry.utils.setProperty(bonusData, path, actor.prototypeToken.disposition);
  }
  templateDoc.updateSource(bonusData);
}

/**
 * Get ids of all templates you are standing on.
 */
export function _getAllContainingTemplates(token) {
  const size = token.document.parent.grid.size;
  const centers = getAllTokenGridSpaces(token).map(({ x, y }) => {
    return { x: x + size / 2, y: y + size / 2 };
  });

  return token.document.parent.templates.filter(template => {
    return centers.some(({ x, y }) => {
      return template.object.shape.contains(x - template.x, y - template.y);
    });
  }).map(t => t.id);
}

/**
 * Get all valid template auras that should apply.
 * This filters by disposition and hooktype.
 * Returns an array of bonuses in form [id, values].
 */
export function _getAllValidTemplateAuras(tokenDoc, hookType) {
  const templateIds = _getAllContainingTemplates(tokenDoc.object);
  const templates = templateIds.map(id => tokenDoc.parent.templates.get(id));
  const bonuses = [];
  const me = tokenDoc.disposition;
  for (const template of templates) {
    if (template.hidden) continue;
    const tBoni = [];
    const { actor, token } = _mapTemplateToDocuments(template);
    const you = _mapTemplateToDisposition(template, token);
    const flag = template.getFlag(MODULE, `bonuses.${hookType}`);
    const templateBonuses = flag ? Object.entries(flag) : [];
    for (const [id, vals] of templateBonuses) {
      const bonus = vals.aura.disposition;
      const isIn = _filterTemplateBonusByDisposition(me, you, bonus);
      if (isIn) tBoni.push([id, vals]);
    }
    const replacedData = _replaceRollData(actor, tBoni);
    bonuses.push(...replacedData);
  }
  return bonuses;
}

/**
 * Returns the disposition of the token of the actor
 * who created the template. Defaulting to creator's
 * prototype token's disposition, stored in the template.
 */
function _mapTemplateToDisposition(templateDoc, token) {
  const defaultDisp = templateDoc.getFlag(MODULE, "defaultDisposition");
  const disp = token?.document.disposition ?? defaultDisp;
  return disp ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
}

/**
 * Returns the item, actor, and token using the templateDoc origin.
 */
function _mapTemplateToDocuments(templateDoc) {
  const origin = templateDoc.getFlag("dnd5e", "origin");
  if (!origin) return {};
  const item = fromUuidSync(origin) ?? null;
  const actor = item?.parent ?? null;
  const token = actor?.token?.object ?? actor?.getActiveTokens()[0] ?? null;
  return { item, actor, token };
}

/**
 * Returns whether a bonus should apply, given you disposition,
 * the creator's disposition, and the disposition of the bonus.
 */
function _filterTemplateBonusByDisposition(me, you, bonus) {
  // if aura applies to any target.
  if (bonus === auraTargets.ANY) return true;

  // if aura applies to allies only.
  if (bonus === auraTargets.ALLY) return me === you;

  // if aura applies to enemies only.
  const { HOSTILE, FRIENDLY } = CONST.TOKEN_DISPOSITIONS;
  if (bonus === auraTargets.ENEMY) {
    return (me === HOSTILE && you === FRIENDLY) || (me === FRIENDLY && you === HOSTILE);
  }
}
