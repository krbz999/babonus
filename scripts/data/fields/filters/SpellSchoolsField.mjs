import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class SpellSchoolsField extends FilterMixin(SemicolonArrayField) {
  static name = "spellSchools";
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("spellSchools");
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
