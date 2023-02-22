import {MODULE} from "../constants.mjs";
import {_getAllTokenGridSpaces, _getCollection} from "./helpers.mjs";

/**
 * Get the item that created a template.
 * If found, get any 'template' auras on the item and merge the data.
 */
export function _preCreateMeasuredTemplate(templateDoc) {
  const origin = templateDoc.flags?.dnd5e?.origin;
  if (!origin) return;
  const item = fromUuidSync(origin);
  if (!item) return;
  const actor = item.actor;
  if(!actor) return;
  const tokenDocument = actor.token ?? actor.getActiveTokens(false, true)[0];
  const disp = tokenDocument?.disposition ?? actor.prototypeToken.disposition;

  const bonusData = _getCollection(item).reduce((acc, bab) => {
    if (bab.isTemplateAura) {
      acc[`flags.${MODULE}.bonuses.${bab.id}`] = bab.toObject();
    }
    return acc;
  }, {});
  if(foundry.utils.isEmpty(bonusData)) return;
  bonusData["flags.babonus.templateDisposition"] = disp;
  templateDoc.updateSource(bonusData);
}

/**
 * Get template documents if the token is standing in them.
 */
export function _getAllContainingTemplateDocuments(tokenDoc) {
  const size = tokenDoc.parent.grid.size;
  const centers = _getAllTokenGridSpaces(tokenDoc).map(({x, y}) => {
    return {x: x + size / 2, y: y + size / 2};
  });

  return tokenDoc.parent.templates.filter(template => {
    return centers.some(({x, y}) => {
      return template.object.shape?.contains(x - template.x, y - template.y);
    });
  });
}
