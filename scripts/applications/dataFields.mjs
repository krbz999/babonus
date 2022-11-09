// a SchemaField that must contain at least one valid value.
export class BonusesField extends foundry.data.fields.SchemaField {
  _validateType(data, options = {}) {
    super._validateType(data, options);
    const isE = foundry.utils.isEmpty(data);
    if (isE) throw new foundry.data.fields.ModelValidationError("may not be an empty object");
    else return true;
  }

  // delete invalid fields. Called before _validateType.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    const falsies = ["", "0", undefined, null];
    Object.keys(clone).filter(k => {
      return falsies.includes(clone[k]) || falsies.includes(clone[k].trim());
    }).forEach(k => delete clone[k]);
    return clone;
  }
}

// a SchemaField that deletes falsy values from all its arrays, then deletes the entire array if its empty.
export class FiltersField extends foundry.data.fields.SchemaField {
  // remove null and undefined from arrays and sets,
  // then delete empty sets and arrays.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    Object.keys(clone).forEach(k => {
      const t = foundry.utils.getType(clone[k]);
      if (t === "Set") {
        clone[k].delete(null);
        clone[k].delete(undefined);
      } else if (t === "Array") {
        clone[k] = clone[k].filter(v => ![null, undefined].includes(v));
      } else if (clone[k] === undefined) delete clone[k];
    });
    return clone;
  }
}

// a particular field that only requires MATCH if TYPES has any valid values.
export class SpellComponentsField extends foundry.data.fields.SchemaField {
  // if 'types' is empty, delete both it and 'match'.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    clone["types"] = clone["types"].filter(v => ![null, undefined].includes(v));
    if (foundry.utils.isEmpty(clone["types"])) {
      delete clone["match"];
      delete clone["types"];
    }
    return clone;
  }
}

// special field for the 'clickable' selections.
export class NonEmptyArrayField extends foundry.data.fields.ArrayField {
  _validateType(data, options = {}) {
    super._validateType(data, options);
    if (!data.filter(d => !!d).length) {
      throw new foundry.data.fields.ModelValidationError("must have at least one value");
    }
  }

  _cast(data, options = {}) {
    return super._cast(data.filter(i => i), options);
  }

}

// SchemaField containing only arrays that may not overlap.
export class DisjointArraysField extends foundry.data.fields.SchemaField {
  // if the sets overlap, error.
  _validateType(data, options = {}) {
    super._validateType(data, options);
    if (data.needed?.some(n => data.unfit?.includes(n))) {
      throw new foundry.data.fields.ModelValidationError("may not intersect");
    } else return true;
  }

  // if either set is empty, delete it.
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    const clone = foundry.utils.deepClone(data);
    for (const k of Object.keys(data)) {
      clone[k] = clone[k].filter(v => ![null, undefined].includes(v));
      if (foundry.utils.isEmpty(clone[k])) delete clone[k];
    }
    return clone;
  }
}

// a string field that only takes what can feasibly be part of a roll.
export class RollDataField extends foundry.data.fields.StringField {
  _validateType(value) {
    super._validateType(value);
    const v = Roll.validate(value);
    if (!v) throw new foundry.data.fields.ModelValidationError("cannot validate bonus");
    else return true;
  }
}

// an array field that takes a string and turns it into an array of strings.
export class SemicolonArrayField extends foundry.data.fields.ArrayField {
  _cast(value, options) {
    if (typeof value === "string") value = value.split(";");
    return super._cast(value, options);
  }

  _cleanType(value, options = {}) {
    value = super._cleanType(value, options);
    return [...new Set(value)];
  }
}

// a helper field to delete blockers and range since those are invalid for templates.
export class AuraField extends foundry.data.fields.SchemaField {
  _cleanType(data, options = {}) {
    super._cleanType(data, options);
    if (data.isTemplate) {
      delete data["blockers"];
      delete data["range"];
    } else if (!data["blockers"]?.filter(b => !!b.trim()).length) {
      delete data["blockers"];
    }
    return data;
  }

  _validateType(data, options = {}) {
    if (data.enabled && (!data.isTemplate && !data.range)) {
      throw new foundry.data.fields.ModelValidationError("aura is neither template nor has a range");
    }
    return super._validateType(data, options);
  }
}

// this is just a workaround for '_babonusToString' so as not to flatten all ArrayFields.
export class ArbitraryComparisonField extends foundry.data.fields.ArrayField { }
