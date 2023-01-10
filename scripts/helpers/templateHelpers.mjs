import { MODULE } from "../constants.mjs";
import { _getAllTokenGridSpaces, _getCollection } from "./helpers.mjs";

/**
 * Get the item that created a template.
 * If found, get any 'template' auras on the item and merge the data.
 */
export function _preCreateMeasuredTemplate(templateDoc, templateData) {
  const origin = foundry.utils.getProperty(templateData, "flags.dnd5e.origin");
  if (!origin) return;
  const item = fromUuidSync(origin);
  if (!item) return;

  const bonusData = _getCollection(item).reduce((acc, bab) => {
    if(!bab.isTemplateAura || bab.isSuppressed) return acc;
    const data = bab.toObject();
    const path = `flags.${MODULE}.bonuses.${bab.id}`;
    foundry.utils.setProperty(acc, path, data);
    return acc;
  }, {});
  const actor = item.actor;
  if (actor) {
    const tokenDoc = actor.token ?? actor.getActiveTokens(false, true)[0];
    const path = `flags.${MODULE}.defaultDisposition`;
    if (tokenDoc) foundry.utils.setProperty(bonusData, path, tokenDoc.disposition);
    else foundry.utils.setProperty(bonusData, path, actor.prototypeToken.disposition);
  }
  templateDoc.updateSource(bonusData);
}

/**
 * Get template documents if the token is standing in them.
 */
export function _getAllContainingTemplateDocuments(tokenDoc) {
  const size = tokenDoc.parent.grid.size;
  const centers = _getAllTokenGridSpaces(tokenDoc).map(({ x, y }) => {
    return { x: x + size / 2, y: y + size / 2 };
  });

  return tokenDoc.parent.templates.filter(template => {
    return centers.some(({ x, y }) => {
      return template.object.shape?.contains(x - template.x, y - template.y);
    });
  });
}
