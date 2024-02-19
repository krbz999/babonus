import {BabonusSheet} from "../applications/babonus-sheet.mjs";
import {module} from "./_module.mjs";

class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    data = foundry.utils.mergeObject({
      name: options.parent?.name ?? game.i18n.localize("BABONUS.NewBabonus"),
      img: options.parent?.img ?? "icons/svg/dice-target.svg"
    }, data);
    super(data, options);
  }

  /** @override */
  static get metadata() {
    return {label: game.i18n.localize("BABONUS.Babonus")};
  }

  /**
   * An object of applications that re-render when this bonus is updated.
   * @type {object}
   */
  get apps() {
    return this._apps ??= {};
  }

  /**
   * The sheet of the bonus.
   * @type {BabonusSheet}
   */
  get sheet() {
    if (this._sheet) return this._sheet;
    return this._sheet = new BabonusSheet(this);
  }

  /** @override */
  testUserPermission() {
    // Since babs are always local, all users have permission to render them.
    // Proper permissions are handled elsewhere.
    return true;
  }

  /** @override */
  _initialize(...args) {
    super._initialize(...args);
    this.prepareDerivedData();
  }

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    if (!source) return data;
    for (const id in data.filters) {
      if (!module.filters[id].storage(this)) delete data.filters[id];
    }
    return data;
  }

  /** @override */
  toDragData() {
    return {type: "Babonus", uuid: this.uuid};
  }

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @type {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /**
   * The FA icon unique to this babonus type. Must be subclassed.
   * @type {string}
   */
  static get icon() {
    return null;
  }
  get icon() {
    return this.constructor.icon;
  }

  /**
   * The default image to use for this babonus type. Must be subclassed.
   * @type {string}
   */
  static get defaultImg() {
    return null;
  }

  /**
   * Get the type of a babonus.
   * @type {string}
   */
  static get type() {
    return null;
  }

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it applies to attack rolls, damage
   * rolls, saving throws, or ability checks; any of the rolls that have a roll configuration dialog. The babonus must also
   * apply an additive bonus on top, i.e., something that can normally go in the 'Situational Bonus' input.
   * @TODO once hit die rolls have a dialog as well, this should be amended.
   * @TODO once rolls can be "remade" in 3.1.0, optional bonuses should be able to apply to other properties as well.
   * @type {boolean}
   */
  get isOptionable() {
    return ["attack", "damage", "throw", "test"].includes(this.type) && !!this.bonuses.bonus;
  }

  /**
   * Whether a babonus is currently optional, which is only true if it is both able to be optional, and toggled as such.
   * @type {boolean}
   */
  get isOptional() {
    return this.optional && this.isOptionable;
  }

  /**
   * Whether a babonus is valid for being 'item only' in the builder. It must be embedded in an item (or an
   * effect on an item which targets the item's actor), must not be an aura or template aura, and must either
   * apply to attack rolls, damage rolls, or save DCs while the parent item can make use of one of those, or
   * it must apply to ability checks while being embedded on a tool-type item.
   * @type {boolean}
   */
  get canExclude() {
    let item;
    if (this.parent instanceof Item) item = this.parent;
    else if (this.parent instanceof ActiveEffect) {
      if (!(this.parent.target instanceof Actor) || !(this.parent.parent instanceof Item)) return false;
      item = this.parent.parent;
    }
    if (!item) return false;

    // Valid for attack/damage/save:
    const model = dnd5e.dataModels.item.config[item.type];
    const validityA = ["attack", "damage", "save"].includes(this.type) && !!model.schema.getField("damage.parts");

    // Valid for test:
    const validityB = (this.type === "test") && (item.type === "tool");

    return (validityA || validityB);
  }

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @type {boolean}
   */
  get isExclusive() {
    return this.exclusive && this.canExclude;
  }

  /**
   * Whether the babonus is unavailable due to its parent item being unequipped, unattuned (if required), or uncrewed.
   * This is different from a babonus that is unavailable due to its parent effect being disabled or unavailable.
   * @type {boolean}
   */
  get isSuppressed() {
    // If this bonus lives on an effect or template, defer to those.
    const effect = this.effect;
    if (effect) return !effect.modifiesActor;
    const template = this.template;
    if (template) return template.hidden;

    const item = this.item;
    if (!item) return false;

    const actor = item.actor;
    if (!actor) return false;

    if (actor.type === "vehicle") {
      if (!dnd5e.dataModels.item.config[item.type].schema.getField("crewed")) return false;
      return !item.system.crewed;
    }

    // The item type must be equippable.
    if (!dnd5e.dataModels.item.config[item.type].schema.getField("equipped")) return false;

    // The item is not equipped.
    if (!item.system.equipped) return true;
    // The item requires but is not attuned.
    return item.system.attunement === CONFIG.DND5E.attunementTypes.REQUIRED;
  }

  /**
   * The true source of the babonus intended for the retrieval of roll data.
   * - If the babonus is embedded on a template, this returns the item that created it.
   * - If the babonus is embedded on an item or actor, this simply returns that item or actor.
   * - If the babonus is embedded on an effect, this returns the actor or item from which the effect originates.
   * @type {Actor5e|Item5e|null}
   */
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const retrieved = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (retrieved instanceof Item) ? retrieved : null;
    }

    if (this.parent instanceof Item) return this.parent;

    if (this.parent instanceof Actor) return this.parent;

    if (this.parent instanceof ActiveEffect) {
      let origin;
      try {
        origin = fromUuidSync(this.parent.origin);
        if (!origin) return null;
      } catch (err) {
        console.warn(err);
        return null;
      }

      if (origin instanceof Item) return origin;
      if (origin instanceof Actor) return origin;
      if (origin instanceof ActiveEffect) return origin.parent;
      return null;
    }

    return null;
  }

  /**
   * The actor that this bonus is currently directly or indirectly embedded on, if any.
   * @type {Actor5e|null}
   */
  get actor() {
    if (this.parent instanceof Actor) return this.parent;

    if (this.parent instanceof Item) return this.parent.parent ?? null;

    if (this.parent instanceof ActiveEffect) {
      if (this.parent.parent instanceof Actor) return this.parent.parent;
      if (this.parent.parent instanceof Item) return this.parent.parent.parent ?? null;
    }

    if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (item instanceof Item) ? (item.parent ?? null) : null;
    }
  }

  /**
   * Get the corresponding token of the actor that has the bonus, no matter what type of document it is embedded in.
   * Note that this is different from the 'origin' and is dependant on where the bonus currently lives.
   * @type {Token5e|null}
   */
  get token() {
    const actor = this.actor;
    if (!actor) return null;
    const token = actor.isToken ? actor.token?.object : actor.getActiveTokens()[0];
    return token ? token : null;
  }

  /**
   * The item that this bonus is currently directly or indirectly embedded on, if any.
   * @type {Item5e|null}
   */
  get item() {
    if (this.parent instanceof Actor) return null;

    if (this.parent instanceof Item) return this.parent;

    if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e?.origin ?? "");
      return (item instanceof Item) ? item : null;
    }

    if (this.parent instanceof ActiveEffect) {
      const item = fromUuidSync(this.parent.origin ?? "");
      return (item instanceof Item) ? item : null;
    }
  }

  /**
   * The effect that this bonus is currently directly embedded on, if any.
   * @type {ActiveEffect5e|null}
   */
  get effect() {
    return (this.parent instanceof ActiveEffect) ? this.parent : null;
  }

  /**
   * The template that this bonus is currently directly embedded on, if any.
   * @type {MeasuredTemplateDocument|null}
   */
  get template() {
    return (this.parent instanceof MeasuredTemplateDocument) ? this.parent : null;
  }

  /**
   * Get the default values nested within the schema.
   * @param {string} prefix     The prefix leading to the object of initial values.
   * @returns {object}          An object of values.
   */
  getDefaults(prefix) {
    const field = this.schema.getField(prefix);
    return field.getInitialValue();
  }

  /** @override */
  static defineSchema() {
    const base = this._defineBaseSchema();
    base.bonuses = new foundry.data.fields.SchemaField(this._defineBonusSchema());
    base.filters = new foundry.data.fields.SchemaField(this._defineFilterSchema());
    return base;
  }

  /**
   * Define the basics of the schema, properties that are not type specific.
   * @returns {object}      An object of properties.
   */
  static _defineBaseSchema() {
    return {
      id: new foundry.data.fields.DocumentIdField({initial: () => foundry.utils.randomID()}),
      sort: new foundry.data.fields.IntegerSortField(),
      name: new foundry.data.fields.StringField({required: true, blank: false}),
      img: new foundry.data.fields.FilePathField({categories: ["IMAGE"]}),
      type: new foundry.data.fields.StringField({required: true, initial: this.type, choices: [this.type]}),
      enabled: new foundry.data.fields.BooleanField({initial: true}),
      exclusive: new foundry.data.fields.BooleanField(),
      optional: new foundry.data.fields.BooleanField(),
      description: new foundry.data.fields.StringField({required: true}),
      consume: new foundry.data.fields.EmbeddedDataField(module.fields.consume),
      aura: new foundry.data.fields.EmbeddedDataField(module.fields.aura),
      flags: new foundry.data.fields.ObjectField()
    };
  }

  /**
   * Define the bonuses data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineBonusSchema() {
    return {};
  }

  /**
   * Define the filter data of the schema.
   * @returns {object}      An object of properties.
   */
  static _defineFilterSchema() {
    return {
      arbitraryComparison: new module.filters.arbitraryComparison(),
      baseArmors: new module.filters.baseArmors(),
      statusEffects: new module.filters.statusEffects(),
      healthPercentages: new module.filters.healthPercentages(),
      customScripts: new module.filters.customScripts(),
      remainingSpellSlots: new module.filters.remainingSpellSlots(),
      actorCreatureTypes: new module.filters.actorCreatureTypes()
    };
  }

  /** @override */
  static migrateData(source) {
    const minimum = source?.bonuses?.modifiers?.minimum;
    if (!minimum) return;
    if (!("maximize" in minimum) && (minimum.value === "-1")) {
      minimum.value = "";
      minimum.maximize = true;
    }
  }

  /**
   * Get applicable roll data from the origin.
   * @param {boolean} deterministic     Whether to force flat values for properties that could be a die term or flat term.
   * @returns {object}                  The roll data.
   */
  getRollData({deterministic = false} = {}) {
    return this.origin?.getRollData({deterministic}) ?? {};
  }

  /** @override */
  prepareDerivedData() {
    return;
  }

  /* -------------------------------------------- */
  /*               Flag Operations                */
  /* -------------------------------------------- */

  /**
   * Get the value of a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @returns {*}
   */
  getFlag(scope, key) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    return foundry.utils.getProperty(this.flags?.[scope], key);
  }

  /**
   * Set a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @param {*} value
   * @returns {Promise<Babonus>}
   */
  async setFlag(scope, key, value) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    await this.parent.update({[`flags.babonus.bonuses.${this.id}.flags.${scope}.${key}`]: value});
    this.updateSource({[`flags.${scope}.${key}`]: value});
    return this;
  }

  /**
   * Remove a flag on this babonus.
   * @param {string} scope
   * @param {string} key
   * @return {Promise<Babonus>}
   */
  async unsetFlag(scope, key) {
    const scopes = this.parent.constructor.database.getFlagScopes();
    if (!scopes.includes(scope)) throw new Error(`Flag scope "${scope}" is not valid or not currently active.`);
    const head = key.split(".");
    const tail = `-=${head.pop()}`;
    key = ["flags", scope, ...head, tail].join(".");
    await this.parent.update({[`flags.babonus.bonuses.${this.id}.${key}`]: null});
    this.updateSource({[key]: null});
    return this;
  }

  /* -------------------------------------------- */
  /*               Instance Methods               */
  /* -------------------------------------------- */

  /**
   * Toggle this bonus.
   * @returns {Promise<Babonus>}
   */
  async toggle() {
    const path = `flags.babonus.bonuses.${this.id}.enabled`;
    const state = foundry.utils.getProperty(this.parent, path);
    await this.parent.update({[path]: !state});
    this.updateSource({enabled: !state});
    return this;
  }

  /**
   * Update this bonus, propagating the data to its parent.
   * @param {object} changes        The update object.
   * @param {object} [options]      The update options.
   * @returns {Promise<Babonus>}
   */
  async update(changes, options = {}) {
    const path = `flags.babonus.bonuses.${this.id}`;
    changes = foundry.utils.expandObject(changes);
    delete changes.id;
    await this.parent.update({[path]: changes}, options);
    this.updateSource(changes, options);
    return this;
  }

  /**
   * Delete this bonus.
   * @returns {Promise<Babonus>}
   */
  async delete() {
    const update = {[`flags.babonus.bonuses.-=${this.id}`]: null};
    await this.parent.update(update);
    return this;
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new module.filters.abilities(),
      attackTypes: new module.filters.attackTypes(),
      baseWeapons: new module.filters.baseWeapons(),
      creatureTypes: new module.filters.creatureTypes(),
      damageTypes: new module.filters.damageTypes(),
      featureTypes: new module.filters.featureTypes(),
      itemTypes: new module.filters.itemTypes(),
      preparationModes: new module.filters.preparationModes(),
      spellComponents: new module.filters.spellComponents(),
      spellLevels: new module.filters.spellLevels(),
      spellSchools: new module.filters.spellSchools(),
      targetEffects: new module.filters.targetEffects(),
      tokenSizes: new module.filters.tokenSizes(),
      weaponProperties: new module.filters.weaponProperties()
    };
  }
}

class AttackBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true}),
      criticalRange: new foundry.data.fields.StringField({required: true}),
      fumbleRange: new foundry.data.fields.StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-location-crosshairs";
  }

  /** @override */
  static get type() {
    return "attack";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-weapon-proficiencies.svg";
  }
}

class DamageBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true}),
      damageType: new foundry.data.fields.StringField({required: true}),
      criticalBonusDice: new foundry.data.fields.StringField({required: true}),
      criticalBonusDamage: new foundry.data.fields.StringField({required: true}),
      modifiers: new foundry.data.fields.EmbeddedDataField(module.fields.modifiers)
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-burst";
  }

  /** @override */
  static get type() {
    return "damage";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/properties/magical.svg";
  }

  /**
   * Does this bonus have a damage type?
   * @type {boolean}
   */
  get hasDamageType() {
    const type = this.bonuses.damageType;
    return type in CONFIG.DND5E.damageTypes;
  }
}

class SaveBabonus extends ItemBabonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      saveAbilities: new module.filters.saveAbilities()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-hand-sparkles";
  }

  /** @override */
  static get type() {
    return "save";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-damage-resistances.svg";
  }
}

class ThrowBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true}),
      deathSaveTargetValue: new foundry.data.fields.StringField({required: true}),
      deathSaveCritical: new foundry.data.fields.StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      throwTypes: new module.filters.throwTypes(),
      targetEffects: new module.filters.targetEffects(),
      creatureTypes: new module.filters.creatureTypes(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-person-falling-burst";
  }

  /** @override */
  static get type() {
    return "throw";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-saves.svg";
  }
}

class TestBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true})
    };
  }

  /** @override */
  static _defineFilterSchema() {
    return {
      ...super._defineFilterSchema(),
      abilities: new module.filters.abilities(),
      baseTools: new module.filters.baseTools(),
      skillIds: new module.filters.skillIds(),
      proficiencyLevels: new module.filters.proficiencyLevels()
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-bolt";
  }

  /** @override */
  static get type() {
    return "test";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/trait-skills.svg";
  }
}

class HitDieBabonus extends Babonus {
  /** @override */
  static _defineBonusSchema() {
    return {
      ...super._defineBonusSchema(),
      bonus: new foundry.data.fields.StringField({required: true}),
      modifiers: new foundry.data.fields.EmbeddedDataField(module.fields.modifiers)
    };
  }

  /** @override */
  static get icon() {
    return "fa-solid fa-heart-pulse";
  }

  /** @override */
  static get type() {
    return "hitdie";
  }

  /** @override */
  static get defaultImg() {
    return "systems/dnd5e/icons/svg/hit-points.svg";
  }
}

export const models = {
  attack: AttackBabonus,
  damage: DamageBabonus,
  save: SaveBabonus,
  throw: ThrowBabonus,
  test: TestBabonus,
  hitdie: HitDieBabonus
};
