// The Bonuses field. A simple override to delete all zero-length strings.
export class BonusesField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const data = super.toObject(value);
    for (const [key, val] of Object.entries(value)) {
      if (!val?.length) delete data[key];
    }
    return data;
  }
}
