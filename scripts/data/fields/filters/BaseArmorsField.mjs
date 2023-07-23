import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class BaseArmorsField extends FilterMixin(SemicolonArrayField) {
  static name = "baseArmors";
  static canExclude = true;
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("baseArmors", true);
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
