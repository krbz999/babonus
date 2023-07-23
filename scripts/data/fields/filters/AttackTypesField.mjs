import {FilterMixin} from "../../FilterMixin.mjs";
import {FilteredArrayField} from "../FilteredArrayField.mjs";

export class AttackTypesField extends FilterMixin(FilteredArrayField) {
  static name = "attackTypes";
  static template = "modules/babonus/templates/builder_components/checkboxes.hbs"

  constructor() {
    super(new foundry.data.fields.StringField({choices: ["mwak", "rwak", "msak", "rsak"]}));
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = !bonus ? [] : this.value(bonus);
    data.value = this.choices.map(c => {
      return {checked: value.includes(c), value: c, label: c, tooltip: CONFIG.DND5E.itemActionTypes[c]};
    });
    return data;
  }

  /** @override */
  static get choices() {
    return ["mwak", "rwak", "msak", "rsak"];
  }
}
