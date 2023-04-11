// The Bonuses field. A simple override to delete all zero-length strings.
class BonusesField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const data = super.toObject(value);
    for (const [key, val] of Object.entries(value)) {
      if (val.length > 0) data[key] = val;
    }
    return data;
  }
}

// The Filters field. A simple override to delete all null values.
class FiltersField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const data = super.toObject(value);
    for (const [key, value] of Object.entries(data)) {
      if (value === null) delete data[key];
    }
    return data;
  }
}

// ArrayField that only saves its truthy values. Used in all fields that have checkboxes.
class FilteredArrayField extends foundry.data.fields.ArrayField {
  _cast(value) {
    return super._cast(value.filter(i => i));
  }

  /** @override */
  toObject(value) {
    return value.length ? value : null;
  }
}

// ArrayField that turns a semicolon string into an array of strings.
class SemicolonArrayField extends foundry.data.fields.ArrayField {
  _cast(value) {
    if (typeof value === "string") value = value.split(";").map(v => v.trim());
    return super._cast(value);
  }

  _cleanType(value, source) {
    const choices = this.element.choices;
    value = value.reduce((acc, v) => {
      if (!v) return acc;
      if (!choices || choices.includes(v)) acc.push(v);
      return acc;
    }, []);
    value = super._cleanType(value, source);
    return [...new Set(value)];
  }

  /** @override */
  toObject(value) {
    return value.length ? value : null;
  }
}

// ArrayField that filters invalid comparison fields.
class ArbitraryComparisonField extends foundry.data.fields.ArrayField {
  _cast(value) {
    value = super._cast(value);
    return value.filter(i => !!i?.one && !!i.operator && !!i.other);
  }

  /** @override */
  toObject(value) {
    return value.length ? value : null;
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

  /** @override */
  toObject(value) {
    const badData = [value.self, value.size, value.type].includes(null);
    return badData ? null : value;
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

  /** @override */
  toObject(value) {
    const badData = [value.min, value.max].includes(null);
    return badData ? null : value;
  }
}

class SpellComponentsField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const badData = [value.types, value.match].includes(null) || !value.types?.length;
    return badData ? null : value;
  }
}

class ItemRequirementsField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const badData = (value.equipped === null) && (value.attuned === null);
    return badData ? null : value;
  }
}

class HealthPercentagesField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const badData = (value.value === null) || (value.type === null);
    return badData ? null : value;
  }
}

export const babonusFields = {
  ArbitraryComparisonField,
  BonusesField,
  FilteredArrayField,
  FiltersField,
  HealthPercentagesField,
  ItemRequirementsField,
  SemicolonArrayField,
  SpanField,
  SpellComponentsField,
  TokenSizeField
};
