import {FilterMixin} from "../FilterMixin.mjs";

export class ItemRequirementsField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "itemRequirements";
  static template = "modules/babonus/templates/builder_components/label_checkbox_label_checkbox.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      equipped: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true}),
      attuned: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
    });
  }

  /** @override */
  static isFilterAvailable(filters, bonus) {
    if (!super.isFilterAvailable(filters, bonus)) return false;
    const item = bonus.item;
    return (item instanceof Item) && (this.canEquip(item) || this.canAttune(item));
  }

  static canEquip(item) {
    const schema = dnd5e.dataModels.item.config[item.type].schema;
    return !!schema.getField("equipped");
  }

  static canAttune(item) {
    if (!this.canEquip(item)) return false;
    const {REQUIRED, ATTUNED} = CONFIG.DND5E.attunementTypes;
    return [REQUIRED, ATTUNED].includes(item.system.attunement);
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    const value = bonus ? this.value(bonus) : {};
    data.equipped = value.equipped ?? false;
    data.attuned = value.attuned ?? false;
    data.canEquip = true;
    data.canAttune = true;
    return data;
  }

  /** @override */
  static storage(bonus) {
    return Object.values(this.value(bonus)).includes(true);
  }
}
