import { MODULE } from "./constants.mjs";
import { getTokenFromActor } from "./helpers.mjs";

export function _createAPI() {
  game.modules.get(MODULE).api = {
    getBonusIds,
    findBonus,
    deleteBonus,
    copyBonus,
    toggleBonus,
    findEmbeddedDocumentsWithBonuses,
    changeBonusId,
    moveBonus,
    findTokensInRangeOfAura
  }
}

/**
 * Returns the ids of all bonuses on the document.
 */
function getBonusIds(object) {
  const ids = [];
  const has = object.getFlag(MODULE, "bonuses") ?? {};
  for (const key in has) ids.push(...Object.keys(has[key]));
  return ids;
}

/**
 * Returns the bonus with the given id.
 * Returned in the form of [targetType, [id, values]].
 */
function findBonus(object, id) {
  const flag = object.getFlag(MODULE, "bonuses");
  for (const type in flag) {
    const flagType = flag[type];
    for (const identifier in flagType) {
      if (id === identifier) {
        const value = flagType[identifier];
        return [type, identifier, value];
      }
    }
  }
  return null;
}

/**
 * Delete the bonus with the given id from the document.
 */
async function deleteBonus(object, id) {
  const target = findBonus(object, id);
  if (!target) return null;
  const [type, identifier] = target;
  const key = `bonuses.${type}.${identifier}`;
  const r = await object.unsetFlag(MODULE, key);
  _rerenderApp(object);
  return r;
}

/**
 * Copy the bonus from one document to another.
 * Returns null if the bonus is not found on the original,
 * or if the other already has a bonus by that id.
 */
async function copyBonus(original, other, id) {
  const o = findBonus(original, id);
  const t = findBonus(other, id);
  if (!o || !!t) return null;
  const [targetType, identifier, value] = o;
  const key = `bonuses.${targetType}.${identifier}`;
  const r = await other.setFlag(MODULE, key, value);
  _rerenderApp(other);
  return r;
}

/**
 * Moves a bonus from one document to another.
 * Returns null if the bonus is not found on the original,
 * or if the other already has a bonus by that id.
 */
async function moveBonus(original, other, id) {
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
async function toggleBonus(object, id, state) {
  const bonus = findBonus(object, id);
  if (!bonus) return null;
  const [type, identifier, { enabled }] = bonus;
  const key = `bonuses.${type}.${identifier}.enabled`;
  if (state) return object.setFlag(MODULE, key, !!state);
  const r = await object.setFlag(MODULE, key, !enabled);
  _rerenderApp(object);
  return r;
}

/**
 * Return an object of arrays of items and effects
 * on the actor that have a bonus embedded in them.
 */
function findEmbeddedDocumentsWithBonuses(actor) {
  const items = actor.items.filter(item => {
    return getBonusIds(item).length > 0;
  });
  const effects = actor.effects.filter(effect => {
    return getBonusIds(effect).length > 0;
  });
  return { effects, items };
}

/**
 * Change the identifier of a bonus on the document.
 * Returns null if the document already has a bonus with the new id.
 */
async function changeBonusId(object, oldId, newId) {
  const bonus = findBonus(object, oldId);
  const dupeId = findBonus(object, newId);
  if (!bonus || !!dupeId) return null;
  const [type, _, value] = foundry.utils.duplicate(bonus);
  await object.unsetFlag(MODULE, `bonuses.${type}.${oldId}`);
  const r = await object.setFlag(MODULE, `bonuses.${type}.${newId}`, value);
  _rerenderApp(object);
  return r;
}

/**
 * Returns all token documents that are in range of an aura.
 * Returns null if the bonus is not an aura, or if
 * the bonus is not on an actor with an active token.
 */
function findTokensInRangeOfAura(object, id) {
  const bonus = findBonus(object, id);
  if (!bonus) return null;
  const [type, identifier, { aura }] = bonus;
  if (!aura) return null;
  const tokenDoc = getTokenFromActor(object.parent ?? object);
  if (!tokenDoc) return null;
  if (aura.range === -1) {
    return canvas.scene.tokens.filter(t => t !== tokenDoc);
  }
  return canvas.scene.tokens.filter(t => {
    if (t === tokenDoc) return false;
    const distance = canvas.grid.measureDistance(t, tokenDoc, {
      gridSpaces: true
    });
    return aura.range >= distance;
  });
}

function _rerenderApp(object) {
  const apps = Object.values(ui.windows);
  const id = `${MODULE}-build-a-bonus-${object.id}`;
  const app = apps.find(a => a.id === id);
  return app?.render();
}
