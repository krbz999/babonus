import {FilterMixin} from "../filter-mixin.mjs";

const {SchemaField, StringField} = foundry.data.fields;

export class FeatureTypesField extends FilterMixin(SchemaField) {
  static name = "featureTypes";
  static template = "modules/babonus/templates/parts/double-select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      type: new StringField({required: true}),
      subtype: new StringField({required: true})
    });
  }

  /** @override */
  static async getData(bonus) {
    const data = await super.getData(bonus);
    const value = this.value(bonus);
    data.options = CONFIG.DND5E.featureTypes;
    data.subOptions = CONFIG.DND5E.featureTypes[value.type]?.subtypes ?? {};
    data.hasSubtype = !foundry.utils.isEmpty(data.subOptions);
    data.selected = value.type;
    data.subselected = value.subtype;
    return data;
  }

  /** @override */
  static storage(bonus) {
    const value = this.value(bonus);
    return value.type in CONFIG.DND5E.featureTypes;
  }
}
