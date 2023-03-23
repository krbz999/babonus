import {
  ARBITRARY_OPERATORS,
  AURA_TARGETS,
  EQUIPPABLE_TYPES,
  ITEM_ROLL_TYPES,
  SPELL_COMPONENT_MATCHING,
  TYPES
} from "../constants.mjs";
import {KeyGetter} from "../helpers/helpers.mjs";
import {babonusFields} from "./dataFields.mjs";

class Babonus extends foundry.abstract.DataModel {

  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
  }

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    const filters = data.filters ?? {};

    if ((typeof filters.itemRequirements?.equipped !== "boolean") && (typeof filters.itemRequirements?.attuned !== "boolean")) {
      delete filters.itemRequirements;
    }

    if (!filters.arbitraryComparison?.length) {
      delete filters.arbitraryComparison;
    }

    if (!filters.statusEffects?.length) {
      delete filters.statusEffects;
    }

    if (!filters.targetEffects?.length) {
      delete filters.targetEffects;
    }

    if (!filters.creatureTypes?.length) {
      delete filters.creatureTypes;
    }

    if (!filters.customScripts) {
      delete filters.customScripts;
    }

    if (!filters.preparationModes?.length) {
      delete filters.preparationModes;
    }

    if (Object.values(filters.tokenSizes ?? {}).includes(null)) {
      delete filters.tokenSizes;
    }

    if ((filters.remainingSpellSlots?.min === null) && (filters.remainingSpellSlots?.max === null)) {
      delete filters.remainingSpellSlots;
    }

    return data;
  }

  toString() {
    const flattened = foundry.utils.flattenObject(this.toObject());
    const arb = "filters.arbitraryComparison";
    for (let i = 0; i < flattened[arb]?.length ?? 0; i++) {
      flattened[`${arb}.${i}`] = flattened[arb][i];
    }
    delete flattened[arb];

    for (const key of Object.keys(flattened)) {
      // Delete empty values (null, "", and empty arrays).
      const ie = flattened[key];
      if (ie === "" || ie === null || foundry.utils.isEmpty(ie)) {
        delete flattened[key];
      }
      else if (ie instanceof Array) {
        flattened[key] = ie.join(";");
      }
    }
    console.log(flattened);
    return foundry.utils.flattenObject(flattened);
  }

  toDragData() {
    const dragData = {type: "Babonus"};
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

  // Whether the babonus can show the Consumption app in the builder.
  get canConsume() {
    return this.isOptional && (this.canConsumeUses || this.canConsumeQuantity || this.canConsumeSlots || this.canConsumeEffect || this.canConsumeHealth);
  }

  // Whether the babonus is scaling.
  get isScaling() {
    if (!this.isConsuming) return false;
    if (!this.consume.scales) return false;
    if (this.consume.type === "effect") return false;
    if ((this.consume.type === "health") && !(this.consume.value.step > 0)) return false;
    return (this.consume.value.max || Infinity) > this.consume.value.min;
  }

  // Whether the babonus can be set to consume limited uses of its parent item.
  get canConsumeUses() {
    if (this.hasAura || this.isTemplateAura) return false;
    return (this.parent instanceof Item) && this.parent.hasLimitedUses;
  }

  // Whether the babonus can be set to consume quantities of its parent item.
  get canConsumeQuantity() {
    if (this.hasAura || this.isTemplateAura) return false;
    return (this.parent instanceof Item) && (this.parent.system.quantity !== undefined);
  }

  // Whether the babonus can be set to consume spell slots of its owning actor.
  get canConsumeSlots() {
    return true;
  }

  // Whether the babonus can be set to consume hit points of its owning actor.
  get canConsumeHealth() {
    return true;
  }

  // whether the babonus can be set to consume the effect on which it lives.
  get canConsumeEffect() {
    if (this.hasAura || this.isTemplateAura) return false;
    return this.parent instanceof ActiveEffect;
  }

  // Whether the babonus consumes uses or quantities of the item on which it is embedded, or slots on the rolling actor.
  get isConsuming() {
    if (!this.canConsume || !this.consume.enabled || !this.consume.type) return false;

    const type = this.consume.type;
    const value = this.consume.value;

    if (type === "uses") return this.canConsumeUses && this.item.isOwner && (value.min > 0);
    else if (type === "quantity") return this.canConsumeQuantity && this.item.isOwner && (value.min > 0);
    else if (type === "slots") return this.canConsumeSlots && (value.min > 0);
    else if (type === "effect") return this.canConsumeEffect;
    else if (type === "health") return this.canConsumeHealth && (value.min > 0);
  }

  // Whether a babonus can be toggled to be optional.
  get isOptionable() {
    return !!this.bonuses?.bonus && ["attack", "damage", "throw", "test"].includes(this.type);
  }

  // Whether a babonus is currently optional.
  get isOptional() {
    return this.isOptionable && this.optional;
  }

  // Whether the babonus is embedded on an item and valid to be 'item only'.
  get canExclude() {
    if (!(this.parent instanceof Item)) return false;

    // Valid for attack/damage/save:
    const validityA = ["attack", "damage", "save"].includes(this.type) && ITEM_ROLL_TYPES.includes(this.item.type);

    // Valid for test:
    const validityB = (this.type === "test") && (this.item.type === "tool");

    return (validityA || validityB) && !this.hasAura && !this.isTemplateAura;
  }

  // whether a bonus is currently only possible to apply to its parent item.
  get isExclusive() {
    return this.itemOnly && this.canExclude;
  }

  // Whether the babonus is unavailable due to its item being unequipped or unattuned (if it can be).
  get isSuppressed() {
    let item = this.parent;
    // It's not an item.
    if (!(item instanceof Item)) item = this.item;
    // It's not an equippable/attunable item.
    if (!EQUIPPABLE_TYPES.includes(item?.type)) return false;

    const ir = this.filters.itemRequirements;
    const at = CONFIG.DND5E.attunementTypes.ATTUNED;
    // The item is not attuned and does require attunement.
    return ((item.system.attunement !== at) && ir.attuned) || (!item.system.equipped && ir.equipped);
  }

  // Whether a babonus is currently an enabled and valid aura.
  get hasAura() {
    return this.aura.enabled && ((this.aura.range === -1) || (this.aura.range > 0)) && !this.aura.isTemplate;
  }

  // Whether this aura is blocked by any of its owner's blockers.
  get isAuraBlocked() {
    const blockers = this.aura.blockers;
    if (!blockers.length) return false;

    return this.actor?.effects.some(effect => {
      if (!effect.modifiesActor) return false;
      const id = effect.getFlag("core", "statusId");
      return !!id && blockers.includes(id);
    }) ?? false;
  }

  // Whether this babonus affects a template.
  get isTemplateAura() {
    return this.aura.enabled && this.aura.isTemplate && !!this.item?.hasAreaTarget;
  }

  // Whether a babonus has any valid bonuses.
  get hasBonus() {
    return Object.values(this.bonuses).some(val => !!val && (val !== "0"));
  }

  // The source item or actor of a babonus. Attempts to always return the original source item or actor.
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const origin = this.parent.flags.dnd5e?.origin ?? "";
      return fromUuidSync(origin);
    }

    else if (this.parent instanceof ActiveEffect) {
      const origin = fromUuidSync(this.parent.origin ?? "");
      if (origin instanceof TokenDocument) return origin.actor;
      return origin;
    }

    else if (this.parent instanceof Item) {
      return this.parent;
    }

    else if (this.parent instanceof Actor) {
      return this.parent;
    }
  }

  // The actor who is the general source of the babonus, even if the bonus is on an item, effect, or template.
  get actor() {
    if (this.parent instanceof Actor) return this.parent;
    if (this.parent?.parent instanceof Actor) return this.parent.parent;
    return this.item?.parent ?? null;
  }

  // The token whose actor has the bonus.
  get token() {
    let actor;
    if ((this.parent instanceof Item) || (this.parent instanceof ActiveEffect)) {
      actor = this.parent.parent;
    } else if (this.parent instanceof Actor) {
      actor = this.parent;
    }
    if (!actor) return null;

    const token = actor.token?.object ?? actor.getActiveTokens()[0];
    if (token) return token;
    return null;
  }

  // The item that has the babonus, or created the template that has it.
  get item() {
    if (this.parent instanceof Item) return this.parent;
    if (this.parent instanceof MeasuredTemplateDocument) {
      const origin = this.parent.flags.dnd5e?.origin ?? "";
      return fromUuidSync(origin);
    }
    return null;
  }

  // The effect that has the babonus, if any.
  get effect() {
    if (this.parent instanceof ActiveEffect) return this.parent;
    return null;
  }

  // The template that has the babonus, if any.
  get template() {
    if (this.parent instanceof MeasuredTemplateDocument) return this.parent;
    return null;
  }

  static defineSchema() {
    return {
      id: new foundry.data.fields.DocumentIdField({required: true, nullable: false}),
      name: new foundry.data.fields.StringField({required: true, blank: false}),
      type: new foundry.data.fields.StringField({required: true, blank: false, choices: TYPES.map(t => t.value)}),
      enabled: new foundry.data.fields.BooleanField({required: true, initial: true}),
      itemOnly: new foundry.data.fields.BooleanField({required: true, initial: false}),
      optional: new foundry.data.fields.BooleanField({required: true, initial: false}),
      description: new foundry.data.fields.StringField({required: true, blank: true}),
      consume: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({required: false, nullable: false, initial: false}),
        type: new foundry.data.fields.StringField({required: false, nullable: true, initial: null, choices: ["", "uses", "quantity", "slots", "health", "effect"]}),
        scales: new foundry.data.fields.BooleanField({required: false, nullable: false, initial: false}),
        formula: new foundry.data.fields.StringField(),
        value: new foundry.data.fields.SchemaField({
          min: new foundry.data.fields.NumberField({required: false, nullable: true, initial: null, integer: true, min: 1, step: 1}),
          max: new foundry.data.fields.NumberField({required: false, nullable: true, initial: null, integer: true, min: 1, step: 1}),
          step: new foundry.data.fields.NumberField({required: false, nullable: true, initial: null, integer: true, min: 1, step: 1})
        })
      }),
      aura: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({required: false, initial: false}),
        isTemplate: new foundry.data.fields.BooleanField({required: false, initial: false}),
        range: new foundry.data.fields.NumberField({required: false, initial: null, min: -1, max: 500, step: 1, integer: true}),
        self: new foundry.data.fields.BooleanField({required: false, initial: true}),
        disposition: new foundry.data.fields.NumberField({required: false, initial: AURA_TARGETS.ANY, choices: Object.values(AURA_TARGETS)}),
        blockers: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false}))
      }),
      filters: new foundry.data.fields.SchemaField({
        itemRequirements: new foundry.data.fields.SchemaField({
          equipped: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true}),
          attuned: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
        }),
        arbitraryComparison: new babonusFields.ArbitraryComparisonField(new foundry.data.fields.SchemaField({
          one: new foundry.data.fields.StringField({required: false, blank: false}),
          other: new foundry.data.fields.StringField({required: false, blank: false}),
          operator: new foundry.data.fields.StringField({required: false, choices: ARBITRARY_OPERATORS.map(t => t.value)})
        })),
        statusEffects: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        targetEffects: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        creatureTypes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        customScripts: new foundry.data.fields.StringField({initial: null, nullable: true}),
        preparationModes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({choices: KeyGetter.preparationModes.map(t => t.value)})),
        tokenSizes: new babonusFields.TokenSizeField({
          size: new foundry.data.fields.NumberField({initial: null, min: 0.5, step: 0.5, integer: false, nullable: true}),
          type: new foundry.data.fields.NumberField({choices: [0, 1], nullable: true}),
          self: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
        }),
        remainingSpellSlots: new babonusFields.SpanField({
          min: new foundry.data.fields.NumberField({required: false, initial: null, min: 0, step: 1, integer: true, nullable: true}),
          max: new foundry.data.fields.NumberField({required: false, initial: null, min: 0, step: 1, integer: true, nullable: true})
        })
      }, {nullable: false, initial: {}})
    };
  }

  clone(data = {}, context = {}) {
    data = foundry.utils.mergeObject(this.toObject(), data, {insertKeys: false, performDeletions: true, inplace: true});
    context.parent ??= this.parent;
    return new this.constructor(data, context);
  }

  static migrateData(source) {
    if (!source.filters) source.filters = {};
    this._migrateCreatureTypes(source);
    this._migrateWeaponProperties(source);
  }

  // Remove in v11.
  static _migrateCreatureTypes(source) {
    const types = source.filters.creatureTypes;
    if (!types || (types instanceof Array) || (typeof types === "string")) return;
    console.warn("A babonus is using an outdated format for 'Creature Types'. Editing and saving the bonus with no changes made will resolve this warning.");
    console.warn("The old format will be supported until FVTT v11.");
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.creatureTypes = c;
  }

  static _migrateWeaponProperties(source) {
    const types = source.filters.weaponProperties;
    if (!types || (types instanceof Array) || (typeof types === "string")) return;
    console.warn("A babonus is using an outdated format for 'Weapon Properties'. Editing and saving the bonus with no changes made will resolve this warning.");
    console.warn("The old format will be supported until FVTT v11.");
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.weaponProperties = c;
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    const filters = data.filters ?? {};

    if (!filters.itemTypes?.length) {
      delete filters.itemTypes;
    }

    if (!filters.attackTypes?.length) {
      delete filters.attackTypes;
    }

    if (!filters.damageTypes?.length) {
      delete filters.damageTypes;
    }

    if (!filters.abilities?.length) {
      delete filters.abilities;
    }

    if (!filters.spellComponents?.types.length) {
      delete filters.spellComponents;
    }

    if (!filters.spellLevels?.length) {
      delete filters.spellLevels;
    }

    if (!filters.spellSchools?.length) {
      delete filters.spellSchools;
    }

    if (!filters.baseWeapons?.length) {
      delete filters.baseWeapons;
    }

    if (!filters.weaponProperties?.length) {
      delete filters.weaponProperties;
    }

    return data;
  }

  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new foundry.data.fields.SchemaField({
        itemTypes: new babonusFields.FilteredArrayField(new foundry.data.fields.StringField({
          choices: ITEM_ROLL_TYPES, blank: true
        })),
        attackTypes: new babonusFields.FilteredArrayField(new foundry.data.fields.StringField({
          choices: ["mwak", "rwak", "msak", "rsak"], blank: true
        })),
        damageTypes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.damageTypes.flatMap(({value}) => [value, `!${value}`])
        })),
        abilities: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.abilities.map(t => t.value)
        })),
        spellComponents: new foundry.data.fields.SchemaField({
          types: new babonusFields.FilteredArrayField(new foundry.data.fields.StringField({
            choices: KeyGetter.spellComponents.map(t => t.value), blank: true
          })),
          match: new foundry.data.fields.StringField({
            nullable: true, initial: null, choices: Object.keys(SPELL_COMPONENT_MATCHING)
          })
        }),
        spellLevels: new babonusFields.FilteredArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.spellLevels.map(t => t.value), blank: true
        })),
        spellSchools: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.spellSchools.map(t => t.value)
        })),
        baseWeapons: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.baseWeapons.map(t => t.value)
        })),
        weaponProperties: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.weaponProperties.flatMap(({value}) => [value, `!${value}`])
        }))
      })
    });
  };
}

export class AttackBabonus extends ItemBabonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField(),
        criticalRange: new foundry.data.fields.StringField(),
        fumbleRange: new foundry.data.fields.StringField()
      })
    });
  }
}

export class DamageBabonus extends ItemBabonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField(),
        criticalBonusDice: new foundry.data.fields.StringField(),
        criticalBonusDamage: new foundry.data.fields.StringField()
      })
    });
  }
}

export class SaveBabonus extends ItemBabonus {

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    const filters = data.filters ?? {};

    if (!filters.saveAbilities?.length) {
      delete filters.saveAbilities;
    }

    return data;
  }

  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new foundry.data.fields.SchemaField({
        saveAbilities: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.saveAbilities.map(t => t.value)
        }))
      })
    });
  }
}

export class ThrowBabonus extends Babonus {

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    const filters = data.filters ?? {};

    if (!filters.throwTypes?.length) {
      delete filters.throwTypes;
    }

    return data;
  }

  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField(),
        deathSaveTargetValue: new foundry.data.fields.StringField(),
        deathSaveCritical: new foundry.data.fields.StringField()
      }),
      filters: new foundry.data.fields.SchemaField({
        throwTypes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.throwTypes.map(t => t.value)
        }))
      })
    });
  }
}

export class TestBabonus extends Babonus {

  /** @override */
  toObject(source = true) {
    const data = super.toObject(source);
    const filters = data.filters ?? {};

    if (!filters.abilities?.length) {
      delete filters.abilities;
    }

    if (!filters.baseTools?.length) {
      delete filters.baseTools;
    }

    if (!filters.skillIds?.length) {
      delete filters.skillIds;
    }

    return data;
  }

  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new foundry.data.fields.SchemaField({
        abilities: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.abilities.map(t => t.value)
        })),
        baseTools: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.baseTools.map(t => t.value)
        })),
        skillIds: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.skillIds.map(t => t.value)
        }))
      })
    });
  }
}

export class HitDieBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new foundry.data.fields.SchemaField({})
    })
  }
}
