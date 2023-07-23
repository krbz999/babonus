import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class PreparationModesField extends FilterMixin(SemicolonArrayField) {
  static name = "preparationModes";
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("preparationModes");
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
