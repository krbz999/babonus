// SchemaField with two numeric inputs that requires min < max if both are non-empty.
export class SpanField extends foundry.data.fields.SchemaField {
  /** @override */
  _initialize() {
    return super._initialize({
      min: new foundry.data.fields.NumberField({min: 0, step: 1, integer: true}),
      max: new foundry.data.fields.NumberField({min: 0, step: 1, integer: true})
    });
  }

  /** @override */
  _validateType(data, options = {}) {
    if ((data.min !== null && data.max !== null) && (data.min > data.max)) {
      throw new foundry.data.fields.ModelValidationError("min cannot be higher than max");
    }
    return super._validateType(data, options);
  }

  /** @override */
  toObject(value) {
    const badData = [value.min, value.max].includes(null);
    return badData ? null : value;
  }
}
