import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class ActorCreatureTypesField extends FilterMixin(SemicolonArrayField) {
  static name = "actorCreatureTypes";
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";
  static canExclude = true;

  constructor() {
    super(null);
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
