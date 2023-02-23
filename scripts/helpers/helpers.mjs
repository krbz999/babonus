import {BabonusWorkshop} from "../applications/babonus.mjs";
import {
  AttackBabonus,
  DamageBabonus,
  HitDieBabonus,
  SaveBabonus,
  ThrowBabonus
} from "../applications/dataModel.mjs";
import {BabonusKeysDialog} from "../applications/keysDialog.mjs";
import {MODULE_NAME, TYPES} from "../constants.mjs";

/**
 * A collection of getters for Keys dialogs when creating or editing a babonus.
 */
export class KeyGetter {

  // base weapon types.
  static get baseWeapons() {
    const entries = Object.entries(CONFIG.DND5E.weaponIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const {index} = game.packs.get(packKey);
      const {name: label} = index.find(({_id}) => {
        return _id === id;
      }) ?? {};
      return {value, label};
    });
  }

  // the types of damage, as well as healing and temp.
  static get damageTypes() {
    const {damageTypes: d, healingTypes: h} = CONFIG.DND5E;
    const entries = Object.entries(d).concat(Object.entries(h));
    return entries.map(([value, label]) => ({value, label}));
  }

  // the spell schools available.
  static get spellSchools() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([value, label]) => ({value, label}));
  }

  // ability score keys.
  static get abilities() { // TODO: fix in 2.2.x.
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, label]) => ({value, label}));
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
    const {spellComponents: s, spellTags: t} = CONFIG.DND5E;
    const entries = Object.entries(s).concat(Object.entries(t));
    return entries.map(([value, {label}]) => {
      return {value, label};
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }

  // spell levels.
  static get spellLevels() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({value, label}));
  }

  // all weapon properties.
  static get weaponProperties() {
    const prop = Object.entries(CONFIG.DND5E.weaponProperties);
    return prop.map(([value, label]) => ({value, label}));
  }

  // all status effects.
  static get effects() {
    const effects = CONFIG.statusEffects;
    return effects.reduce((acc, {id, icon}) => {
      if (!id) return acc;
      acc.push({value: id, label: id, icon})
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
      return {value: key, label: game.i18n.localize(local)};
    }).sort((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }
}

/**
 * Get the minimum distance between two tokens, evaluating height and all grid spaces they occupy.
 * @param {Token5e} tokenA    One token placeable.
 * @param {Token5e} tokenB    Another token placeable.
 * @returns {number}          The minimum distance.
 */
export function _getMinimumDistanceBetweenTokens(tokenA, tokenB) {
  const A = _getAllTokenGridSpaces(tokenA.document);
  const B = _getAllTokenGridSpaces(tokenB.document);
  const rays = A.flatMap(a => {
    return B.map(b => {
      return {ray: new Ray(a, b)};
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

/**
 * Get all the upper left corners of all grid spaces one token occupies.
 * @param {TokenDocument5e} tokenDoc    The token document.
 * @returns {Array}                     An array of x and y coordinate objects.
 */
export function _getAllTokenGridSpaces(tokenDoc) {
  const {width, height, x, y} = tokenDoc;
  if (width <= 1 && height <= 1) return [{x, y}];
  const corners = [];
  const grid = canvas.grid.size;
  for (let a = 0; a < width; a++) {
    for (let b = 0; b < height; b++) {
      corners.push({
        x: x + a * grid,
        y: y + b * grid
      });
    }
  }
  return corners;
}

//
/**
 * Create a Babonus with the given id (or a new one if none is provided).
 * @param {object} data     An object of babonus data.
 * @param {string} id       Optionally an id to assign the babonus.
 * @param {object} options  Additional options that modify the babonus creation.
 */
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

/**
 * Helper function to render the build-a-bonus application for a document with the correct title.
 * @param {Document5e} object   An actor, item, effect, or template.
 * @returns {BabonusWorkshop}   The rendered workshop.
 */
export function _openWorkshop(object) {
  return new BabonusWorkshop(object, {
    title: `${MODULE_NAME}: ${object.name ?? object.label}`
  }).render(true);
}

/**
 * Get a Collection of babonuses from a document.
 * @param {Document5e} object   An actor, item, effect, or template.
 * @returns {Collection}        A collection of babonuses.
 */
export function _getCollection(object) {
  const bonuses = Object.entries(object.flags.babonus?.bonuses ?? {});
  const contents = bonuses.reduce((acc, [id, data]) => {
    if (!foundry.data.validators.isValidId(id)) return acc;
    try {
      const bab = _createBabonus(data, id, {parent: object});
      acc.push([id, bab]);
    } catch (err) {
      console.warn(err);
    }
    return acc;
  }, []);
  return new foundry.utils.Collection(contents);
}

/**
 * Helper function to display the keys dialog and subsequently place the
 * selected values in the input fields that its button was placed near.
 * @param {PointerEvent} event      The initiating click event.
 */
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
    options: {filterId, appId: this.appId, lists, double},
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
