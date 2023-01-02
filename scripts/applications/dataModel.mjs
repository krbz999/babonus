import {
  arbitraryOperators,
  ATTACK_TYPES,
  auraTargets,
  ITEM_TYPES,
  MATCH,
  TYPES
} from "../constants.mjs";
import { KeyGetter, _babonusToString } from "../helpers/helpers.mjs";
import {
  FiltersField,
  BonusesField,
  RollDataField,
  AuraField,
  SpellComponentsField,
  SemicolonArrayField,
  NonEmptyArrayField,
  ArbitraryComparisonField,
  DisjointArraysField,
  SpanField,
  StrictStringField
} from "./dataFields.mjs";

class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
  }

  toString() {
    return _babonusToString(this);
  }

  toDragData() {
    const dragData = { type: "Babonus" };
    if (this.parent) {
      dragData.uuid = this.parent.uuid;
      dragData.babId = this.id;
    }
    else dragData.data = this.toObject();
    return dragData;
  }

  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  // whether a bonus can be toggled to be optional.
  get isOptionable() {
    return !!this.bonuses?.bonus && ["attack", "damage", "throw"].includes(this.type);
  }

  // whether a bonus is currently optional.
  get isOptional() {
    return this.isOptionable && this.optional;
  }

  // whether the bonus is embedded on an item and valid to be 'item only'.
  get isItemOnlyable() {
    return (this.parent instanceof Item) && [
      "attack", "damage", "save"
    ].includes(this.type) && !this.hasAura;
  }

  // whether the bonus is embedded on an item that can be equipped/attuned.
  get isPhysicalItem() {
    return (this.parent instanceof Item) && [
      "weapon",
      "equipment",
      "consumable",
      "tool",
      "loot"
    ].includes(this.item.type);
  }

  // whether the bonus is unavailable due to its item being unequipped or unattuned.
  get isSuppressed() {
    if (!this.isPhysicalItem) return false;
    const reqs = this.filters?.itemRequirements;
    if (!reqs) return false;
    const ATT = CONFIG.DND5E.attunementTypes.ATTUNED;
    if (this.item.system.attunement !== ATT && reqs.attuned) return true;
    if (!this.item.system.equipped && reqs.equipped) return true;
    return false;
  }

  // whether a bonus is currently only possible to apply to its parent item.
  get isItemOnly() {
    return this.itemOnly && this.isItemOnlyable;
  }

  // whether a bonus is currently an enabled and valid aura.
  get hasAura() {
    const a = this.aura;
    if (!a) return false;
    return !!a.enabled && (a.range === -1 || a.range > 0) && !a.isTemplate;
  }

  // whether this aura is blocked by any of its owner's blockers.
  get isAuraBlocked() {
    const blockers = this.aura?.blockers ?? [];
    if (!blockers.length) return false;

    return this.actor?.effects.some(effect => {
      if (!effect.modifiesActor) return false;
      const id = effect.getFlag("core", "statusId");
      return !!id && blockers.includes(id);
    }) ?? null;
  }

  // whether this bonus affects a template.
  get isTemplateAura() {
    const a = this.aura;
    if (!a) return false;
    return !!a.enabled && !!a.isTemplate;
  }

  // whether a bonus has any valid bonuses.
  get hasBonus() {
    return Object.entries(this.bonuses ?? {}).some(([key, val]) => {
      return !!val && val !== "0";
    });
  }

  // the actor who has the babonus, even if the bonus is on an item, effect, or template.
  get actor() {
    if (this.parent instanceof Actor) return this.parent;
    if (this.parent?.parent instanceof Actor) return this.parent.parent;
    return this.item?.parent ?? null;
  }

  // the item who has the babonus, if any.
  get item() {
    if (this.parent instanceof Item) return this.parent;
    if (this.parent instanceof MeasuredTemplateDocument) {
      const origin = foundry.utils.getProperty(this.parent, "flags.dnd5e.origin");
      const item = fromUuidSync(origin);
      if (item) return item;
    }
    return null;
  }

  // the effect who has the babonus, if any.
  get effect() {
    if (this.parent instanceof ActiveEffect) return this.parent;
    return null;
  }

  // the template who has the babonus, if any.
  get template() {
    if (this.parent instanceof MeasuredTemplateDocument) return this.parent;
    return null;
  }

  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return {
      id: new fields.DocumentIdField({ required: true, nullable: false }),
      name: new fields.StringField({ required: true, blank: false }),
      type: new fields.StringField({ required: true, blank: false, choices: TYPES.map(t => t.value) }),
      enabled: new fields.BooleanField({ required: true, initial: true }),
      itemOnly: new fields.BooleanField({ required: true, initial: false }),
      optional: new fields.BooleanField({ required: true, initial: false }),
      description: new fields.StringField({ required: true, blank: false }),
      aura: new AuraField({
        enabled: new fields.BooleanField({ required: false, initial: false }),
        isTemplate: new fields.BooleanField({ required: false, initial: false }),
        range: new fields.NumberField({ required: false, initial: null, min: -1, max: 500, step: 1, integer: true }),
        self: new fields.BooleanField({ required: false, initial: true }),
        disposition: new fields.NumberField({ required: false, initial: auraTargets.ANY, choices: Object.values(auraTargets) }),
        blockers: new SemicolonArrayField(new fields.StringField(), baseOptions)
      }, baseOptions),
      filters: new FiltersField({
        itemRequirements: new fields.SchemaField({
          equipped: new fields.BooleanField({ required: false, initial: false }),
          attuned: new fields.BooleanField({ required: false, initial: false })
        }, baseOptions),
        arbitraryComparison: new ArbitraryComparisonField(new fields.SchemaField({
          one: new fields.StringField({ required: true, blank: false }),
          other: new fields.StringField({ required: true, blank: false }),
          operator: new fields.StringField({ required: true, choices: arbitraryOperators.map(t => t.value) })
        }), baseOptions),
        statusEffects: new SemicolonArrayField(new fields.StringField({ blank: false }), baseOptions),
        targetEffects: new SemicolonArrayField(new fields.StringField({ blank: false }), baseOptions),
        creatureTypes: new DisjointArraysField({
          needed: new SemicolonArrayField(new fields.StringField({ blank: false }), { required: false }),
          unfit: new SemicolonArrayField(new fields.StringField({ blank: false }), { required: false })
        }, baseOptions),
        customScripts: new StrictStringField({ required: false, nullable: true, initial: undefined, blank: false }),
        remainingSpellSlots: new SpanField({
          min: new fields.NumberField({ required: false, initial: 0, min: 0, step: 1, integer: true, nullable: true }),
          max: new fields.NumberField({ required: false, initial: null, min: 0, step: 1, integer: true, nullable: true })
        }, baseOptions)
      })
    };
  }

  static migrateData(source) {
    this._migrateCreatureTypes(source);
  }

  static _migrateCreatureTypes(source) {
    if (!source.filters?.creatureTypes || source.filters.creatureTypes.needed || source.filters.creatureTypes.unfit) return;
    const needed = source.filters.creatureTypes;
    source.filters.creatureTypes = { needed };
    console.warn(`The Creature Types filter has been migrated into a different structure.
    You can remove this warning by editing the babonus and then saving it immediately, with no changes made.
    Support for this automatic migration will be removed in v11.`);
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new FiltersField({
        itemTypes: new NonEmptyArrayField(new fields.StringField({ choices: ITEM_TYPES, blank: true }), baseOptions),
        attackTypes: new NonEmptyArrayField(new fields.StringField({ choices: ATTACK_TYPES, blank: true }), baseOptions),
        damageTypes: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.damageTypes.map(t => t.value) }), baseOptions),
        abilities: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.abilities.map(t => t.value) }), baseOptions),
        spellComponents: new SpellComponentsField({
          types: new NonEmptyArrayField(new fields.StringField({ choices: KeyGetter.spellComponents.map(t => t.value), blank: true })),
          match: new fields.StringField({ initial: MATCH.ALL, choices: Object.keys(MATCH), required: false })
        }, baseOptions),
        spellLevels: new NonEmptyArrayField(new fields.StringField({ choices: KeyGetter.spellLevels.map(t => t.value), blank: true }), baseOptions),
        spellSchools: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.spellSchools.map(t => t.value) }), baseOptions),
        baseWeapons: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.baseWeapons.map(t => t.value) }), baseOptions),
        weaponProperties: new DisjointArraysField({
          needed: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.weaponProperties.map(t => t.value) }), { required: false }),
          unfit: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.weaponProperties.map(t => t.value) }), { required: false })
        }, baseOptions)
      })
    });
  }
}

export class AttackBabonus extends ItemBabonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false }),
        criticalRange: new RollDataField({ required: false }),
        fumbleRange: new RollDataField({ required: false })
      }, { required: true }),
    });
  }
}

export class DamageBabonus extends ItemBabonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false }),
        criticalBonusDice: new RollDataField({ required: false }),
        criticalBonusDamage: new RollDataField({ required: false }),
      }, { required: true }),
    });
  }
}

export class SaveBabonus extends ItemBabonus {
  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false })
      }, { required: true }),
      filters: new FiltersField({
        saveAbilities: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.saveAbilities.map(t => t.value) }), baseOptions),
      }, baseOptions)
    });
  }
}

export class ThrowBabonus extends Babonus {
  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false }),
        deathSaveTargetValue: new RollDataField({ required: false }),
      }, { required: true }),
      filters: new FiltersField({
        throwTypes: new SemicolonArrayField(new fields.StringField({ choices: KeyGetter.throwTypes.map(t => t.value) }), baseOptions),
      }, baseOptions)
    });
  }
}

export class HitDieBabonus extends Babonus {
  static defineSchema() {
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: true })
      }, { required: true }),
      filters: new FiltersField({}, baseOptions)
    })
  }
}
