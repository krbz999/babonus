// The Filters field. A simple override to delete all null values.
export class FiltersField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const data = super.toObject(value);
    for (const [key, value] of Object.entries(data)) {
      if (value === null) delete data[key];
    }
    return data;
  }
}
