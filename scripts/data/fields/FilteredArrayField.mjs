// ArrayField that only saves its truthy values. Used in all fields that have checkboxes.
export class FilteredArrayField extends foundry.data.fields.ArrayField {
  /** @override */
  _cast(value) {
    return super._cast(value.filter(i => i));
  }

  static get choices(){
    throw new Error("This getter must be subclassed!");
  }
}
