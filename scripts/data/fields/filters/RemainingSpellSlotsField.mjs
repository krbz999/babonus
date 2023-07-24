import {FilterMixin} from "../../FilterMixin.mjs";
import {SpanField} from "../SpanField.mjs";

export class RemainingSpellSlotsField extends FilterMixin(SpanField) {
  static name = "remainingSpellSlots";
  static template = "modules/babonus/templates/builder_components/text_dash_text.hbs";

  static getData(bonus = null) {
    const data = super.getData();
    const value = bonus ? this.value(bonus) : {};
    data.min = value.min ?? null;
    data.max = value.max ?? null;
    return data;
  }

  /** @override */
  static storage(bonus) {
    return Object.values(this.value(bonus)).some(v => Number.isNumeric(v));
  }
}
