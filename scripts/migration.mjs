// move itemTypes from required to filter.
// move throwTypes from required to filter.
// move itemRequirements from required to filter.
// convert arbitraryComparison into an array of [{one,operator,other}].
// convert 'identifier' to 'id' and create new ids (16 characters, regular foundry ids).
// convert 'label' to 'name'.
// convert 'bonuses.<type>.<identifier>.{...values}' to 'bonuses.<id>.{...values}'.
// convert 'values' to 'bonuses'.
// add 'type' in data.
// store the fact that migration has happened... somewhere. In a setting?

import { MODULE, TYPES } from "./constants.mjs";
import { _createBabonus } from "./public_api.mjs";

/**
 * TARGETS OF MIGRATION:
 * - world items
 * - world items' effects
 *
 * - compendium items
 * - compendium items' effects
 *
 * - world actors
 * - world actors' effects
 * - world actor's items
 * - world actor's items' effects
 *
 * - scenes' templates
 * - scenes' token actors
 * - scenes' token actors' effects
 * - scenes' token actors' items
 * - scenes' token actors' items' effects
 *
 * - compendium actors
 * - compendium actors' effects
 * - compendium actors' items
 * - compendium actors' items' effects
 */


async function migrateWorld() {
  await _migrateWorldItems();
  await _migrateWorldActors();

  await _migrateCompendiumItems();
  await _migrateCompendiumActors();
  await _migrateScenes();
}

async function _migrateWorldItems() {
  for (const object of game.items) await _migrateDocumentDirect(object);
  return true;
}

async function _migrateWorldActors() {
  for (const object of game.actors) await _migrateDocumentDirect(object);
  return true;
}

/**
 * Migrate baboni that are NOT on double-embedded effects.
 */
async function _migrateDocumentDirect(object) {
  // should any effects on this document be updated?
  const updateEffectsNormally = (object instanceof Actor) || (object instanceof Item && !object.parent);
  if (updateEffectsNormally) { for (const effect of object.effects) await _migrateDocumentDirect(effect); }
  else if (object instanceof Item && object.parent instanceof Actor) await _migrateDoubleEmbeddedEffects(object);




  const flags = object.getFlag(MODULE, "bonuses");
  if (!flags) return true;
  const entries = Object.entries(flags).filter(([id]) => TYPES.map(t => t.value).includes(id));
  for (const [type, boni] of entries) {
    for (const bonus in boni) {
      const data = _modifyData(boni[bonus]);
      try {
        const bab = _createBabonus(data, data.id, { strict: false });
        const set = await object.setFlag("babonus", "bonuses." + data.id, bab.toString());
        if (set) await object.unsetFlag("babonus", `bonuses.${type}.${boni}`);
      } catch (err) {
        console.warn(`THE BABONUS ${data.name} COULD NOT BE MIGRATED DUE TO BAD DATA.`);
        console.warn(err);
      }
    }
  }
  return true;
}

/**
 * Takes an old babonus and returns the new format.
 * babonus: an object
 */
function _modifyData(babonus) {
  const data = foundry.utils.duplicate(babonus);

  if ("itemTypes" in data) data.filters.itemTypes = foundry.utils.duplicate(data.itemTypes);
  if ("throwTypes" in data) data.filters.throwTypes = foundry.utils.duplicate(data.throwTypes);
  if ("itemRequirements" in data) data.filters.itemRequirements = foundry.utils.duplicate(data.itemRequirements);

  data.name = data.label;
  data.type = type;
  data.id = foundry.utils.randomID();
  data.bonuses = foundry.utils.duplicate(data.values);

  if ("arbitraryComparison" in data.filters) data.filters.arbitraryComparison = [foundry.utils.duplicate(data.filters.arbitraryComparison)];
  if ("spellLevels" in data.filters) data.filters.spellLevels = data.filters.spellLevels.map(n => n.toString());

  delete data.itemTypes;
  delete data.throwTypes;
  delete data.itemRequirements;
  delete data.label;
  delete data.values;

  return data;
}

/**
 * Migrate actor.items.effects.
 * object: an item.
 */
async function _migrateDoubleEmbeddedEffects(object) {
  const effects = foundry.utils.duplicate(object.effects);
  if (!effects?.length) return true;

  const newEffects = [];
  for (const effect of effects) {
    const flags = foundry.utils.getProperty(effect, `flags.${MODULE}.bonuses`);
    if (!flags) {
      newEffects.push(effect);
      continue;
    }
    const entries = Object.entries(flags).filter(([id]) => TYPES.map(t => t.value).includes(id));
    for (const [type, boni] of entries) { // attack.{ids}
      for (const bonus in boni) { // id in ids
        const data = _modifyData(boni[bonus]);
        try {
          const bab = _createBabonus(data, data.id, { strict: false });
          foundry.utils.setProperty(effect, `flags.${MODULE}.bonuses.${data.id}`, bab.toString());
          delete effect.flags?.babonus?.bonuses?.[type]?.bonus;
        } catch (err) {
          console.warn(`THE BABONUS ${data.name} COULD NOT BE MIGRATED DUE TO BAD DATA.`);
          console.warn(err);
        }
      }
    }
    newEffects.push(effect);
  }
  return object.update({ effects: newEffects });
}
