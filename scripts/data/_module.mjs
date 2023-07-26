import {AuraModel} from "./AuraModel.mjs";
import {models} from "./BabonusModel.mjs";
import {ConsumptionModel} from "./ConsumptionModel.mjs";
import {ArbitraryComparisonField} from "./fields/ArbitraryComparisonField.mjs";
import {checkboxFields} from "./fields/CheckboxFields.mjs";
import {CustomScriptsField} from "./fields/CustomScriptsField.mjs";
import {HealthPercentagesField} from "./fields/HealthPercentagesField.mjs";
import {ItemRequirementsField} from "./fields/ItemRequirementsField.mjs";
import {RemainingSpellSlotsField} from "./fields/RemainingSpellSlotsField.mjs";
import {fields} from "./fields/SemicolonFields.mjs";
import {SpellComponentsField} from "./fields/SpellComponentsField.mjs";
import {TokenSizesField} from "./fields/TokenSizesField.mjs";

export const module = {
  models: models,
  fields: {
    aura: AuraModel,
    consume: ConsumptionModel
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
