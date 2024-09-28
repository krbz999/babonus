import {default as applications} from "./applications/_module.mjs";
import {default as models} from "./models/babonus-model.mjs";

export default {
  applyMarkers: applyMarkers,
  createBabonus: createBabonus,
  duplicateBonus: duplicateBonus,
  embedBabonus: embedBabonus,
  findEmbeddedDocumentsWithBonuses: findEmbeddedDocumentsWithBonuses,
  fromUuid: babonusFromUuid,
  fromUuidSync: babonusFromUuidSync,
  getCollection: getCollection,
  hasArmorProficiency: hasArmorProficiency,
  hasToolProficiency: hasToolProficiency,
  hasWeaponProficiency: hasWeaponProficiency,
  hotbarToggle: hotbarToggle,
  openBabonusWorkshop: openBabonusWorkshop,
  proficiencyTree: proficiencyTree,
  speaksLanguage: speaksLanguage
};

/* -------------------------------------------------- */

/**
 * Apply markers to a document for the 'Markers' filter.
 * @param {Document} document             The target document.
 * @returns {Promise<Document|null>}      A promise that resolves to the result of the dialog prompt.
 */
async function applyMarkers(document) {
  const {SetField, StringField} = foundry.data.fields;
  const field = new SetField(new StringField());
  const value = document.getFlag("babonus", "markers") ?? [];
  const html = field.toFormGroup({
    label: "BABONUS.MarkersDialog.field.label",
    hint: "BABONUS.MarkersDialog.field.hint",
    localize: true
  }, {value: value, name: "markers", slug: true}).outerHTML;

  return foundry.applications.api.DialogV2.prompt({
    rejectClose: false,
    content: `<fieldset>${html}</fieldset>`,
    window: {
      icon: "fa-solid fa-tags",
      title: game.i18n.format("BABONUS.MarkersDialog.title", {name: document.name})
    },
    position: {width: 400},
    ok: {
      callback: (event, button) => {
        const markers = Array.from(button.form.elements.markers.value);
        return document.setFlag("babonus", "markers", markers);
      }
    }
  });
}

/* -------------------------------------------------- */

/**
 * Return an object of arrays of items and effects on the given document
 * that have one or more babonuses embedded in them.
 * @param {Document} object     An actor or item with embedded documents.
 * @returns {object}            An object with an array of effects and array of items.
 */
function findEmbeddedDocumentsWithBonuses(object) {
  const documents = {};

  for (const [, e] of object.traverseEmbeddedDocuments()) {
    const bonuses = getCollection(e);
    const collection = e.constructor.metadata.collection;
    documents[collection] ??= [];
    if (bonuses.size) documents[collection].push(e);
  }

  return documents;
}

/* -------------------------------------------------- */

/**
 * Render the build-a-bonus application for a document.
 * @param {Document} object       An actor, item, effect, or region.
 * @returns {BabonusWorkshop}     The rendered workshop.
 */
function openBabonusWorkshop(object) {
  const validDocumentType = ["Actor", "Item", "ActiveEffect", "Region"].includes(object.documentName);
  if (!validDocumentType) throw new Error("The document provided is not a valid document type for Build-a-Bonus!");
  return new applications.BabonusWorkshop(object).render(true);
}

/* -------------------------------------------------- */

/**
 * Create a babonus in memory with the given data.
 * @param {object} data           An object of babonus data.
 * @param {Document} [parent]     The document to act as parent of the babonus.
 * @returns {Babonus}             The created babonus.
 */
function createBabonus(data, parent = null) {
  if (!(data.type in models)) throw new Error("INVALID BABONUS TYPE.");
  data.id = foundry.utils.randomID();
  return new models[data.type](data, {parent});
}

/* -------------------------------------------------- */

/**
 * Duplicate a bonus.
 * @param {Babonus} bonus           The bonus to duplicate.
 * @returns {Promise<Babonus>}      The duplicate.
 */
async function duplicateBonus(bonus) {
  const data = bonus.toObject();
  data.name = game.i18n.format("BABONUS.BonusCopy", {name: data.name});
  bonus = new bonus.constructor(data, {parent: bonus.parent});
  const id = await embedBabonus(bonus.parent, bonus, {bonusId: true});
  return getCollection(bonus.parent).get(id);
}

/* -------------------------------------------------- */

/**
 * Internal helper method for fromUuid and fromUuidSync.
 * @param {string} uuid     Babonus uuid.
 * @returns {{parentUuid: string, id: string}}
 */
const _getParentUuidAndId = (uuid) => {
  const parts = uuid.split(".");
  const id = parts.pop();
  parts.pop();
  const parentUuid = parts.join(".");
  return {parentUuid, id};
};

/* -------------------------------------------------- */

/**
 * Return a babonus using its uuid.
 * @param {string} uuid                 The babonus uuid.
 * @returns {Promise<Babonus|null>}     The found babonus.
 */
async function babonusFromUuid(uuid) {
  try {
    const ids = _getParentUuidAndId(uuid);
    const parent = await fromUuid(ids.parentUuid);
    const collection = getCollection(parent);
    return collection.get(ids.id);
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------------- */

/**
 * Return a babonus using its uuid synchronously.
 * @param {string} uuid         The babonus uuid.
 * @returns {Babonus|null}      The found babonus.
 */
function babonusFromUuidSync(uuid) {
  try {
    const ids = _getParentUuidAndId(uuid);
    const parent = fromUuidSync(ids.parentUuid);
    const collection = getCollection(parent);
    return collection.get(ids.id);
  } catch (err) {
    return null;
  }
}

/* -------------------------------------------------- */

/**
 * Return the collection of bonuses on the document.
 * @param {Document} object           An actor, item, effect, or template.
 * @returns {Collection<Babonus>}     A collection of babonuses.
 */
function getCollection(object) {
  let bonuses = foundry.utils.getProperty(object, "flags.babonus.bonuses") ?? [];
  if (foundry.utils.getType(bonuses) === "Object") bonuses = Object.values(bonuses);

  const contents = [];
  for (const bonusData of bonuses) {
    try {
      if (!foundry.data.validators.isValidId(bonusData.id)) continue;
      const bonus = new models[bonusData.type](bonusData, {parent: object});
      contents.push([bonus.id, bonus]);
    } catch (err) {
      console.warn(err);
    }
  }
  return new foundry.utils.Collection(contents);
}

/* -------------------------------------------------- */

/**
 * Embed a created babonus onto the target object.
 * @param {Document} object                   The actor, item, effect, or region that should have the babonus.
 * @param {Babonus} bonus                     The created babonus.
 * @param {object} [options]                  Creation and return options.
 * @param {boolean} [options.renderSheet]     Render the sheet once created?
 * @returns {Promise<Document>}               The actor, item, effect, or region that has received the babonus.
 */
async function embedBabonus(object, bonus, {renderSheet = true, ...options} = {}) {
  const validDocumentType = ["Actor", "Item", "ActiveEffect", "Region"].includes(object.documentName);
  if (!validDocumentType) throw new Error("The document provided is not a valid document type for Build-a-Bonus!");
  if (!Object.values(models).some(t => bonus instanceof t)) return null;
  const id = await _embedBabonus(object, bonus);
  if (renderSheet) getCollection(object).get(id).sheet.render({force: true});
  return options.bonusId ? id : object;
}

/* -------------------------------------------------- */

/**
 * Embed a created babonus onto the target object.
 * @param {Document} object       The actor, item, effect, or region that should have the babonus.
 * @param {Babonus} bonus         The created babonus.
 * @returns {Promise<string>}     The id of the bonus created.
 */
async function _embedBabonus(object, bonus) {
  const data = bonus.toObject();
  for (const id of Object.keys(data.filters)) {
    if (!babonus.abstract.DataFields.fields[id].storage(bonus)) delete data.filters[id];
  }
  data.id = foundry.utils.randomID();
  let collection = babonus.getCollection(object);
  if (collection.has(data.id)) collection.delete(data.id);
  collection = collection.map(k => k.toObject());
  collection.push(data);

  await object.setFlag("babonus", "bonuses", collection);
  return data.id;
}

/* -------------------------------------------------- */

/**
 * Hotbar method for toggling a bonus via uuid.
 * @param {string} uuid       Uuid of the bonus to toggle.
 * @returns {Promise<null|Babonus>}
 */
async function hotbarToggle(uuid) {
  const bonus = await babonusFromUuid(uuid);
  if (!bonus) {
    ui.notifications.warn("BABONUS.BonusNotFound", {localize: true});
    return;
  }
  return bonus.toggle();
}

/* -------------------------------------------------- */

/**
 * Does this actor speak a given language?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The language to test.
 * @returns {boolean}
 */
function speaksLanguage(actor, trait) {
  return _hasTrait(actor, trait, "languages");
}

/* -------------------------------------------------- */

/**
 * Does this actor have a given weapon proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasWeaponProficiency(actor, trait) {
  return _hasTrait(actor, trait, "weapon");
}

/* -------------------------------------------------- */

/**
 * Does this actor have a given armor proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasArmorProficiency(actor, trait) {
  return _hasTrait(actor, trait, "armor");
}

/* -------------------------------------------------- */

/**
 * Does this actor have a given tool proficiency?
 * @param {Actor5e} actor     The actor to test.
 * @param {string} trait      The trait to test.
 * @returns {boolean}
 */
function hasToolProficiency(actor, trait) {
  return _hasTrait(actor, trait, "tool");
}

/* -------------------------------------------------- */

/**
 * Internal method for proficiency checking.
 * @param {Actor5e} actor       The actor to test.
 * @param {string} trait        The trait to test.
 * @param {string} category     The tree to scan.
 * @returns {boolean}
 */
function _hasTrait(actor, trait, category) {
  const path = CONFIG.DND5E.traits[category].actorKeyPath ?? `system.traits.${category}`;
  const set = foundry.utils.getProperty(actor, path)?.value ?? new Set();
  if (set.has(trait)) return true;
  return set.some(v => {
    const [k, obj] = babonus.trees[category].find(v) ?? [];
    return (k === trait) || (obj.children && obj.children.find(trait));
  });
}

/* -------------------------------------------------- */

/**
 * Retrieve a path through nested proficiencies to find a specific proficiency in a category.
 * E.g., 'smith' and 'tool' will return ['art', 'smith'], and 'aquan' and 'languages' will
 * return ['exotic', 'primordial', 'aquan'].
 * @param {string} key          The specific proficiency (can be a category), e.g., "smith" or "primordial".
 * @param {string} category     The trait category, e.g., "tool", "weapon", "armor", "languages".
 * @returns {string[]}
 */
function proficiencyTree(key, category) {
  const root = babonus.trees[category];
  const path = [];

  const find = (node) => {
    for (const [k, v] of Object.entries(node)) {
      if ((k === key)) {
        path.unshift(k);
        return true;
      } else if (v.children) {
        const result = find(v.children);
        if (result) {
          path.unshift(k);
          return true;
        }
      }
    }
    path.shift();
    return false;
  };

  find(root);
  return path;
}
