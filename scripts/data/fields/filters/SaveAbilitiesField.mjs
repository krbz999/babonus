import {FilterMixin} from "../../FilterMixin.mjs";
import {AbilitiesField} from "./AbilitiesField.mjs";

export class SaveAbilitiesField extends FilterMixin(AbilitiesField) {
  static name = "saveAbilities";
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("saveAbilities");
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
