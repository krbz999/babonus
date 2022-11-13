import {
  arbitraryOperators,
  auraTargets,
  itemsValidForAttackDamageSave,
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
  DisjointArraysField
} from "./dataFields.mjs";

class Babonus extends foundry.abstract.DataModel {

  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
  }

  toString() {
    return _babonusToString(this);
  }

  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return {
      id: new fields.DocumentIdField({ required: true, nullable: false }),
      name: new fields.StringField({ required: true, blank: false }),
      type: new fields.StringField({ required: true, blank: false, choices: TYPES.map(t => t.value) }),
      enabled: new fields.BooleanField({ required: true, initial: true }),
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
        macroConditions: new fields.StringField({ blank: false })
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
    console.warn(`The Creature Types filter consisted of only a single array, but has been migrated into an object of arrays.
    You can remove this warning by editing the babonus and then saving it immediately, with no changes made.
    Support for this automatic migration will be removed in Build-a-Bonus v1.4.0.`);
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new FiltersField({
        itemTypes: new NonEmptyArrayField(new fields.StringField({ choices: itemsValidForAttackDamageSave, blank: true }), baseOptions),
        attackTypes: new NonEmptyArrayField(new fields.StringField({ choices: KeyGetter.attackTypes.map(t => t.value), blank: true }), baseOptions),
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
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: true })
      }, { required: true })
    })
  }
}
