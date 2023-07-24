import {AbilitiesField} from "../data/fields/filters/AbilitiesField.mjs";
import {ActorCreatureTypesField} from "../data/fields/filters/ActorCreatureTypesField.mjs";
import {ArbitraryComparisonField} from "../data/fields/filters/ArbitraryComparisonField.mjs";
import {AttackTypesField} from "../data/fields/filters/AttackTypesField.mjs";
import {AuraModel} from "../data/AuraModel.mjs";
import {BaseArmorsField} from "../data/fields/filters/BaseArmorsField.mjs";
import {BaseToolsField} from "../data/fields/filters/BaseToolsField.mjs";
import {BaseWeaponsField} from "../data/fields/filters/BaseWeaponsField.mjs";
import {BonusesField} from "../data/fields/BonusesField.mjs";
import {CreatureTypesField} from "../data/fields/filters/CreatureTypesField.mjs";
import {CustomScriptsField} from "../data/fields/filters/CustomScriptsField.mjs";
import {DamageTypesField} from "../data/fields/filters/DamageTypesField.mjs";
import {HealthPercentagesField} from "../data/fields/filters/HealthPercentagesField.mjs";
import {ItemRequirementsField} from "../data/fields/filters/ItemRequirementsField.mjs";
import {ItemTypesField} from "../data/fields/filters/ItemTypesField.mjs";
import {PreparationModesField} from "../data/fields/filters/PreparationModesField.mjs";
import {ProficiencyLevelsField} from "../data/fields/filters/ProficiencyLevelsField.mjs";
import {RemainingSpellSlotsField} from "../data/fields/filters/RemainingSpellSlotsField.mjs";
import {SaveAbilitiesField} from "../data/fields/filters/SaveAbilitiesField.mjs";
import {SkillIdsField} from "../data/fields/filters/SkillIdsField.mjs";
import {SpellComponentsField} from "../data/fields/filters/SpellComponentsField.mjs";
import {SpellLevelsField} from "../data/fields/filters/SpellLevelsField.mjs";
import {SpellSchoolsField} from "../data/fields/filters/SpellSchoolsField.mjs";
import {StatusEffectsField} from "../data/fields/filters/StatusEffectsField.mjs";
import {TargetEffectsField} from "../data/fields/filters/TargetEffectsField.mjs";
import {ThrowTypesField} from "../data/fields/filters/ThrowTypesField.mjs";
import {TokenSizesField} from "../data/fields/filters/TokenSizesField.mjs";
import {WeaponPropertiesField} from "../data/fields/filters/WeaponPropertiesField.mjs";

export const babonusFields = {
  data: {
    aura: AuraModel,
    bonuses: BonusesField
  },
  filters: {
    abilities: AbilitiesField,
    actorCreatureTypes: ActorCreatureTypesField,
    arbitraryComparison: ArbitraryComparisonField,
    attackTypes: AttackTypesField,
    baseArmors: BaseArmorsField,
    baseTools: BaseToolsField,
    baseWeapons: BaseWeaponsField,
    creatureTypes: CreatureTypesField,
    customScripts: CustomScriptsField,
    damageTypes: DamageTypesField,
    healthPercentages: HealthPercentagesField,
    itemRequirements: ItemRequirementsField,
    itemTypes: ItemTypesField,
    preparationModes: PreparationModesField,
    proficiencyLevels: ProficiencyLevelsField,
    remainingSpellSlots: RemainingSpellSlotsField,
    saveAbilities: SaveAbilitiesField,
    skillIds: SkillIdsField,
    spellComponents: SpellComponentsField,
    spellLevels: SpellLevelsField,
    spellSchools: SpellSchoolsField,
    statusEffects: StatusEffectsField,
    targetEffects: TargetEffectsField,
    throwTypes: ThrowTypesField,
    tokenSizes: TokenSizesField,
    weaponProperties: WeaponPropertiesField
  }
};
