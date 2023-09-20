import {FilterMixin} from "../FilterMixin.mjs";

export class CustomScriptsField extends FilterMixin(foundry.data.fields.StringField) {
  static name = "customScripts";
  static template = "modules/babonus/templates/parts/textarea.hbs";

  constructor() {
    super({initial: null, nullable: true});
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus) : null;
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus)?.length;
  }
}
