import {
  ARBITRARY_OPERATORS,
  ATTACK_TYPES,
  AURA_TARGETS,
  CONSUMPTION_TYPES,
  EQUIPPABLE_TYPES,
  ITEM_ONLY_BONUS_TYPES,
  ITEM_ROLL_TYPES,
  SPELL_COMPONENT_MATCHING,
  TYPES
} from "../constants.mjs";
import { KeyGetter, _babonusToString } from "../helpers/helpers.mjs";
import {
  SemicolonArrayField,
  FilteredArrayField,
  ArbitraryComparisonField,
  DisjointArraysField,
  SpanField
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

  // whether the bonus can scale and what the range is.
  getConsumptionOptions() {
    if (!this.isConsuming) return [];
    const is = this.item.system;
    const value = this.consume.value;
    const itemMax = this.consume.type === "uses" ? is.uses.value : is.quantity;
    if (!this.consume.scales) return itemMax >= value.min ? [value.min] : [];
    if (value.min > value.max) return [];
    const max = Math.min(value.max, itemMax);
    return Array.fromRange(max, 1).filter(n => n >= value.min);
  }

  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  // whether the bonus can be set to consume uses or quantities of the item on which it is embedded.
  get canConsume() {
    const isItem = this.parent instanceof Item;
    if (!isItem) return false;
    const canUse = this.item.hasLimitedUses;
    const canQty = this.item.system.quantity !== undefined;
    return (canUse || canQty) && !this.hasAura && !this.isTemplateAura && this.isOptional;
  }

  // whether the bonus consumes uses or quantities of the item on which it is embedded.
  get isConsuming() {
    return this.canConsume && this.consume.enabled && this.item.isOwner && this.consume.value.min > 0
      && ((this.consume.type === "uses" && this.item.hasLimitedUses)
        || (this.consume.type === "quantity" && this.item.system.quantity !== undefined));
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
  get canExclude() {
    return (this.parent instanceof Item)
      && ITEM_ONLY_BONUS_TYPES.includes(this.type)
      && ITEM_ROLL_TYPES.includes(this.item.type)
      && !this.hasAura && !this.isTemplateAura;
  }

  // whether a bonus is currently only possible to apply to its parent item.
  get isExclusive() {
    return this.itemOnly && this.canExclude;
  }

  // whether the bonus is unavailable due to its item being unequipped or unattuned (if it can be).
  get isSuppressed() {
    const item = this.parent;
    // It's not an item.
    if (!(item instanceof Item)) return false;
    // It's not an equippable/attunable item.
    if (!EQUIPPABLE_TYPES.includes(item.type)) return false;

    const ir = this.filters.itemRequirements;
    const at = CONFIG.DND5E.attunementTypes.ATTUNED;
    // The item is not attuned and does require attunement.
    return (item.system.attunement !== at && ir.attuned) || (!item.system.equipped && ir.equipped);
  }

  // whether a bonus is currently an enabled and valid aura.
  get hasAura() {
    return this.aura.enabled && (this.aura.range === -1 || this.aura.range > 0) && !this.aura.isTemplate;
  }

  // whether this aura is blocked by any of its owner's blockers.
  get isAuraBlocked() {
    const blockers = this.aura.blockers;
    if (!blockers.length) return false;

    return this.actor?.effects.some(effect => {
      if (!effect.modifiesActor) return false;
      const id = effect.getFlag("core", "statusId");
      return !!id && blockers.includes(id);
    }) ?? false;
  }

  // whether this bonus affects a template.
  get isTemplateAura() {
    return this.aura.enabled && this.aura.isTemplate && !!this.item?.hasAreaTarget;
  }

  // whether a bonus has any valid bonuses.
  get hasBonus() {
    return Object.values(this.bonuses).some(val => !!val && val !== "0");
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
    return {
      id: new foundry.data.fields.DocumentIdField({ required: true, nullable: false }),
      name: new foundry.data.fields.StringField({ required: true, blank: false }),
      type: new foundry.data.fields.StringField({ required: true, blank: false, choices: TYPES.map(t => t.value) }),
      enabled: new foundry.data.fields.BooleanField({ required: true, initial: true }),
      itemOnly: new foundry.data.fields.BooleanField({ required: true, initial: false }),
      optional: new foundry.data.fields.BooleanField({ required: true, initial: false }),
      description: new foundry.data.fields.StringField({ required: true, blank: true }),
      consume: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({ required: false, nullable: false, initial: false }),
        type: new foundry.data.fields.StringField({ required: false, nullable: true, initial: null, choices: CONSUMPTION_TYPES }),
        scales: new foundry.data.fields.BooleanField({ required: false, nullable: false, initial: false }),
        value: new foundry.data.fields.SchemaField({
          min: new foundry.data.fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 1, step: 1 }),
          max: new foundry.data.fields.NumberField({ required: false, nullable: true, initial: null, integer: true, min: 1, step: 1 }),
        })
      }),
      aura: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({ required: false, initial: false }),
        isTemplate: new foundry.data.fields.BooleanField({ required: false, initial: false }),
        range: new foundry.data.fields.NumberField({ required: false, initial: null, min: -1, max: 500, step: 1, integer: true }),
        self: new foundry.data.fields.BooleanField({ required: false, initial: true }),
        disposition: new foundry.data.fields.NumberField({ required: false, initial: AURA_TARGETS.ANY, choices: Object.values(AURA_TARGETS) }),
        blockers: new SemicolonArrayField(new foundry.data.fields.StringField({ blank: false }))
      }),
      filters: new foundry.data.fields.SchemaField({
        itemRequirements: new foundry.data.fields.SchemaField({
          equipped: new foundry.data.fields.BooleanField({ required: false, initial: null, nullable: true }),
          attuned: new foundry.data.fields.BooleanField({ required: false, initial: null, nullable: true })
        }),
        arbitraryComparison: new ArbitraryComparisonField(new foundry.data.fields.SchemaField({
          one: new foundry.data.fields.StringField({ required: false, blank: false }),
          other: new foundry.data.fields.StringField({ required: false, blank: false }),
          operator: new foundry.data.fields.StringField({ required: false, choices: ARBITRARY_OPERATORS.map(t => t.value) })
        })),
        statusEffects: new SemicolonArrayField(new foundry.data.fields.StringField({ blank: false })),
        targetEffects: new SemicolonArrayField(new foundry.data.fields.StringField({ blank: false })),
        creatureTypes: new DisjointArraysField({
          needed: new SemicolonArrayField(new foundry.data.fields.StringField({ blank: false }), { required: false }),
          unfit: new SemicolonArrayField(new foundry.data.fields.StringField({ blank: false }), { required: false })
        }),
        customScripts: new foundry.data.fields.StringField({ initial: null, nullable: true }),
        remainingSpellSlots: new SpanField({
          min: new foundry.data.fields.NumberField({ required: false, initial: null, min: 0, step: 1, integer: true, nullable: true }),
          max: new foundry.data.fields.NumberField({ required: false, initial: null, min: 0, step: 1, integer: true, nullable: true })
        })
      }, { nullable: false, initial: {} })
    };
  }

  static migrateData(source) {
    if (!source.filters) source.filters = {};
    this._migrateCreatureTypes(source);
  }

  // Remove in v11.
  static _migrateCreatureTypes(source) {
    if (!source.filters?.creatureTypes || source.filters.creatureTypes.needed || source.filters.creatureTypes.unfit) return;
    const needed = source.filters.creatureTypes;
    source.filters.creatureTypes = { needed };
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new foundry.data.fields.SchemaField({
        itemTypes: new FilteredArrayField(new foundry.data.fields.StringField({
          choices: ITEM_ROLL_TYPES,
          blank: true
        })),
        attackTypes: new FilteredArrayField(new foundry.data.fields.StringField({
          choices: ATTACK_TYPES,
          blank: true
        })),
        damageTypes: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.damageTypes.map(t => t.value)
        })),
        abilities: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.abilities.map(t => t.value)
        })),
        spellComponents: new foundry.data.fields.SchemaField({
          types: new FilteredArrayField(new foundry.data.fields.StringField({
            choices: KeyGetter.spellComponents.map(t => t.value), blank: true
          })),
          match: new foundry.data.fields.StringField({
            nullable: true, initial: null,
            choices: Object.keys(SPELL_COMPONENT_MATCHING)
          })
        }),
        spellLevels: new FilteredArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.spellLevels.map(t => t.value), blank: true
        })),
        spellSchools: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.spellSchools.map(t => t.value)
        })),
        baseWeapons: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.baseWeapons.map(t => t.value)
        })),
        weaponProperties: new DisjointArraysField({
          needed: new SemicolonArrayField(new foundry.data.fields.StringField({
            choices: KeyGetter.weaponProperties.map(t => t.value)
          })),
          unfit: new SemicolonArrayField(new foundry.data.fields.StringField({
            choices: KeyGetter.weaponProperties.map(t => t.value)
          }))
        })
      })
    });
  }
}

export class AttackBabonus extends ItemBabonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField(),
        criticalRange: new foundry.data.fields.StringField(),
        criticalRangeFlat: new foundry.data.fields.BooleanField({ initial: false }),
        fumbleRange: new foundry.data.fields.StringField(),
        fumbleRangeFlat: new foundry.data.fields.BooleanField({ initial: false })
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
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new foundry.data.fields.SchemaField({
        saveAbilities: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.saveAbilities.map(t => t.value)
        }))
      })
    });
  }
}

export class ThrowBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new foundry.data.fields.SchemaField({
        bonus: new foundry.data.fields.StringField(),
        deathSaveTargetValue: new foundry.data.fields.StringField(),
        deathSaveTargetValueFlat: new foundry.data.fields.BooleanField({ initial: false })
      }),
      filters: new foundry.data.fields.SchemaField({
        throwTypes: new SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.throwTypes.map(t => t.value)
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
