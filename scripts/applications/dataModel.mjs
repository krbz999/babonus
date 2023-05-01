import {
  ARBITRARY_OPERATORS,
  AURA_TARGETS,
  EQUIPPABLE_TYPES,
  ITEM_ROLL_TYPES,
  SPELL_COMPONENT_MATCHING,
  TYPES
} from "../constants.mjs";
import {KeyGetter} from "../helpers/helpers.mjs";
import {_bonusToInt} from "../hooks.mjs";
import {babonusFields} from "./dataFields.mjs";

class Babonus extends foundry.abstract.DataModel {
  constructor(data, options = {}) {
    const expData = foundry.utils.expandObject(data);
    super(expData, options);
  }

  /** @override */
  toObject(source = false) {
    return super.toObject(source);
  }

  /** @override */
  toString() {
    const flattened = foundry.utils.flattenObject(this.toObject());
    const arb = "filters.arbitraryComparison";
    for (let i = 0; i < (flattened[arb]?.length ?? 0); i++) {
      flattened[`${arb}.${i}`] = flattened[arb][i];
    }
    delete flattened[arb];

    for (const key of Object.keys(flattened)) {
      // Delete empty values (null, "", and empty arrays).
      const ie = flattened[key];
      if ((ie === "") || (ie === null) || foundry.utils.isEmpty(ie)) {
        delete flattened[key];
      }
      else if (ie instanceof Array) {
        flattened[key] = ie.join(";");
      }
    }
    return foundry.utils.flattenObject(flattened);
  }

  /** @override */
  toDragData() {
    const dragData = {type: "Babonus"};
    if (this.parent) {
      dragData.uuid = this.parent.uuid;
      dragData.babId = this.id;
    }
    else dragData.data = this.toObject();
    return dragData;
  }

  /**
   * A formatted uuid of a babonus, an extension of its parent's uuid.
   * @returns {string}
   */
  get uuid() {
    return `${this.parent.uuid}.Babonus.${this.id}`;
  }

  /**
   * Whether the babonus can open the Consumption app in the builder, which requires that it is Optional and has at least
   * one option in the 'type' available.
   * @returns {boolean}
   */
  get canConsume() {
    if (!this.isOptional) return false;
    return [
      this.canConsumeUses,
      this.canConsumeQuantity,
      this.canConsumeSlots,
      this.canConsumeEffect,
      this.canConsumeHealth
    ].some(a => a);
  }

  /**
   * Whether the bonus is scaling when consuming, which requires that it is consuming, has 'scales' set to true, and does
   * not consume an effect, which cannot scale. If the type is 'health', then 'step' must be 1 or greater. Otherwise the
   * 'max', if set, must be strictly greater than 'min'.
   * @returns {boolean}
   */
  get isScaling() {
    if (!this.isConsuming) return false;
    if (!this.consume.scales) return false;
    if (this.consume.type === "effect") return false;
    if ((this.consume.type === "health") && !(this.consume.value.step > 0)) return false;
    return (this.consume.value.max || Infinity) > this.consume.value.min;
  }

  /**
   * Whether 'Limited Uses' should be a valid option in the Consumption app. The babonus must not be an aura, template aura,
   * and must be embedded on an item that has limited uses.
   * @returns {boolean}
   */
  get canConsumeUses() {
    if (this.isTokenAura || this.isTemplateAura) return false;
    return (this.parent instanceof Item) && this.parent.hasLimitedUses;
  }

  /**
   * Whether 'Quantity' should be a valid option in the Consumption app. The babonus must not be an aura, template aura, and
   * must be embedded on an item that has a quantity.
   * @returns {boolean}
   */
  get canConsumeQuantity() {
    if (this.isTokenAura || this.isTemplateAura) return false;
    return (this.parent instanceof Item) && Number.isNumeric(this.parent.system.quantity);
  }

  /**
   * Whether 'Spell Slots' should be a valid option in the Consumption app. Since this works fine as an aura, there are no
   * restrictions to apply here, and it always returns true.
   * @returns {boolean}
   */
  get canConsumeSlots() {
    return true;
  }

  /**
   * Whether 'Hit Points' should be a valid option in the Consumption app. Since this works fine as an aura, there are no
   * restrictions to apply here, and it always returns true.
   * @returns {boolean}
   */
  get canConsumeHealth() {
    return true;
  }

  /**
   * Whether 'Effect' should be a valid option in the Consumption app. The babonus must not be an aura, template aura, and
   * must be embedded on an effect.
   * @returns {boolean}
   */
  get canConsumeEffect() {
    return (this.parent instanceof ActiveEffect) && !this.isTokenAura && !this.isTemplateAura;
  }

  /**
   * Whether the consumption data on the babonus creates valid consumption for the optional bonus application when rolling.
   * If it does not, the babonus is ignored there.
   *
   * - For limited uses, only users who own the item in question are allowed to edit it by subtracting uses, and the minimum
   * required value must be a positive integer.
   * - For quantity, only users who own the item in question are allowed to edit it by subtracting quantities, and the
   * minimum required value must be a positive integer.
   * - For spell slots, the minimum required spell slot level must be a positive integer.
   * - For effects, only users who own the effect in question are allowed to delete it.
   * @returns {boolean}
   */
  get isConsuming() {
    if (!this.canConsume || !this.consume.enabled || !this.consume.type) return false;

    const type = this.consume.type;
    const value = this.consume.value;
    const isItemOwner = (this.parent instanceof Item) && this.parent.isOwner;
    const isEffectOwner = (this.parent instanceof ActiveEffect) && this.parent.isOwner;

    if (type === "uses") return this.canConsumeUses && isItemOwner && (value.min > 0);
    else if (type === "quantity") return this.canConsumeQuantity && isItemOwner && (value.min > 0);
    else if (type === "slots") return this.canConsumeSlots && (value.min > 0);
    else if (type === "effect") return this.canConsumeEffect && isEffectOwner;
    else if (type === "health") return this.canConsumeHealth && (value.min > 0);
  }

  /**
   * Whether the bonus can toggle the 'Optional' icon in the builder. This requires that it applies to attack rolls, damage
   * rolls, saving throws, or ability checks; any of the rolls that have a roll configuration dialog. The babonus must also
   * apply an additive bonus on top, i.e., something that can normally go in the 'Situational Bonus' input.
   * TODO: once hit die rolls have a dialog as well, this should be amended.
   * TODO: once rolls can be "remade" in 2.2.0, optional bonuses should be able to apply to other properties as well.
   * @returns {boolean}
   */
  get isOptionable() {
    return ["attack", "damage", "throw", "test"].includes(this.type) && !!this.bonuses.bonus;
  }

  /**
   * Whether a babonus is currently optional, which is only true if it is both able to be optional, and toggled as such.
   * @returns {boolean}
   */
  get isOptional() {
    return this.optional && this.isOptionable;
  }

  /**
   * Whether a babonus is valid for being 'item only' in the builder. It must be embedded in an item, must not be an aura or
   * template aura, and must either apply to attack rolls, damage rolls, or save DCs while the parent item can make use of
   * one of those, or it must apply to ability checks while being embedded on a tool-type item.
   * @returns {boolean}
   */
  get canExclude() {
    if (!(this.parent instanceof Item)) return false;

    // Valid for attack/damage/save:
    const validityA = ["attack", "damage", "save"].includes(this.type) && ITEM_ROLL_TYPES.includes(this.parent.type);

    // Valid for test:
    const validityB = (this.type === "test") && (this.parent.type === "tool");

    return (validityA || validityB) && !this.isTokenAura && !this.isTemplateAura;
  }

  /**
   * Whether the bonus applies only to its parent item. This is true if it has the property enabled and is valid to do so.
   * @returns {boolean}
   */
  get isExclusive() {
    return this.itemOnly && this.canExclude;
  }

  /**
   * Whether the babonus is unavailable due to its parent item being unequipped or unattuned (if required). This is
   * different from a babonus that is unavailable due to its parent effect being disabled or unavailable.
   * @returns {boolean}
   */
  get isSuppressed() {
    const item = (this.parent instanceof Item) ? this.parent : this.item;
    if (!item || !(this.parent instanceof Item) || !EQUIPPABLE_TYPES.includes(item.type)) return false;

    const ir = this.filters.itemRequirements;
    const at = CONFIG.DND5E.attunementTypes.ATTUNED;
    return ((item.system.attunement !== at) && ir.attuned) || (!item.system.equipped && ir.equipped);
  }

  /**
   * Whether the babonus is an enabled and valid aura centered on a token. This is true if the property is enabled, the
   * template aura property is not enabled, and the range of the aura has been set to either '-1' for infinite range, or any
   * positive number, after evaluation using roll data of its origin.
   * @returns {boolean}
   */
  get isTokenAura() {
    if (!this.aura.enabled || this.aura.isTemplate) return false;
    const range = _bonusToInt(this.aura.range, this.origin?.getRollData() ?? {});
    return (range === -1) || (range > 0);
  }

  /**
   * Whether the babonus is a template aura. This is true if the aura property is enabled, along with the 'isTemplate' aura
   * property, and the item on which the babonus is embedded can create a measured template.
   * @returns {boolean}
   */
  get isTemplateAura() {
    const isItem = this.parent instanceof Item;
    return this.aura.enabled && this.aura.isTemplate && isItem && this.parent.hasAreaTarget;
  }

  /**
   * Whether the babonus aura is suppressed due to its originating actor having at least one of the blocker conditions.
   * @returns {boolean}
   */
  get isAuraBlocked() {
    const blockers = new Set(this.aura.blockers);
    if (!blockers.size) return false;

    return (this.actor?.effects ?? []).some(e => {
      return e.modifiesActor && e.statuses.intersects(blockers);
    });
  }

  /**
   * Whether the babonus has any valid entries in Babonus#bonuses. Such an entry is valid for consideration if it is a non-
   * empty string and is not simply '0'.
   * @returns {boolean}
   */
  get hasBonus() {
    return Object.values(this.bonuses).some(val => (val.length > 0) && (val !== "0"));
  }

  /**
   * The true source of the babonus.
   * - If the babonus is embedded on a template, this returns the item that created it.
   * - If the babonus is embedded on an effect, this returns the actor or item from which the effect originates.
   * - If the babonus is embedded on an item or actor, this simply returns that item or actor.
   * @returns {Actor|Item}
   */
  get origin() {
    if (this.parent instanceof MeasuredTemplateDocument) {
      const origin = this.parent.flags.dnd5e?.origin ?? "";
      return fromUuidSync(origin);
    }

    else if (this.parent instanceof ActiveEffect) {
      const origin = fromUuidSync(this.parent.origin ?? "");
      if (origin instanceof TokenDocument) return origin.actor; // TODO: fix in v11, since uuid will return actor.
      return origin;
    }

    else if (this.parent instanceof Item) {
      return this.parent;
    }

    else if (this.parent instanceof Actor) {
      return this.parent;
    }
  }

  /**
   * Get the source actor of a babonus, no matter what type of document it is embedded in.
   * @returns {Actor|null}
   */
  get actor() {
    if (this.parent instanceof Actor) {
      return this.parent;
    }

    else if (this.parent instanceof ActiveEffect) {
      // TODO: consider effects that live on items in v11.
      return this.parent.parent;
    }

    else if (this.parent instanceof Item) {
      return this.parent.actor;
    }

    else if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e.origin);
      return item?.actor ?? null;
    }
  }

  /**
   * Get the token corresponding token of the actor that has the bonus, no matter what type of document it is embedded in.
   * @returns {Token|null}
   */
  get token() {
    const actor = this.actor;
    if (!actor) return null;

    return actor.token?.object ?? actor.getActiveTokens()[0] ?? null;
  }

  /**
   * Get the item that has the babonus, no matter if the babonus lives on a template, effect, or item.
   * @returns {Item|null}
   */
  get item() {
    if (this.parent instanceof Item) {
      return this.parent;
    }

    else if (this.parent instanceof MeasuredTemplateDocument) {
      const item = fromUuidSync(this.parent.flags.dnd5e.origin);
      return item ?? null;
    }

    else if (this.parent instanceof ActiveEffect) {
      const item = fromUuidSync(this.parent.origin ?? "");
      return (item instanceof Item) ? item : null;
    }

    else if (this.parent instanceof Actor) {
      return null;
    }
  }

  /**
   * Get the effect that has the babonus.
   * @returns {ActiveEffect|null}
   */
  get effect() {
    return (this.parent instanceof ActiveEffect) ? this.parent : null;
  }

  /**
   * Get the tempalte that has the babonus.
   * @returns {MeasuredTemplateDocument|null}
   */
  get template() {
    return (this.parent instanceof MeasuredTemplateDocument) ? this.parent : null;
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
        range: new foundry.data.fields.StringField({required: false, initial: null, blank: false, nullable: true}),
        self: new foundry.data.fields.BooleanField({required: false, initial: true}),
        disposition: new foundry.data.fields.NumberField({required: false, initial: AURA_TARGETS.ANY, choices: Object.values(AURA_TARGETS)}),
        blockers: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false}))
      }),
      filters: new babonusFields.FiltersField({
        itemRequirements: new babonusFields.ItemRequirementsField({
          equipped: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true}),
          attuned: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
        }),
        arbitraryComparison: new babonusFields.ArbitraryComparisonField(new foundry.data.fields.SchemaField({
          one: new foundry.data.fields.StringField({required: false, blank: false}),
          other: new foundry.data.fields.StringField({required: false, blank: false}),
          operator: new foundry.data.fields.StringField({required: false, choices: ARBITRARY_OPERATORS.map(t => t.value)})
        })),
        baseArmors: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.baseArmors.flatMap(({value}) => [value, `!${value}`])
        })),
        statusEffects: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        targetEffects: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        creatureTypes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({blank: false})),
        healthPercentages: new babonusFields.HealthPercentagesField({
          value: new foundry.data.fields.NumberField({required: false, initial: null, min: 0, max: 100, step: 1, integer: true, nullable: true}),
          type: new foundry.data.fields.NumberField({required: false, initial: null, choices: [0, 1], nullable: true})
        }),
        customScripts: new foundry.data.fields.StringField({initial: null, nullable: true}),
        preparationModes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.preparationModes.map(t => t.value)
        })),
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
    console.warn(`A babonus (${source.name}) is using an outdated format for 'Creature Types'. Editing and saving the bonus with no changes made will resolve this warning.`);
    console.warn("The old format will be supported until FVTT v11.");
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.creatureTypes = c;
  }

  static _migrateWeaponProperties(source) {
    const types = source.filters.weaponProperties;
    if (!types || (types instanceof Array) || (typeof types === "string")) return;
    console.warn(`A babonus (${source.name}) is using an outdated format for 'Weapon Properties'. Editing and saving the bonus with no changes made will resolve this warning.`);
    console.warn("The old format will be supported until FVTT v11.");
    const c = [];
    for (const t of (types.needed ?? [])) c.push(t);
    for (const u of (types.unfit ?? [])) c.push(`!${u}`);
    source.filters.weaponProperties = c;
  }
}

// a bonus attached to an item; attack rolls, damage rolls, save dc.
class ItemBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      filters: new babonusFields.FiltersField({
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
        spellComponents: new babonusFields.SpellComponentsField({
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
          choices: KeyGetter.baseWeapons.flatMap(({value}) => [value, `!${value}`])
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
      bonuses: new babonusFields.BonusesField({
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
      bonuses: new babonusFields.BonusesField({
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
      bonuses: new babonusFields.BonusesField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new babonusFields.FiltersField({
        saveAbilities: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.saveAbilities.map(t => t.value)
        }))
      })
    });
  }
}

export class ThrowBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new babonusFields.BonusesField({
        bonus: new foundry.data.fields.StringField(),
        deathSaveTargetValue: new foundry.data.fields.StringField(),
        deathSaveCritical: new foundry.data.fields.StringField()
      }),
      filters: new babonusFields.FiltersField({
        throwTypes: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.throwTypes.map(t => t.value)
        }))
      })
    });
  }
}

export class TestBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new babonusFields.BonusesField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new babonusFields.FiltersField({
        abilities: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.abilities.map(t => t.value)
        })),
        baseTools: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.baseTools.flatMap(({value}) => [value, `!${value}`])
        })),
        skillIds: new babonusFields.SemicolonArrayField(new foundry.data.fields.StringField({
          choices: KeyGetter.skillIds.flatMap(({value}) => [value, `!${value}`])
        }))
      })
    });
  }
}

export class HitDieBabonus extends Babonus {
  static defineSchema() {
    return foundry.utils.mergeObject(super.defineSchema(), {
      bonuses: new babonusFields.BonusesField({
        bonus: new foundry.data.fields.StringField()
      }),
      filters: new babonusFields.FiltersField({})
    })
  }
}
