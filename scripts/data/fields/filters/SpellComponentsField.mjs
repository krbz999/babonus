import {KeyGetter} from "../../../helpers/helpers.mjs";
import {FilterMixin} from "../../FilterMixin.mjs";
import {FilteredArrayField} from "../FilteredArrayField.mjs";

export class SpellComponentsField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "spellComponents";
  static template = "modules/babonus/templates/builder_components/checkboxes_select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      types: new FilteredArrayField(new foundry.data.fields.StringField({
        choices: KeyGetter._getSchemaFilterOptions("spellComponents")
      })),
      match: new foundry.data.fields.StringField({
        nullable: true, initial: null, choices: ["ANY", "ALL"]
      })
    });
  }

  /** @override */
  static getData(bonus = null) {
    const value = bonus ? this.value(bonus) : {};
    const types = value.types ?? [];
    const match = value.match ?? null;
    const data = super.getData();

    data.types = KeyGetter[this.name].map(c => ({checked: types.includes(c.value), value: c.value, label: c.abbr, tooltip: c.label}));
    data.selected = match;
    data.options = {
      ANY: "BABONUS.FiltersSpellComponentsMatchAny",
      ALL: "BABONUS.FiltersSpellComponentsMatchAll"
    };
    return data;
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus).types?.length;
  }
}
