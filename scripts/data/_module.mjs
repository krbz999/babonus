import {AuraModel} from "./aura-model.mjs";
import {models} from "./babonus-model.mjs";
import {ConsumptionModel} from "./consumption-model.mjs";
import {ModifiersModel} from "./modifiers-model.mjs";
import {ArbitraryComparisonField} from "./fields/arbitrary-comparison-field.mjs";
import {checkboxFields} from "./fields/checkbox-fields.mjs";
import {CustomScriptsField} from "./fields/custom-scripts-field.mjs";
import {FeatureTypesField} from "./fields/feature-types-field.mjs";
import {HealthPercentagesField} from "./fields/health-percentages-field.mjs";
import {RemainingSpellSlotsField} from "./fields/remaining-spell-slots-field.mjs";
import {fields} from "./fields/semicolon-fields.mjs";
import {SpellComponentsField} from "./fields/spell-components-field.mjs";
import {TokenSizesField} from "./fields/token-sizes-field.mjs";

export const module = {
  models: models,
  fields: {
    aura: AuraModel,
    consume: ConsumptionModel,
    modifiers: ModifiersModel
  },
  filters: {
    arbitraryComparison: ArbitraryComparisonField,
    customScripts: CustomScriptsField,
    healthPercentages: HealthPercentagesField,
    remainingSpellSlots: RemainingSpellSlotsField,
    spellComponents: SpellComponentsField,
    tokenSizes: TokenSizesField,
    featureTypes: FeatureTypesField,
    ...fields,
    ...checkboxFields
  }
};
