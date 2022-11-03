import { arbitraryOperators, itemsValidForAttackDamageSave, targetTypes } from "../constants.mjs";
import { KeyGetter } from "../helpers.mjs";
import { NonEmptySchemaField, RollDataField } from "./dataFields.mjs";

export class Babonus extends foundry.abstract.DataModel {
  static defineSchema() {
    const { fields } = foundry.data;
    return {
      //id: new fields.DocumentIdField(),
      name: new fields.StringField({ required: true, blank: false }),
      type: new fields.StringField({ required: true, blank: false, choices: targetTypes }),
      enabled: new fields.BooleanField({ required: true, initial: true }),
      description: new fields.StringField({ required: true, initial: "", blank: false }),
      bonuses: new NonEmptySchemaField({ // new field that requires at least one key
        bonus: new RollDataField({ required: false }), // make new field that validates roll data
        criticalBonusDice: new RollDataField({ required: false }), // make new field that validates roll data (and resolves to single integer?)
        criticalBonusDamage: new RollDataField({ required: false }),
        deathSaveTargetValue: new RollDataField({ required: false }),
        criticalRange: new RollDataField({ required: false }),
        fumbleRange: new RollDataField({ required: false }) // place all bonuses in an extension of this DataModel instead.
      }, { required: true }),
      aura: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        isTemplate: new fields.BooleanField({ required: true, initial: false }),
        range: new fields.NumberField({ min: -1, max: 500, step: 1, integer: true }), // make new field that is required if isTemplate is false?
        self: new fields.BooleanField({ required: true, initial: true }),
        disposition: new fields.NumberField({ required: true, initial: 2, choices: [-1, 1, 2] }),
        blockers: new fields.SetField(new fields.StringField(), { required: false })
      }, { required: false }),
      filters: new fields.SchemaField({
        itemTypes: new fields.SetField(new fields.StringField({ choices: itemsValidForAttackDamageSave }), { required: false }),
        throwTypes: new fields.SetField(new fields.StringField({ choices: KeyGetter.throwTypes }), { required: false }),
        attackTypes: new fields.SetField(new fields.StringField({ choices: KeyGetter.attackTypes }), { required: false }),
        damageTypes: new fields.SetField(new fields.StringField({ choices: KeyGetter.damageTypes }), { required: false }),
        abilities: new fields.SetField(new fields.StringField({ choices: KeyGetter.abilities }), { required: false }),
        saveAbilities: new fields.SetField(new fields.StringField({ choices: KeyGetter.saveAbilities }), { required: false }),
        itemRequirements: new fields.SchemaField({
          equipped: new fields.BooleanField({ required: false, initial: false }),
          attuned: new fields.BooleanField({ required: false, initial: false }) // extend once and override SchemaField._initialize to get what fields are needed.
        }),
        arbitraryComparison: new fields.ArrayField(new fields.SchemaField({
          one: new fields.StringField({ required: true }),
          other: new fields.StringField({ required: true }),
          operator: new fields.StringField({ required: true, choices: arbitraryOperators })
        }), { required: false }),
        statusEffects: new fields.SetField(new fields.StringField(), { required: false }),
        targetEffects: new fields.SetField(new fields.StringField(), { required: false }),
        spellComponents: new fields.SchemaField({
          types: new fields.SetField(new fields.StringField({ choices: KeyGetter.spellComponents }), { required: true }),
          match: new fields.StringField({ initial: "ALL", choices: ["ALL", "ANY"], required: true })
        }, { required: false }),
        spellLevels: new fields.SetField(new fields.NumberField({ choices: Array.fromRange(10) }), { required: false }),
        spellSchools: new fields.SetField(new fields.StringField({ choices: KeyGetter.spellSchools }), { required: false }),
        baseWeapons: new fields.SetField(new fields.StringField({ choices: KeyGetter.baseWeapons }), { required: false }),
        weaponProperties: new fields.SchemaField({
          needed: new fields.SetField(new fields.StringField({ choices: KeyGetter.weaponProperties }), { required: false }),
          unfit: new fields.SetField(new fields.StringField({ choices: KeyGetter.weaponProperties }), { required: false })
        }, { required: false })
      })
    }
  }
}
