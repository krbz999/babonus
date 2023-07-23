import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class ThrowTypesField extends FilterMixin(SemicolonArrayField) {
  static name = "throwTypes";
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("throwTypes");
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
