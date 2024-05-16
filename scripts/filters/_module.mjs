import {ArbitraryComparisonField} from "./arbitrary-comparison-field.mjs";
import checkboxFields from "./checkbox-fields.mjs";
import {CustomScriptsField} from "./custom-scripts-field.mjs";
import {FeatureTypesField} from "./feature-types-field.mjs";
import {HealthPercentagesField} from "./health-percentages-field.mjs";
import {RemainingSpellSlotsField} from "./remaining-spell-slots-field.mjs";
import semicolonFields from "./semicolon-fields.mjs";
import {TokenSizesField} from "./token-sizes-field.mjs";

export default Object.values({
  ArbitraryComparisonField,
  ...checkboxFields,
  CustomScriptsField,
  FeatureTypesField,
  HealthPercentagesField,
  RemainingSpellSlotsField,
  ...semicolonFields,
  TokenSizesField
}).reduce((acc, field) => {
  acc[field.name] = field;
  return acc;
}, {});
