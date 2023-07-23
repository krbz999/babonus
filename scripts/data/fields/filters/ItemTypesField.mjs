import {FilterMixin} from "../../FilterMixin.mjs";
import {FilteredArrayField} from "../FilteredArrayField.mjs";

export class ItemTypesField extends FilterMixin(FilteredArrayField) {
  static name = "itemTypes";
  static template = "modules/babonus/templates/builder_components/checkboxes.hbs";

  constructor() {
    super(new foundry.data.fields.StringField({
      choices: Object.keys(dnd5e.dataModels.item.config).filter(u => {
        return !!dnd5e.dataModels.item.config[u].schema.getField("damage.parts");
      })
    }));
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = bonus ? this.value(bonus) : [];
    data.value = this.choices.map(c => {
      return {
        checked: value.includes(c),
        value: c,
        label: c.slice(0, 4),
        tooltip: `TYPES.Item.${c}`
      };
    });
    return data;
  }

  /** @override */
  static get choices() {
    return Object.keys(dnd5e.dataModels.item.config).filter(u => {
      return !!dnd5e.dataModels.item.config[u].schema.getField("damage.parts");
    });
  }
}
