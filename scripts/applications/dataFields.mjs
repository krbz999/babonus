import {AuraModel} from "../data/AuraModel.mjs";
import {ArbitraryComparisonField} from "../data/fields/ArbitraryComparisonField.mjs";
import {checkboxFields} from "../data/fields/CheckboxFields.mjs";
import {CustomScriptsField} from "../data/fields/CustomScriptsField.mjs";
import {HealthPercentagesField} from "../data/fields/HealthPercentagesField.mjs";
import {ItemRequirementsField} from "../data/fields/ItemRequirementsField.mjs";
import {RemainingSpellSlotsField} from "../data/fields/RemainingSpellSlotsField.mjs";
import {fields} from "../data/fields/SemicolonFields.mjs";
import {SpellComponentsField} from "../data/fields/SpellComponentsField.mjs";
import {TokenSizesField} from "../data/fields/TokenSizesField.mjs";

export const babonusFields = {
  data: {
    aura: AuraModel
  },
  filters: {
    arbitraryComparison: ArbitraryComparisonField,
    customScripts: CustomScriptsField,
    healthPercentages: HealthPercentagesField,
    itemRequirements: ItemRequirementsField,
    remainingSpellSlots: RemainingSpellSlotsField,
    spellComponents: SpellComponentsField,
    tokenSizes: TokenSizesField,
    ...fields,
    ...checkboxFields
  }
};
