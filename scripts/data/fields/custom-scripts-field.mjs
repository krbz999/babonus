import {FilterMixin} from "../filter-mixin.mjs";

export class CustomScriptsField extends FilterMixin(foundry.data.fields.StringField) {
  static name = "customScripts";
  static template = "modules/babonus/templates/parts/textarea.hbs";

  constructor() {
    super({initial: null, nullable: true});
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData();
    data.value = this.value(bonus);
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus)?.length;
  }
}
