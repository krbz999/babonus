import {
  ARBITRARY_OPERATORS,
  AURA_TARGETS,
  EQUIPPABLE_TYPES,
  ITEM_ROLL_TYPES,
  SPELL_COMPONENT_MATCHING,
  TYPES
} from "../constants.mjs";
import {KeyGetter} from "../helpers/helpers.mjs";
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
    const flattened = foundry.utils.flattenObject(this.toObject());
    const arb = "filters.arbitraryComparison";
    for (let i = 0; i < flattened[arb].length; i++) {
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
    return this.isOptional && (this.canConsumeUses || this.canConsumeQuantity || this.canConsumeSlots || this.canConsumeEffect);
  }

  // Whether the babonus is scaling.
  get isScaling() {
    if (!this.isConsuming) return false;
    if (!this.consume.scales) return false;
    if (this.consume.type === "effect") return false;
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

  // whether the babonus can be set to consume the effect on which it lives.
  get canConsumeEffect() {
    if (this.hasAura || this.isTemplateAura) return false;
    return this.parent instanceof ActiveEffect;
  }

  // Whether the babonus consumes uses or quantities of the item on which it is embedded, or slots on the rolling actor.
  get isConsuming() {
    if (!this.canConsume || !this.consume.enabled || !this.consume.type) return false;

    const type = this.consume.type;
    if (type === "uses") return this.canConsumeUses && this.item.isOwner && (this.consume.value.min > 0);
    else if (type === "quantity") return this.canConsumeQuantity && this.item.isOwner && (this.consume.value.min > 0);
    else if (type === "slots") return this.canConsumeSlots && (this.consume.value.min > 0);
    else if (type === "effect") return this.canConsumeEffect;
  }

  // Whether a babonus can be toggled to be optional.
  get isOptionable() {
    return !!this.bonuses?.bonus && ["attack", "damage", "throw"].includes(this.type);
  }

  // Whether a babonus is currently optional.
  get isOptional() {
    return this.isOptionable && this.optional;
  }

  // Whether the babonus is embedded on an item and valid to be 'item only'.
  get canExclude() {
    return (this.parent instanceof Item)
      && ["attack", "damage", "save"].includes(this.type)
      && ITEM_ROLL_TYPES.includes(this.item.type)
      && !this.hasAura && !this.isTemplateAura;
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
        type: new foundry.data.fields.StringField({required: false, nullable: true, initial: null, choices: ["", "uses", "quantity", "slots", "effect"]}),
        scales: new foundry.data.fields.BooleanField({required: false, nullable: false, initial: false}),
        formula: new foundry.data.fields.StringField(),
        value: new foundry.data.fields.SchemaField({
          min: new foundry.data.fields.NumberField({required: false, nullable: true, initial: null, integer: true, min: 1, step: 1}),
          max: new foundry.data.fields.NumberField({required: false, nullable: true, initial: null, integer: true, min: 1, step: 1}),
        })
      }),
      aura: new foundry.data.fields.SchemaField({
        enabled: new foundry.data.fields.BooleanField({required: false, initial: false}),
        isTemplate: new foundry.data.fields.BooleanField({required: false, initial: false}),
        range: new foundry.data.fields.NumberField({required: false, initial: null, min: -1, max: 500, step: 1, integer: true}),
        self: new foundry.data.fields.BooleanField({required: false, initial: true}),
        disposition: new foundry.data.fields.NumberField({required: false, initial: AURA_TARGETS.ANY, choices: Object.values(AURA_TARGETS)}),
        blockers: new SemicolonArrayField(new foundry.data.fields.StringField({blank: false}))
      }),
      filters: new foundry.data.fields.SchemaField({
        itemRequirements: new foundry.data.fields.SchemaField({
          equipped: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true}),
          attuned: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
        }),
        arbitraryComparison: new ArbitraryComparisonField(new foundry.data.fields.SchemaField({
          one: new foundry.data.fields.StringField({required: false, blank: false}),
          other: new foundry.data.fields.StringField({required: false, blank: false}),
          operator: new foundry.data.fields.StringField({required: false, choices: ARBITRARY_OPERATORS.map(t => t.value)})
        })),
        statusEffects: new SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        targetEffects: new SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        creatureTypes: new DisjointArraysField({
          needed: new SemicolonArrayField(new foundry.data.fields.StringField({blank: false}), {required: false}),
          unfit: new SemicolonArrayField(new foundry.data.fields.StringField({blank: false}), {required: false})
        }),
        customScripts: new foundry.data.fields.StringField({initial: null, nullable: true}),
        preparationModes: new SemicolonArrayField(new foundry.data.fields.StringField({choices: KeyGetter.preparationModes.map(t => t.value)})),
        remainingSpellSlots: new SpanField({
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
  }

  // Remove in v11.
  static _migrateCreatureTypes(source) {
    if (!source.filters?.creatureTypes || source.filters.creatureTypes.needed || source.filters.creatureTypes.unfit) return;
    const needed = source.filters.creatureTypes;
    source.filters.creatureTypes = {needed};
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new foundry.data.fields.SchemaField({
        itemTypes: new FilteredArrayField(new foundry.data.fields.StringField({
          choices: ITEM_ROLL_TYPES, blank: true
        })),
        attackTypes: new FilteredArrayField(new foundry.data.fields.StringField({
          choices: ["mwak", "rwak", "msak", "rsak"], blank: true
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
            nullable: true, initial: null, choices: Object.keys(SPELL_COMPONENT_MATCHING)
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
        deathSaveTargetValue: new foundry.data.fields.StringField()
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
