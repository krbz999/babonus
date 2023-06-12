import {ARBITRARY_OPERATORS, SPELL_COMPONENT_MATCHING} from "../constants.mjs";
import {KeyGetter} from "../helpers/helpers.mjs";

// The Bonuses field. A simple override to delete all zero-length strings.
class BonusesField extends foundry.data.fields.SchemaField {
  /** @override */
  toObject(value) {
    const data = super.toObject(value);
    for (const [key, val] of Object.entries(value)) {
      if (!val?.length) delete data[key];
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
  /** @override */
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
  constructor(name, negate = false) {
    let element;
    if (name) element = new foundry.data.fields.StringField({choices: KeyGetter._getSchemaFilterOptions(name, negate)});
    else element = new foundry.data.fields.StringField({blank: false});
    super(element);
  }

  /**
   * @override
   * If the given value is a string, split it at each ';' and trim the results to get an array.
   */
  _cast(value) {
    if (typeof value === "string") value = value.split(";").map(v => v.trim());
    return super._cast(value);
  }

  /**
   * @override
   * If the given value contains invalid options, simply ignore them. This is done
   * since several filters that make use of this field can be customized through
   * world scripts or modules, such as 'weapon properties'.
   */
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
  /** @override */
  constructor(options = {}) {
    super(new foundry.data.fields.SchemaField({
      one: new foundry.data.fields.StringField({blank: false}),
      other: new foundry.data.fields.StringField({blank: false}),
      operator: new foundry.data.fields.StringField({choices: ARBITRARY_OPERATORS})
    }), options);
  }

  /**
   * @override
   * Filter out any elements in the array that do not contain all three values.
   */
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
  /** @override */
  _initialize() {
    return super._initialize({
      size: new foundry.data.fields.NumberField({min: 0.5, step: 0.5}),
      type: new foundry.data.fields.NumberField({nullable: true, choices: [0, 1]}),
      self: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
    });
  }

  /** @override */
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

class SpellComponentsField extends foundry.data.fields.SchemaField {
  /** @override */
  _initialize() {
    return super._initialize({
      types: new babonusFields.FilteredArrayField(new foundry.data.fields.StringField({
        choices: KeyGetter._getSchemaFilterOptions("spellComponents")
      })),
      match: new foundry.data.fields.StringField({
        nullable: true, initial: null, choices: SPELL_COMPONENT_MATCHING
      })
    });
  }

  /** @override */
  toObject(value) {
    const badData = [value.types, value.match].includes(null) || !value.types?.length;
    return badData ? null : value;
  }
}

class ItemRequirementsField extends foundry.data.fields.SchemaField {
  /** @override */
  _initialize() {
    return super._initialize({
      equipped: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true}),
      attuned: new foundry.data.fields.BooleanField({required: false, initial: null, nullable: true})
    });
  }

  /** @override */
  toObject(value) {
    const badData = (value.equipped === null) && (value.attuned === null);
    return badData ? null : value;
  }
}

class HealthPercentagesField extends foundry.data.fields.SchemaField {
  /** @override */
  _initialize() {
    return super._initialize({
      value: new foundry.data.fields.NumberField({min: 0, max: 100, step: 1, integer: true}),
      type: new foundry.data.fields.NumberField({nullable: true, choices: [0, 1]})
    });
  }

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
