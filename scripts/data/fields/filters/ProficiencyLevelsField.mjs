import {KeyGetter} from "../../../helpers/helpers.mjs";
import {FilterMixin} from "../../FilterMixin.mjs";
import {FilteredArrayField} from "../FilteredArrayField.mjs";

export class ProficiencyLevelsField extends FilterMixin(FilteredArrayField) {
  static name = "proficiencyLevels";
  static template = "modules/babonus/templates/builder_components/checkboxes.hbs";

  constructor() {
    super(new foundry.data.fields.NumberField({
      choices: KeyGetter._getSchemaFilterOptions("proficiencyLevels")
    }));
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = !bonus ? [] : this.value(bonus);
    data.value = this.choices.map(c => {
      return {
        checked: value.includes(c),
        value: c,
        label: c,
        tooltip: CONFIG.DND5E.proficiencyLevels[c]
      };
    });
    return data;
  }

  /** @override */
  static get choices() {
    return KeyGetter._getSchemaFilterOptions("proficiencyLevels");
  }
}
