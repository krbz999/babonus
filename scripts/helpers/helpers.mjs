import { BabonusWorkshop } from "../applications/babonus.mjs";
import { ArbitraryComparisonField, SemicolonArrayField } from "../applications/dataFields.mjs";
import {
  AttackBabonus,
  DamageBabonus,
  HitDieBabonus,
  SaveBabonus,
  ThrowBabonus
} from "../applications/dataModel.mjs";
import { BabonusKeysDialog } from "../applications/keysDialog.mjs";
import {
  MODULE,
  MODULE_NAME,
  TYPES
} from "../constants.mjs";
import { getId } from "../public_api.mjs";

export class KeyGetter {

  // base weapon types.
  static get baseWeapons() {
    const entries = Object.entries(CONFIG.DND5E.weaponIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const { index } = game.packs.get(packKey);
      const { name: label } = index.find(({ _id }) => {
        return _id === id;
      }) ?? {};
      return { value, label };
    });
  }

  // the types of damage, as well as healing and temp.
  static get damageTypes() {
    const { damageTypes: d, healingTypes: h } = CONFIG.DND5E;
    const entries = Object.entries(d).concat(Object.entries(h));
    return entries.map(([value, label]) => ({ value, label }));
  }

  // the spell schools available.
  static get spellSchools() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([value, label]) => ({ value, label }));
  }

  // ability score keys.
  static get abilities() { // TODO: fix in 2.2.x.
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, label]) => ({ value, label }));
  }

  static get saveAbilities() {
    return this.abilities;
  }

  static get throwTypes() {
    const abl = this.abilities;
    abl.push({
      value: "death",
      label: game.i18n.localize("DND5E.DeathSave")
    });
    // CN compatibility.
    if (game.modules.get("concentrationnotifier")?.active) {
      abl.push({
        value: "concentration",
        label: game.i18n.localize("DND5E.Concentration")
      })
    }
    return abl;
  }

  // spell component types.
  static get spellComponents() {
    const { spellComponents: s, spellTags: t } = CONFIG.DND5E;
    const entries = Object.entries(s).concat(Object.entries(t));
    return entries.map(([value, { label }]) => {
      return { value, label };
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }

  // spell levels.
  static get spellLevels() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({ value, label }));
  }

  // all weapon properties.
  static get weaponProperties() {
    const prop = Object.entries(CONFIG.DND5E.weaponProperties);
    return prop.map(([value, label]) => ({ value, label }));
  }

  // all status effects.
  static get effects() {
    const effects = CONFIG.statusEffects;
    return effects.reduce((acc, { id, icon }) => {
      if (!id) return acc;
      acc.push({ value: id, label: id, icon })
      return acc;
    }, []).sort((a, b) => {
      return a.value.localeCompare(b.value);
    });
  }

  static get targetEffects() {
    return this.effects;
  }

  static get statusEffects() {
    return this.effects;
  }

  static get auraBlockers() {
    return this.effects;
  }

  // all base creature types
  static get creatureTypes() {
    const creatureTypes = CONFIG.DND5E.creatureTypes;
    return Object.entries(creatureTypes).map(([key, local]) => {
      return { value: key, label: game.i18n.localize(local) };
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }
}

// Gets the minimum distance between two tokens, evaluating all grid spaces they occupy.
export function _getMinimumDistanceBetweenTokens(tokenA, tokenB) {
  const A = _getAllTokenGridSpaces(tokenA.document);
  const B = _getAllTokenGridSpaces(tokenB.document);
  const rays = A.flatMap(a => {
    return B.map(b => {
      return { ray: new Ray(a, b) };
    });
  });
  const dist = canvas.scene.grid.distance; // 5ft.
  const distances = canvas.grid.measureDistances(rays, {
    gridSpaces: false
  }).map(d => Math.round(d / dist) * dist);
  const eles = [tokenA, tokenB].map(t => t.document.elevation);
  const elevationDiff = Math.abs(eles[0] - eles[1]);
  return Math.max(Math.min(...distances), elevationDiff);
}

// Get the upper left corners of all grid spaces a token document occupies.
export function _getAllTokenGridSpaces(tokenDoc) {
  const { width, height, x, y } = tokenDoc;
  if (width <= 1 && height <= 1) return [{ x, y }];
  const centers = [];
  const grid = canvas.grid.size;
  for (let a = 0; a < width; a++) {
    for (let b = 0; b < height; b++) {
      centers.push({
        x: x + a * grid,
        y: y + b * grid
      });
    }
  }
  return centers;
}

/**
 * Returns an array of tokens that are within radius ft of the source token.
 * source: source token placeable
 * radius: radius of the aura (in ft)
 * Credit to @Freeze#2689 for much artistic aid.
 */
export function _getTokensWithinRadius(source, radiusFt) {
  const tokenRadius = Math.abs(source.document.x - source.center.x);
  const pixels = radiusFt / canvas.scene.grid.distance * canvas.scene.grid.size + tokenRadius;
  const captureArea = new PIXI.Circle(source.center.x, source.center.y, pixels);
  const grid = canvas.grid.size;
  return canvas.tokens.placeables.filter(t => {
    if (t === source) return false;

    const { width, height, x, y } = t.document;
    if (width <= 1 && height <= 1) return captureArea.contains(t.center.x, t.center.y);
    for (let a = 0; a < width; a++) {
      for (let b = 0; b < height; b++) {
        const test = captureArea.contains(...canvas.grid.getCenter(x + a * grid, y + b * grid));
        if (test) return true;
      }
    }
    return false;
  });
}

// Turn a babonus into something that can easily be 'pasted' into the ui.
export function _babonusToString(babonus) {
  let flattened = foundry.utils.flattenObject(babonus);
  for (const key of Object.keys(flattened)) {
    const path = "schema.fields." + key.split(".").join(".fields.")
    const field = foundry.utils.getProperty(babonus, path);
    if (field instanceof SemicolonArrayField) flattened[key] = flattened[key]?.join(";");
    else if (field instanceof ArbitraryComparisonField && flattened[key]) {
      const a = Object.assign({}, flattened[key]);
      flattened[key] = foundry.utils.flattenObject(a);
      flattened = foundry.utils.flattenObject(flattened);
    }
    // Delete empty values (null, "", and empty arrays).
    const ie = flattened[key];
    if (ie === "" || ie === null || foundry.utils.isEmpty(ie)) delete flattened[key];
  }
  return flattened;
}

// same app id everywhere for lookup reasons.
export function _getAppId(object) {
  return `${MODULE}-${object.id}`;
}

// create a Babonus with the given id (or a new one if none is provided).
export function _createBabonus(data, id, options = {}) {
  const types = TYPES.map(t => t.value);
  if (!types.includes(data.type)) {
    throw new Error("INVALID BABONUS TYPE.");
  }

  // if no id explicitly provided, make a new one.
  data.id = id ?? foundry.utils.randomID();

  const BAB = new {
    attack: AttackBabonus,
    damage: DamageBabonus,
    save: SaveBabonus,
    throw: ThrowBabonus,
    hitdie: HitDieBabonus
  }[data.type](data, options);
  return BAB;
}

export function _openWorkshop(object) {
  return new BabonusWorkshop(object, {
    title: `${MODULE_NAME}: ${object.name ?? object.label}`
  }).render(true);
}

// Returns an array of the bonuses of a given type on the object.
export function _getType(object, type) {
  return _getCollection(object).filter(b => b.type === type);
}

// Returns a collection of bonuses on the object.
export function _getCollection(object) {
  if (!object) return new foundry.utils.Collection();
  const bonuses = Object.entries(object.getFlag(MODULE, "bonuses") ?? {});
  const contents = bonuses.reduce((acc, [id, data]) => {
    if (!foundry.data.validators.isValidId(id)) return acc;
    try {
      const bab = _createBabonus(data, id, { parent: object });
      acc.push([id, bab]);
      return acc;
    } catch (err) {
      console.warn(err);
      return acc;
    }
  }, []);
  return new foundry.utils.Collection(contents);
}

export async function _babFromDropData(data, parent) {
  if (data.data) return _createBabonus(data.data, null, { parent });
  else if (data.uuid) {
    const pre = await fromUuid(data.uuid);
    const prevParent = pre instanceof TokenDocument ? pre.actor : pre;
    const babonusData = getId(prevParent, data.babId).toObject();
    delete babonusData.id;
    return _createBabonus(babonusData, null, { parent });
  }
  return null;
}

export async function _babFromUuid(uuid) {
  try {
    const parts = uuid.split(".");
    const id = parts.pop();
    parts.pop();
    const parentUuid = parts.join(".");
    const parent = await fromUuid(parentUuid);
    return getId(parent, id) ?? null;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

export async function _onDisplayKeysDialog(event) {
  const formGroup = event.currentTarget.closest(".form-group");
  const filterId = formGroup.dataset.id;

  const lists = foundry.utils.duplicate(KeyGetter[filterId]);

  // The text inputs.
  const inputs = formGroup.querySelectorAll("input[type='text']");
  const double = inputs.length === 2;

  const [list, list2] = inputs
  const values0 = inputs[0].value.split(";");
  const values1 = inputs[1]?.value.split(";");
  lists.forEach(t => {
    t.checked0 = values0.includes(t.value);
    t.checked1 = values1?.includes(t.value);
  });
  const selected = await BabonusKeysDialog.prompt({
    label: game.i18n.localize("BABONUS.KeysDialogApplySelection"),
    rejectClose: false,
    options: { filterId, appId: this.appId, lists, double },
    callback: function(html) {
      const selector = "td:nth-child(2) input[type='checkbox']:checked";
      const selector2 = "td:nth-child(3) input[type='checkbox']:checked";
      const checked = [...html[0].querySelectorAll(selector)];
      const checked2 = [...html[0].querySelectorAll(selector2)];
      return {
        first: checked.map(i => i.id).join(";") ?? "",
        second: checked2.map(i => i.id).join(";") ?? ""
      };
    },
  });

  if (!selected) return;
  if (Object.values(selected).every(a => foundry.utils.isEmpty(a))) return;

  list.value = selected.first;
  if (list2) list2.value = selected.second;
  return;
}

/**
 * Construct the scaling options for an optional babonus. Each option will have a dataset with
 * 'property' (the attribute to subtract from), 'value' (the amount to subtract), and 'scale'
 * (how much this scales the bonus up from the base). Special handling for spell slots that are
 * 'too big'; these can still be used, but will not upscale the bonus any further.
 * @param {Actor5e|Item5e} data   The item or actor who has the property.
 * @param {string} type           One of the options of CONSUMPTION_TYPES.
 * @param {number} options.min    The minimum allowed value (or slot level).
 * @param {number} options.max    The maximum allowed value (or slot level).
 * @returns {string}              The string of options for the select.
 */
export function _constructScalingOptionalOptions(data, type, { min = -Infinity, max = Infinity } = {}) {
  if (type === "slots") return _constructScalingSlotOptions(data, { min, max });
  else if (type === "uses") return _constructScalingChargesOptions(data, { min, max });
  else if (type === "quantity") return _constructScalingQuantityOptions(data, { min, max });
}

// Construct the scaling options for spell slots.
function _constructScalingSlotOptions(data, { min, max }) {
  return Object.entries(data.system.spells).reduce((acc, [key, val]) => {
    if (!val.value || !val.max) return acc;
    const level = key === "pact" ? val.level : Number(key.at(-1));
    if (level < min) return acc;
    const label = game.i18n.format(`DND5E.SpellLevel${key === "pact" ? "Pact" : "Slot"}`, {
      level: key === "pact" ? val.level : game.i18n.localize(`DND5E.SpellLevel${level}`),
      n: `${val.value}/${val.max}`
    });
    const property = `system.spells.${key}.value`;
    const scale = Math.min(level, max) - Math.max(min, 1) + 1;
    return acc + `<option data-property="${property}" data-value="1" data-scale="${scale}">${label}</option>`;
  }, "");
}

// Construct the scaling options for limited uses.
function _constructScalingChargesOptions(data, { min, max }) {
  const property = "system.uses.value";
  if (data.system.uses.value <= 0) return "";
  return Array.fromRange(data.system.uses.value, 1).reduce((acc, n) => {
    if (!n.between(min, max)) return acc;
    const scale = n - min + 1;
    const label = `${n}/${data.system.uses.max}`
    return acc + `<option data-property="${property}" data-value="${n}" data-scale="${scale}">${label}</option>`;
  }, "");
}

// Construct the scaling options for quantities.
function _constructScalingQuantityOptions(data, { min, max }) {
  const property = "system.quantity";
  if (data.system.quantity <= 0) return "";
  return Array.fromRange(data.system.quantity, 1).reduce((acc, n) => {
    if (!n.between(min, max)) return acc;
    const scale = n - min + 1;
    const label = `${n}/${data.system.quantity}`
    return acc + `<option data-property="${property}" data-value="${n}" data-scale="${scale}">${label}</option>`;
  }, "");
}
