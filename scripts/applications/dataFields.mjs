export const babonusFields = {
  ArbitraryComparisonField,
  FilteredArrayField,
  SemicolonArrayField,
  SpanField,
  TokenSizeField
};

// ArrayField that only saves its truthy values.
class FilteredArrayField extends foundry.data.fields.ArrayField {
  _cast(data) {
    return super._cast(data.filter(i => i));
  }
}

// ArrayField that turns a semicolon string into an array of strings.
class SemicolonArrayField extends foundry.data.fields.ArrayField {
  _cast(value, options) {
    if (typeof value === "string") value = value.split(";");
    return super._cast(value, options);
  }

  _cleanType(value, options = {}) {
    value = super._cleanType(value, options).map(v => v?.trim()).filter(i => !!i);
    return [...new Set(value)];
  }
}

// ArrayField that filters invalid comparison fields.
class ArbitraryComparisonField extends foundry.data.fields.ArrayField {
  _cast(data) {
    const clone = foundry.utils.deepClone(super._cast(data));
    return clone.filter(i => !!i?.one && !!i.operator && !!i.other);
  }
}

// SchemaField that requires a value in all fields.
class TokenSizeField extends foundry.data.fields.SchemaField {
  _validateType(data, options = {}) {
    if ((data.self !== null) || (data.size !== null) || (data.type !== null)) {
      const self = [true, false].includes(data.self);
      const size = Number.isNumeric(data.size) && (data.size > 0);
      const type = [0, 1].includes(data.type);
      if (!self) throw new foundry.data.fields.ModelValidationError("self must be a boolean");
      if (!size) throw new foundry.data.fields.ModelValidationError("size must be a number greater than 0");
      if (!type) throw new foundry.data.fields.ModelValidationError("type must be 0 or 1");
    }
    return super._validateType(data, options);
  }
}

// SchemaField with two numeric inputs that requires min < max if both are non-empty.
class SpanField extends foundry.data.fields.SchemaField {
  _validateType(data, options = {}) {
    if ((data.min !== null && data.max !== null) && (data.min > data.max)) {
      throw new foundry.data.fields.ModelValidationError("min cannot be higher than max");
    }
    return super._validateType(data, options);
  }
}
