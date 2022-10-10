import { MODULE } from "./constants.mjs";

export function _createAPI() {
  game.modules.get(MODULE).api = {
    getBonusIds,
    findBonus,
    deleteBonus,
    copyBonus
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
function deleteBonus(object, id) {
  const target = findBonus(object, id);
  if (!target) return null;
  const [type, identifier] = target;
  const key = `bonuses.${type}.${identifier}`;
  return object.unsetFlag(MODULE, key);
}

/**
 * Copy the bonus from one document to another.
 */
function copyBonus(original, other, id) {
  const o = findBonus(original, id);
  const t = findBonus(other, id);
  if (!o || !!t) return null;
  const [targetType, identifier, value] = o;
  const key = `bonuses.${targetType}.${identifier}`;
  return other.setFlag(MODULE, key, value);
}
