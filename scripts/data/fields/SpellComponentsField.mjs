import {FilterMixin} from "../FilterMixin.mjs";

export class SpellComponentsField extends FilterMixin(foundry.data.fields.SchemaField) {
  static name = "spellComponents";
  static template = "modules/babonus/templates/parts/checkboxes-select.hbs";

  /** @override */
  _initialize() {
    return super._initialize({
      types: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField({blank: false, required: false})),
      match: new foundry.data.fields.StringField({nullable: true, initial: null, choices: ["ANY", "ALL"]})
    });
  }

  /** @override */
  static getData(bonus = null) {
    const value = bonus ? this.value(bonus) : {};
    const types = value.types ?? [];
    const match = value.match ?? null;
    const data = super.getData();

    data.types = this.choices.map(c => ({
      checked: types.includes(c.value),
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
  static get choices() {
    const comps = Object.entries(CONFIG.DND5E.spellComponents);
    const tags = Object.entries(CONFIG.DND5E.spellTags);
    return [...comps, ...tags].map(([value, {abbr, label}]) => {
      return {value, label, abbr};
    }).sort((a, b) => a.label.localeCompare(b.label));
  }

  /** @override */
  static storage(bonus) {
    return !!this.value(bonus).types?.filter(u => u).length;
  }
}
