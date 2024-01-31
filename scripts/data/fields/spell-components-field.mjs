import {FilterMixin} from "../filter-mixin.mjs";

export class SpellComponentsField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "spellComponents";
  static template = "modules/babonus/templates/parts/checkboxes-select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      types: new foundry.data.fields.SetField(new foundry.data.fields.StringField({blank: false, required: false})),
      match: new foundry.data.fields.StringField({nullable: true, initial: null, choices: ["ANY", "ALL"]})
    });
  }

  /** @override */
  static async getData(bonus) {
    const value = this.value(bonus);
    const types = value.types ?? [];
    const match = value.match ?? null;
    const data = await super.getData();
    const choices = await this.choices();

    data.types = choices.map(c => ({
      checked: types.has(c.value),
      value: c.value,
      label: c.abbr,
      tooltip: c.label
    }));
    data.selected = match;
    data.options = {
      ANY: "BABONUS.FiltersSpellComponentsMatchAny",
      ALL: "BABONUS.FiltersSpellComponentsMatchAll"
    };
    return data;
  }

  /** @override */
  static async choices() {
    const keys = CONFIG.DND5E.validProperties.spell;
    const labels = CONFIG.DND5E.itemProperties;
    return keys.reduce((acc, k) => {
      const {label, abbr} = labels[k] ?? {};
      if (label) acc.push({value: k, label: label, abbr: abbr || label.slice(0, 1).toUpperCase()});
      return acc;
    }, []);
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus).types?.filter(u => u).size;
  }
}
