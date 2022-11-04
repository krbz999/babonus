import { arbitraryOperators, itemsValidForAttackDamageSave, MATCH, TYPES } from "../constants.mjs";
import { KeyGetter } from "../helpers.mjs";
import { FiltersField, BonusesField, RollDataField, AuraField, SpellComponentsField, WeaponPropertiesField } from "./dataFields.mjs";

export class Babonus extends foundry.abstract.DataModel {

  constructor(data, options = {}) {
    super(foundry.utils.expandObject(data), options);
  }

  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return {
      //id: new fields.DocumentIdField(),
      name: new fields.StringField({ required: true, blank: false }),
      type: new fields.StringField({ required: true, blank: false, choices: TYPES.map(t => t.value) }),
      enabled: new fields.BooleanField({ required: true, initial: true }),
      description: new fields.StringField({ required: true, blank: false }),
      aura: new AuraField({
        enabled: new fields.BooleanField({ required: false, initial: true }),
        isTemplate: new fields.BooleanField({ required: false, initial: false }),
        range: new fields.NumberField({ required: false, initial: null, min: -1, max: 500, step: 1, integer: true }),
        self: new fields.BooleanField({ required: false, initial: true }),
        disposition: new fields.NumberField({ required: false, initial: 2, choices: [-1, 1, 2] }),
        blockers: new fields.SetField(new fields.StringField(), baseOptions)
      }, baseOptions),
      filters: new FiltersField({
        itemRequirements: new fields.SchemaField({ // extend once and override SchemaField._initialize to get what fields are needed.
          equipped: new fields.BooleanField({ required: false, initial: false }),
          attuned: new fields.BooleanField({ required: false, initial: false })
        }, baseOptions),
        arbitraryComparison: new fields.ArrayField(new fields.SchemaField({
          one: new fields.StringField({ required: true, blank:false }),
          other: new fields.StringField({ required: true, blank:false }),
          operator: new fields.StringField({ required: true, choices: arbitraryOperators.map(t => t.value) })
        }), baseOptions),
        statusEffects: new fields.SetField(new fields.StringField(), baseOptions),
        targetEffects: new fields.SetField(new fields.StringField(), baseOptions),
      }, baseOptions)
    };
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
export class ItemBabonus extends Babonus {
  constructor(data, options = {}) {
    super(data, options);
  }

  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new FiltersField({
        itemTypes: new fields.SetField(new fields.StringField({ ...baseOptions, choices: itemsValidForAttackDamageSave }), baseOptions),
        attackTypes: new fields.SetField(new fields.StringField({ ...baseOptions, choices: KeyGetter.attackTypes.map(t => t.value) }), baseOptions),
        damageTypes: new fields.SetField(new fields.StringField({ choices: KeyGetter.damageTypes.map(t => t.value) }), baseOptions),
        abilities: new fields.SetField(new fields.StringField({ choices: KeyGetter.abilities.map(t => t.value) }), baseOptions),
        spellComponents: new SpellComponentsField({
          types: new fields.SetField(new fields.StringField({ ...baseOptions, choices: KeyGetter.spellComponents.map(t => t.value) }), { required: false }),
          match: new fields.StringField({ initial: "ALL", choices: Object.keys(MATCH), required: false })
        }, baseOptions),
        spellLevels: new fields.SetField(new fields.NumberField({ ...baseOptions, choices: Array.fromRange(10) }), baseOptions),
        spellSchools: new fields.SetField(new fields.StringField({ choices: KeyGetter.spellSchools.map(t => t.value) }), baseOptions),
        baseWeapons: new fields.SetField(new fields.StringField({ choices: KeyGetter.baseWeapons.map(t => t.value) }), baseOptions),
        weaponProperties: new WeaponPropertiesField({
          needed: new fields.SetField(new fields.StringField({ choices: KeyGetter.weaponProperties.map(t => t.value) }), { required: false }),
          unfit: new fields.SetField(new fields.StringField({ choices: KeyGetter.weaponProperties.map(t => t.value) }), { required: false })
        }, baseOptions)
      })
    });
  }
}

export class AttackBabonus extends ItemBabonus {
  constructor(data, options = {}) {
    super(data, options);
  }

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
  constructor(data, options = {}) {
    super(data, options);
  }

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
  constructor(data, options = {}) {
    super(data, options);
  }

  static defineSchema() {
    const { fields } = foundry.data;
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false })
      }, { required: true }),
      filters: new FiltersField({
        saveAbilities: new fields.SetField(new fields.StringField({ choices: KeyGetter.saveAbilities }), baseOptions),
      }, { required: false })
    });
  }
}

export class ThrowBabonus extends Babonus {
  constructor(data, options = {}) {
    super(data, options);
  }

  static defineSchema() {
    const baseOptions = { required: false, nullable: true, initial: undefined };

    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: false }),
        deathSaveTargetValue: new RollDataField({ required: false }),
      }, { required: true }),
      filters: new FiltersField({
        throwTypes: new fields.SetField(new fields.StringField({ choices: KeyGetter.throwTypes }), { required: false }),
      }, baseOptions)
    });
  }
}

export class HitDieBabonus extends Babonus {
  constructor(data, options = {}) {
    super(data, options);
  }

  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new BonusesField({
        bonus: new RollDataField({ required: true })
      }, { required: true })
    })
  }
}
